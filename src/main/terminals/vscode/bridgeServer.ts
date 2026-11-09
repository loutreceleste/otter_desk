// Serveur du pont local OtterDesk ↔ extension VS Code (Node pur, sans Electron : testable).
//
// Sécurité :
//  - socket Unix uniquement (aucun port réseau), fichier en 0600 dans un dossier 0700 ;
//  - authentification mutuelle HMAC avec le secret partagé K (obtenu par appairage explicite) ;
//  - appairage par code court à durée limitée, nombre d'essais limité ;
//  - validation stricte de chaque message ; toute violation ferme la connexion ;
//  - délai maximal pour s'authentifier ; nombre de connexions limité.
import { EventEmitter } from "node:events";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  BRIDGE_SUPPORTED_PROTOCOLS,
  LineDecoder,
  encodeMessage,
  parseClientMessage,
  type BridgeClientInfo,
  type BridgeErrorCode,
  type BridgeSendErrorCode,
  type BridgeTerminalInfo,
  type ClientMessage,
  type ServerMessage,
} from "../../../shared/terminalBridge/protocol";
import {
  clientProof,
  derivePairingKey,
  generatePairingCode,
  newNonce,
  newSecret,
  pairClientProof,
  pairServerProof,
  safeEqualHex,
  sealSecret,
  serverProof,
} from "../../../shared/terminalBridge/crypto";

export interface SecretStore {
  get(): Buffer | null;
  set(secret: Buffer): void;
  clear(): void;
}

export interface BridgeServerOptions {
  socketPath: string;
  secrets: SecretStore;
  serverVersion: string;
  handshakeTimeoutMs?: number;
  sendTimeoutMs?: number;
  maxConnections?: number;
  maxPairingAttempts?: number;
  log?: (message: string) => void;
}

export interface ConnectedClient {
  client: BridgeClientInfo;
  terminals: BridgeTerminalInfo[];
  connectedAt: number;
}

export interface BridgeSendOutcome {
  ok: boolean;
  code?: BridgeSendErrorCode | "client-disconnected" | "timeout";
  error?: string;
  /** Mise au premier plan effectuée par l'extension (si demandée). */
  revealed?: boolean;
  /** false : extension trop ancienne pour la mise au premier plan (protocole v1). */
  revealSupported?: boolean;
}

type ConnState = "new" | "challenged" | "authenticated" | "registered" | "pair-challenged" | "closed";

interface Conn {
  id: string;
  socket: net.Socket;
  decoder: LineDecoder;
  state: ConnState;
  protocol: number;
  clientNonce?: string;
  serverNonce?: string;
  pairingKey?: Buffer;
  client?: BridgeClientInfo;
  terminals: Map<string, BridgeTerminalInfo>;
  connectedAt: number;
  timer?: NodeJS.Timeout;
}

interface PendingSend {
  conn: Conn;
  resolve: (outcome: BridgeSendOutcome) => void;
  timer: NodeJS.Timeout;
}

interface PairingSession {
  code: string;
  expiresAt: number;
  attempts: number;
}

export class BridgeServer extends EventEmitter {
  private server: net.Server | null = null;
  private readonly conns = new Map<string, Conn>();
  private readonly pending = new Map<string, PendingSend>();
  private pairing: PairingSession | null = null;
  private readonly opts: Required<Omit<BridgeServerOptions, "log">> & Pick<BridgeServerOptions, "log">;

  constructor(options: BridgeServerOptions) {
    super();
    this.opts = {
      handshakeTimeoutMs: 10_000,
      sendTimeoutMs: 5_000,
      maxConnections: 32,
      maxPairingAttempts: 3,
      ...options,
    };
  }

  // ─── Cycle de vie ──────────────────────────────────────────────────────────

  async start(): Promise<void> {
    const { socketPath } = this.opts;
    fs.mkdirSync(path.dirname(socketPath), { recursive: true, mode: 0o700 });
    // Une instance unique d'OtterDesk tourne (verrou applicatif) : un socket restant
    // est un résidu d'un arrêt brutal.
    if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);

    const server = net.createServer((socket) => this.onConnection(socket));
    server.maxConnections = this.opts.maxConnections;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      // umask restrictif pendant la création du fichier socket, puis chmod explicite
      const previous = process.umask(0o177);
      server.listen(socketPath, () => {
        process.umask(previous);
        server.off("error", reject);
        resolve();
      });
    });
    fs.chmodSync(socketPath, 0o600);
    server.on("error", (e) => this.log(`erreur serveur : ${e.message}`));
    this.server = server;
    this.log(`pont VS Code à l'écoute sur ${socketPath}`);
  }

  /**
   * Arrêt immédiat et synchrone (utilisable pendant la fermeture de l'app) :
   * demandes en attente annulées, connexions fermées, socket supprimé.
   */
  stop(): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.resolve({ ok: false, code: "client-disconnected", error: "OtterDesk s'arrête" });
    }
    this.pending.clear();
    for (const c of this.conns.values()) this.close(c);
    this.conns.clear();
    const server = this.server;
    this.server = null;
    server?.close();
    try {
      fs.unlinkSync(this.opts.socketPath);
    } catch {
      /* déjà supprimé */
    }
  }

  // ─── Appairage ─────────────────────────────────────────────────────────────

  isPaired(): boolean {
    return this.opts.secrets.get() !== null;
  }

  startPairing(ttlMs = 120_000): { code: string; expiresAt: number } {
    this.pairing = { code: generatePairingCode(), expiresAt: Date.now() + ttlMs, attempts: 0 };
    this.emit("change");
    return { code: this.pairing.code, expiresAt: this.pairing.expiresAt };
  }

  cancelPairing(): void {
    this.pairing = null;
    this.emit("change");
  }

  /** Révoque l'appairage : secret supprimé, toutes les fenêtres VS Code déconnectées. */
  unpair(): void {
    this.opts.secrets.clear();
    this.pairing = null;
    for (const c of [...this.conns.values()]) this.close(c);
    this.emit("change");
  }

  private activePairing(): PairingSession | null {
    if (this.pairing && Date.now() > this.pairing.expiresAt) this.pairing = null;
    return this.pairing;
  }

  // ─── Accès aux fenêtres connectées ─────────────────────────────────────────

  getClients(): ConnectedClient[] {
    return [...this.conns.values()]
      .filter((c) => c.state === "registered" && c.client)
      .map((c) => ({
        client: c.client!,
        terminals: [...c.terminals.values()].sort((a, b) => a.index - b.index),
        connectedAt: c.connectedAt,
      }));
  }

  /** Transmet une commande au terminal exact d'une fenêtre VS Code et attend l'accusé de réception. */
  sendToTerminal(
    instanceId: string,
    terminalId: string,
    text: string,
    execute: boolean,
    reveal = false
  ): Promise<BridgeSendOutcome> {
    const conn = [...this.conns.values()].find(
      (c) => c.state === "registered" && c.client?.instanceId === instanceId
    );
    if (!conn) return Promise.resolve({ ok: false, code: "client-disconnected", error: "Fenêtre VS Code déconnectée" });
    if (!conn.terminals.has(terminalId)) {
      return Promise.resolve({ ok: false, code: "terminal-not-found", error: "Terminal introuvable" });
    }
    const requestId = randomUUID();
    return new Promise<BridgeSendOutcome>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve({ ok: false, code: "timeout", error: "VS Code n'a pas confirmé la réception" });
      }, this.opts.sendTimeoutMs);
      const revealSupported = conn.protocol >= 2;
      this.pending.set(requestId, {
        conn,
        resolve: (o) => resolve(reveal ? { ...o, revealSupported } : o),
        timer,
      });
      this.write(conn, {
        type: "send",
        requestId,
        terminalId,
        text,
        execute,
        // Un client v1 refuserait un champ inconnu : « reveal » n'est envoyé qu'en v2.
        ...(revealSupported ? { reveal } : {}),
      });
    });
  }

  // ─── Connexions ────────────────────────────────────────────────────────────

  private onConnection(socket: net.Socket): void {
    const conn: Conn = {
      id: randomUUID(),
      socket,
      decoder: new LineDecoder(),
      state: "new",
      protocol: 0,
      terminals: new Map(),
      connectedAt: Date.now(),
    };
    this.conns.set(conn.id, conn);
    socket.setEncoding("utf8");
    conn.timer = setTimeout(() => {
      if (conn.state !== "registered") this.fail(conn, "timeout", "Authentification trop lente");
    }, this.opts.handshakeTimeoutMs);

    socket.on("data", (chunk: string) => {
      let messages: unknown[];
      try {
        messages = conn.decoder.push(chunk);
      } catch {
        return this.fail(conn, "protocol", "Message illisible");
      }
      for (const raw of messages) {
        if (conn.state === "closed") return;
        const msg = parseClientMessage(raw);
        if (!msg) return this.fail(conn, "protocol", "Message invalide");
        this.handle(conn, msg);
      }
    });
    socket.on("close", () => this.onClosed(conn));
    socket.on("error", () => this.onClosed(conn));
  }

  private handle(conn: Conn, msg: ClientMessage): void {
    switch (conn.state) {
      case "new":
        if (msg.type === "hello") return this.onHello(conn, msg.protocol, msg.clientNonce);
        if (msg.type === "pair-hello") return this.onPairHello(conn, msg.protocol, msg.clientNonce);
        return this.fail(conn, "protocol", "Authentification requise");

      case "challenged":
        if (msg.type !== "auth") return this.fail(conn, "protocol", "Authentification attendue");
        return this.onAuth(conn, msg.clientProof);

      case "pair-challenged":
        if (msg.type !== "pair-auth") return this.fail(conn, "protocol", "Appairage attendu");
        return this.onPairAuth(conn, msg.clientProof);

      case "authenticated":
        if (msg.type !== "register") return this.fail(conn, "protocol", "Enregistrement attendu");
        return this.onRegister(conn, msg.client, msg.terminals);

      case "registered":
        return this.onRegisteredMessage(conn, msg);

      default:
        return;
    }
  }

  private onHello(conn: Conn, protocol: number, clientNonce: string): void {
    if (!BRIDGE_SUPPORTED_PROTOCOLS.includes(protocol)) {
      return this.fail(conn, "unsupported-version", "Version de protocole incompatible");
    }
    conn.protocol = protocol;
    const secret = this.opts.secrets.get();
    if (!secret) return this.fail(conn, "not-paired", "OtterDesk n'est appairé avec aucune extension VS Code");
    conn.clientNonce = clientNonce;
    conn.serverNonce = newNonce();
    conn.state = "challenged";
    this.write(conn, {
      type: "challenge",
      serverNonce: conn.serverNonce,
      serverProof: serverProof(secret, clientNonce, conn.serverNonce),
    });
  }

  private onAuth(conn: Conn, proof: string): void {
    const secret = this.opts.secrets.get();
    if (!secret || !conn.clientNonce || !conn.serverNonce) return this.fail(conn, "not-paired", "Appairage révoqué");
    if (!safeEqualHex(proof, clientProof(secret, conn.serverNonce, conn.clientNonce))) {
      return this.fail(conn, "auth-failed", "Authentification refusée");
    }
    conn.state = "authenticated";
    this.write(conn, { type: "welcome", serverVersion: this.opts.serverVersion });
  }

  private onPairHello(conn: Conn, protocol: number, clientNonce: string): void {
    if (!BRIDGE_SUPPORTED_PROTOCOLS.includes(protocol)) {
      return this.fail(conn, "unsupported-version", "Version de protocole incompatible");
    }
    const session = this.activePairing();
    if (!session) {
      return this.fail(conn, "pairing-not-active", "Aucun appairage en cours : lancez « Connecter VS Code » dans OtterDesk");
    }
    conn.clientNonce = clientNonce;
    conn.serverNonce = newNonce();
    conn.pairingKey = derivePairingKey(session.code, clientNonce, conn.serverNonce);
    conn.state = "pair-challenged";
    this.write(conn, {
      type: "pair-challenge",
      serverNonce: conn.serverNonce,
      serverProof: pairServerProof(conn.pairingKey, clientNonce, conn.serverNonce),
    });
  }

  private onPairAuth(conn: Conn, proof: string): void {
    const session = this.activePairing();
    if (!session || !conn.pairingKey || !conn.clientNonce || !conn.serverNonce) {
      return this.fail(conn, "pairing-not-active", "L'appairage a expiré");
    }
    if (!safeEqualHex(proof, pairClientProof(conn.pairingKey, conn.serverNonce, conn.clientNonce))) {
      session.attempts++;
      if (session.attempts >= this.opts.maxPairingAttempts) {
        this.pairing = null;
        this.emit("change");
      }
      return this.fail(conn, "pairing-failed", "Code d'appairage incorrect");
    }
    // Un appairage réussi remplace le secret précédent (les anciennes sessions sont fermées).
    const secret = newSecret();
    try {
      this.opts.secrets.set(secret);
    } catch (e) {
      this.pairing = null;
      this.emit("change");
      return this.fail(conn, "pairing-failed", e instanceof Error ? e.message : "Stockage du secret impossible");
    }
    this.pairing = null;
    this.write(conn, { type: "pair-complete", ...sealSecret(conn.pairingKey, secret) });
    for (const c of [...this.conns.values()]) if (c !== conn && c.state !== "new") this.close(c);
    conn.socket.end();
    conn.state = "closed";
    this.log("appairage VS Code effectué");
    this.emit("paired");
    this.emit("change");
  }

  private onRegister(conn: Conn, client: BridgeClientInfo, terminals: BridgeTerminalInfo[]): void {
    // Reconnexion de la même fenêtre : l'ancienne connexion est remplacée.
    for (const other of [...this.conns.values()]) {
      if (other !== conn && other.client?.instanceId === client.instanceId) this.close(other);
    }
    if (conn.timer) clearTimeout(conn.timer);
    conn.client = client;
    conn.terminals = new Map(terminals.map((t) => [t.terminalId, t]));
    conn.state = "registered";
    this.log(`fenêtre VS Code connectée : ${client.workspaceName} (${terminals.length} terminal(aux))`);
    this.emit("change");
  }

  private onRegisteredMessage(conn: Conn, msg: ClientMessage): void {
    switch (msg.type) {
      case "terminals":
        conn.terminals = new Map(msg.terminals.map((t) => [t.terminalId, t]));
        break;
      case "terminal-added":
      case "terminal-updated":
        conn.terminals.set(msg.terminal.terminalId, msg.terminal);
        break;
      case "terminal-removed":
        conn.terminals.delete(msg.terminalId);
        break;
      case "send-result": {
        const p = this.pending.get(msg.requestId);
        // Un accusé ne peut venir que de la connexion à laquelle la demande a été envoyée.
        if (!p || p.conn !== conn) return;
        clearTimeout(p.timer);
        this.pending.delete(msg.requestId);
        p.resolve(
          msg.ok
            ? { ok: true, ...(msg.revealed !== undefined ? { revealed: msg.revealed } : {}) }
            : { ok: false, code: msg.code ?? "failed", error: msg.error }
        );
        return;
      }
      default:
        return this.fail(conn, "protocol", "Message inattendu");
    }
    this.emit("change");
  }

  // ─── Utilitaires ───────────────────────────────────────────────────────────

  private write(conn: Conn, msg: ServerMessage): void {
    if (conn.state === "closed" || conn.socket.destroyed) return;
    conn.socket.write(encodeMessage(msg));
  }

  private fail(conn: Conn, code: BridgeErrorCode, message: string): void {
    this.log(`connexion refusée (${code}) : ${message}`);
    this.write(conn, { type: "error", code, message });
    conn.state = "closed";
    conn.socket.end();
    setTimeout(() => conn.socket.destroy(), 200).unref();
  }

  private close(conn: Conn): void {
    conn.state = "closed";
    conn.socket.destroy();
    this.onClosed(conn);
  }

  private onClosed(conn: Conn): void {
    if (!this.conns.has(conn.id)) return;
    if (conn.timer) clearTimeout(conn.timer);
    const wasRegistered = conn.client !== undefined;
    conn.state = "closed";
    this.conns.delete(conn.id);
    for (const [id, p] of this.pending) {
      if (p.conn === conn) {
        clearTimeout(p.timer);
        this.pending.delete(id);
        p.resolve({ ok: false, code: "client-disconnected", error: "Fenêtre VS Code déconnectée" });
      }
    }
    if (wasRegistered) {
      this.log(`fenêtre VS Code déconnectée : ${conn.client?.workspaceName}`);
      this.emit("change");
    }
  }

  private log(message: string): void {
    this.opts.log?.(`[terminal-bridge] ${message}`);
  }
}

// Client du pont local VS Code → OtterDesk (Node pur, sans API VS Code : testable).
//
// Sécurité côté extension :
//  - le serveur doit prouver qu'il connaît le secret partagé (HMAC) AVANT que l'extension
//    n'accepte la moindre demande d'envoi : un faux serveur local est rejeté ;
//  - pendant l'appairage, le serveur doit prouver qu'il connaît le code affiché ;
//  - chaque demande d'envoi est revalidée (commande, terminal, état) par l'extension.
import net from "node:net";
import {
  BRIDGE_PROTOCOL_VERSION,
  LineDecoder,
  encodeMessage,
  parseServerMessage,
  type BridgeClientInfo,
  type BridgeSendErrorCode,
  type BridgeTerminalInfo,
  type ClientMessage,
} from "../../src/shared/terminalBridge/protocol";
import {
  clientProof,
  derivePairingKey,
  newNonce,
  openSecret,
  pairClientProof,
  pairServerProof,
  safeEqualHex,
  serverProof,
} from "../../src/shared/terminalBridge/crypto";

export type BridgeStatus =
  | "connecting"
  | "connected"
  | "waiting-for-otterdesk" // OtterDesk non lancé
  | "not-paired" // aucun secret, ou secret refusé par OtterDesk
  | "rejected" // le serveur n'a pas prouvé son identité
  | "stopped";

export interface SendRequestFromServer {
  terminalId: string;
  text: string;
  execute: boolean;
  /** Mettre le terminal et sa fenêtre au premier plan après la transmission. */
  reveal: boolean;
}

export interface SendOutcome {
  ok: boolean;
  code?: BridgeSendErrorCode;
  error?: string;
  revealed?: boolean;
}

export interface BridgeClientOptions {
  getSocketPath(): string | null;
  getSecret(): Promise<Buffer | null>;
  getRegistration(): { client: BridgeClientInfo; terminals: BridgeTerminalInfo[] };
  onSend(req: SendRequestFromServer): Promise<SendOutcome>;
  onStatus(status: BridgeStatus, detail?: string): void;
  log?(message: string): void;
  /** Délais successifs de reconnexion (ms). */
  retryDelaysMs?: number[];
}

const DEFAULT_RETRY = [1000, 2000, 5000, 10000, 15000];
const HANDSHAKE_TIMEOUT_MS = 10_000;

export class BridgeClient {
  private socket: net.Socket | null = null;
  private stopped = true;
  private registered = false;
  private retryIndex = 0;
  private retryTimer: NodeJS.Timeout | null = null;
  private status: BridgeStatus = "stopped";

  constructor(private readonly opts: BridgeClientOptions) {}

  get currentStatus(): BridgeStatus {
    return this.status;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.socket?.destroy();
    this.socket = null;
    this.registered = false;
    this.setStatus("stopped");
  }

  /** Reconnexion immédiate (secret modifié, dossier de travail changé…). */
  reconnectNow(): void {
    if (this.stopped) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.retryIndex = 0;
    const old = this.socket;
    this.socket = null;
    this.registered = false;
    old?.destroy();
    void this.connect();
  }

  // ─── Notifications de terminaux (après enregistrement uniquement) ─────────
  terminalAdded(t: BridgeTerminalInfo): void {
    this.post({ type: "terminal-added", terminal: t });
  }
  terminalUpdated(t: BridgeTerminalInfo): void {
    this.post({ type: "terminal-updated", terminal: t });
  }
  terminalRemoved(terminalId: string): void {
    this.post({ type: "terminal-removed", terminalId });
  }
  snapshot(terminals: BridgeTerminalInfo[]): void {
    this.post({ type: "terminals", terminals });
  }

  private post(msg: ClientMessage): void {
    if (this.registered && this.socket && !this.socket.destroyed) this.socket.write(encodeMessage(msg));
  }

  // ─── Connexion ─────────────────────────────────────────────────────────────

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const socketPath = this.opts.getSocketPath();
    if (!socketPath) return this.retry("waiting-for-otterdesk", "OtterDesk n'est pas lancé");
    const secret = await this.opts.getSecret();
    if (this.stopped) return;
    if (!secret) {
      // Sans secret, rien à faire jusqu'à l'appairage (reconnectNow sera appelé).
      return this.setStatus("not-paired", "Lancez « OtterDesk : Connecter à OtterDesk »");
    }

    this.setStatus("connecting");
    const socket = net.createConnection(socketPath);
    this.socket = socket;
    socket.setEncoding("utf8");
    const decoder = new LineDecoder();
    const clientNonce = newNonce();
    let serverNonce: string | null = null;
    let authenticated = false;
    let lastError: { status: BridgeStatus; detail: string } | null = null;
    const handshakeTimer = setTimeout(() => {
      if (!authenticated) {
        lastError = { status: "waiting-for-otterdesk", detail: "Pas de réponse d'OtterDesk" };
        socket.destroy();
      }
    }, HANDSHAKE_TIMEOUT_MS);

    const fail = (status: BridgeStatus, detail: string) => {
      lastError = { status, detail };
      socket.destroy();
    };

    socket.on("connect", () => {
      socket.write(encodeMessage({ type: "hello", protocol: BRIDGE_PROTOCOL_VERSION, clientNonce }));
    });

    socket.on("data", (chunk: string) => {
      let raws: unknown[];
      try {
        raws = decoder.push(chunk);
      } catch {
        return fail("rejected", "Réponse illisible du serveur");
      }
      for (const raw of raws) {
        const msg = parseServerMessage(raw);
        if (!msg) return fail("rejected", "Message invalide du serveur");

        if (msg.type === "error") {
          const status: BridgeStatus = msg.code === "not-paired" || msg.code === "auth-failed" ? "not-paired" : "rejected";
          return fail(status, msg.message);
        }
        if (!authenticated) {
          if (msg.type === "challenge" && serverNonce === null) {
            // Le serveur doit prouver qu'il connaît le secret partagé.
            if (!safeEqualHex(msg.serverProof, serverProof(secret, clientNonce, msg.serverNonce))) {
              return fail("rejected", "Le serveur n'a pas pu prouver qu'il s'agit d'OtterDesk");
            }
            serverNonce = msg.serverNonce;
            socket.write(encodeMessage({ type: "auth", clientProof: clientProof(secret, serverNonce, clientNonce) }));
            continue;
          }
          if (msg.type === "welcome" && serverNonce !== null) {
            authenticated = true;
            clearTimeout(handshakeTimer);
            const reg = this.opts.getRegistration();
            socket.write(encodeMessage({ type: "register", client: reg.client, terminals: reg.terminals }));
            this.registered = true;
            this.retryIndex = 0;
            this.setStatus("connected", `OtterDesk ${msg.serverVersion}`);
            continue;
          }
          return fail("rejected", "Séquence d'authentification inattendue");
        }
        if (msg.type === "send") {
          void this.handleSend(socket, msg.requestId, {
            terminalId: msg.terminalId,
            text: msg.text,
            execute: msg.execute,
            reveal: msg.reveal === true,
          });
          continue;
        }
        return fail("rejected", "Message inattendu du serveur");
      }
    });

    socket.on("error", (e: NodeJS.ErrnoException) => {
      if (!lastError) {
        lastError =
          e.code === "ENOENT" || e.code === "ECONNREFUSED"
            ? { status: "waiting-for-otterdesk", detail: "OtterDesk n'est pas lancé" }
            : { status: "waiting-for-otterdesk", detail: e.message };
      }
    });

    socket.on("close", () => {
      clearTimeout(handshakeTimer);
      if (this.socket !== socket) return; // remplacé par reconnectNow()
      this.socket = null;
      this.registered = false;
      if (this.stopped) return;
      const err = lastError ?? { status: "waiting-for-otterdesk" as BridgeStatus, detail: "Connexion perdue" };
      if (err.status === "not-paired") return this.setStatus("not-paired", err.detail);
      this.retry(err.status, err.detail);
    });
  }

  private async handleSend(socket: net.Socket, requestId: string, req: SendRequestFromServer): Promise<void> {
    let outcome: SendOutcome;
    try {
      outcome = await this.opts.onSend(req);
    } catch (e) {
      outcome = { ok: false, code: "failed", error: e instanceof Error ? e.message : String(e) };
    }
    if (!socket.destroyed) {
      socket.write(
        encodeMessage({
          type: "send-result",
          requestId,
          ok: outcome.ok,
          ...(outcome.code ? { code: outcome.code } : {}),
          ...(outcome.error ? { error: outcome.error.slice(0, 500) } : {}),
          ...(outcome.revealed !== undefined ? { revealed: outcome.revealed } : {}),
        })
      );
    }
  }

  private retry(status: BridgeStatus, detail: string): void {
    this.setStatus(status, detail);
    if (this.stopped || this.retryTimer) return;
    const delays = this.opts.retryDelaysMs ?? DEFAULT_RETRY;
    const delay = delays[Math.min(this.retryIndex, delays.length - 1)];
    this.retryIndex++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }

  private setStatus(status: BridgeStatus, detail?: string): void {
    this.status = status;
    this.opts.log?.(`état : ${status}${detail ? ` (${detail})` : ""}`);
    this.opts.onStatus(status, detail);
  }

  // ─── Appairage ─────────────────────────────────────────────────────────────

  /** Appaire l'extension avec OtterDesk à l'aide du code affiché ; retourne le secret partagé. */
  static pair(socketPath: string, code: string, timeoutMs = 15_000): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const socket = net.createConnection(socketPath);
      socket.setEncoding("utf8");
      const decoder = new LineDecoder();
      const clientNonce = newNonce();
      let pairingKey: Buffer | null = null;
      let settled = false;
      const done = (err: Error | null, secret?: Buffer) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        if (err) reject(err);
        else resolve(secret!);
      };
      const timer = setTimeout(() => done(new Error("OtterDesk ne répond pas")), timeoutMs);

      socket.on("connect", () =>
        socket.write(encodeMessage({ type: "pair-hello", protocol: BRIDGE_PROTOCOL_VERSION, clientNonce }))
      );
      socket.on("error", (e: NodeJS.ErrnoException) =>
        done(new Error(e.code === "ENOENT" || e.code === "ECONNREFUSED" ? "OtterDesk n'est pas lancé" : e.message))
      );
      socket.on("close", () => done(new Error("Connexion fermée par OtterDesk")));
      socket.on("data", (chunk: string) => {
        let raws: unknown[];
        try {
          raws = decoder.push(chunk);
        } catch {
          return done(new Error("Réponse illisible"));
        }
        for (const raw of raws) {
          const msg = parseServerMessage(raw);
          if (!msg) return done(new Error("Réponse invalide"));
          if (msg.type === "error") return done(new Error(msg.message));
          if (msg.type === "pair-challenge" && !pairingKey) {
            const key = derivePairingKey(code, clientNonce, msg.serverNonce);
            if (!safeEqualHex(msg.serverProof, pairServerProof(key, clientNonce, msg.serverNonce))) {
              return done(new Error("Code incorrect, ou serveur qui n'est pas OtterDesk"));
            }
            pairingKey = key;
            socket.write(encodeMessage({ type: "pair-auth", clientProof: pairClientProof(key, msg.serverNonce, clientNonce) }));
            continue;
          }
          if (msg.type === "pair-complete" && pairingKey) {
            try {
              return done(null, openSecret(pairingKey, msg));
            } catch {
              return done(new Error("Secret d'appairage invalide"));
            }
          }
          return done(new Error("Séquence d'appairage inattendue"));
        }
      });
    });
  }
}

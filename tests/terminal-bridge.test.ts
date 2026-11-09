// Tests d'intégration : vrai serveur OtterDesk (BridgeServer) ↔ vrai client de l'extension
// VS Code (BridgeClient), via un socket Unix temporaire. L'API VS Code est simulée.
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { BridgeServer, type SecretStore } from "../src/main/terminals/vscode/bridgeServer";
import { VSCodeProvider } from "../src/main/terminals/vscode/vscodeProvider";
import { TerminalService } from "../src/main/terminals/terminalService";
import { encodeMessage, type BridgeTerminalInfo } from "../src/shared/terminalBridge/protocol";
import { clientProof, newNonce, newSecret } from "../src/shared/terminalBridge/crypto";
import { BridgeClient, type BridgeStatus, type SendRequestFromServer } from "../vscode-extension/src/bridgeClient";

class MemorySecrets implements SecretStore {
  value: Buffer | null = null;
  get() { return this.value; }
  set(s: Buffer) { this.value = Buffer.from(s); }
  clear() { this.value = null; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "otb-"));
const socketPath = path.join(tmp, "b.sock");

async function waitFor(pred: () => boolean, label: string, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) throw new Error(`délai dépassé : ${label}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

interface FakeWindow {
  client: BridgeClient;
  status: BridgeStatus;
  received: SendRequestFromServer[];
  terminals: BridgeTerminalInfo[];
}

function fakeWindow(instanceId: string, workspaceName: string, terminals: BridgeTerminalInfo[], getSecret: () => Buffer | null): FakeWindow {
  const w: FakeWindow = { client: null as unknown as BridgeClient, status: "stopped", received: [], terminals };
  w.client = new BridgeClient({
    getSocketPath: () => (fs.existsSync(socketPath) ? socketPath : null),
    getSecret: async () => getSecret(),
    getRegistration: () => ({
      client: { instanceId, appName: "Visual Studio Code", workspaceName, workspaceFolders: [`/projets/${workspaceName}`] },
      terminals: w.terminals,
    }),
    onSend: async (req) => {
      w.received.push(req);
      return { ok: true };
    },
    onStatus: (s) => (w.status = s),
    retryDelaysMs: [50, 100, 200],
  });
  return w;
}

const term = (terminalId: string, name: string, index: number, state: BridgeTerminalInfo["state"] = "idle", runningCommand?: string): BridgeTerminalInfo => ({
  terminalId, name, index, state, shellIntegration: state !== "unknown", ...(runningCommand ? { runningCommand } : {}),
});

// Fonctionnalité macOS (socket Unix) : ignorée sous Windows.
describe("pont VS Code ↔ OtterDesk", { skip: process.platform === "win32" }, () => {
  const secrets = new MemorySecrets();
  let server: BridgeServer;
  let service: TerminalService;
  const windows: FakeWindow[] = [];
  const clientSecret: { value: Buffer | null } = { value: null };

  before(async () => {
    server = new BridgeServer({ socketPath, secrets, serverVersion: "test", sendTimeoutMs: 1000, handshakeTimeoutMs: 1000 });
    await server.start();
    service = new TerminalService([new VSCodeProvider(server)]);
  });

  after(async () => {
    for (const w of windows) w.client.stop();
    await server.stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("crée le socket avec des droits 0600", () => {
    assert.equal(fs.statSync(socketPath).mode & 0o777, 0o600);
  });

  it("sans appairage : l'extension reste « non appairée » et aucune cible n'est listée", async () => {
    const w = fakeWindow("win-a", "bulle-back-end", [], () => clientSecret.value);
    windows.push(w);
    w.client.start();
    await waitFor(() => w.status === "not-paired", "statut not-paired");
    const list = await service.list();
    assert.equal(list.providers[0].status, "not-paired");
    assert.equal(list.targets.length, 0);
  });

  it("refuse l'appairage sans session active, puis avec un mauvais code (3 essais max)", async () => {
    await assert.rejects(BridgeClient.pair(socketPath, "AAAA-BBBB"), /Aucun appairage en cours/);
    const { code } = server.startPairing();
    const wrong = code.startsWith("A") ? "BBBB-BBBB" : "AAAA-AAAA";
    // Le client détecte lui-même qu'OtterDesk ne connaît pas ce code (preuve serveur invalide).
    await assert.rejects(BridgeClient.pair(socketPath, wrong), /Code incorrect/);
    assert.equal(server.isPaired(), false);
    server.cancelPairing();
  });

  it("un client malveillant qui devine le code est bloqué après 3 essais", async () => {
    server.startPairing();
    for (let i = 0; i < 3; i++) {
      const reply = await rawExchange([
        { type: "pair-hello", protocol: 1, clientNonce: newNonce() },
        { type: "pair-auth", clientProof: "0".repeat(64) },
      ]);
      assert.match(reply, /pairing-failed/);
    }
    const after3 = await rawExchange([{ type: "pair-hello", protocol: 1, clientNonce: newNonce() }]);
    assert.match(after3, /pairing-not-active/);
  });

  it("appaire avec le bon code ; le secret n'est connu que des deux parties", async () => {
    const { code } = server.startPairing();
    const secret = await BridgeClient.pair(socketPath, code.toLowerCase().replace("-", " "));
    assert.equal(secret.length, 32);
    assert.deepEqual(secret, secrets.value);
    clientSecret.value = secret;
    windows[0].client.reconnectNow();
    await waitFor(() => windows[0].status === "connected", "fenêtre A connectée");
  });

  it("distingue deux fenêtres VS Code et des terminaux portant le même nom", async () => {
    windows[0].terminals = [term("a1", "zsh", 1), term("a2", "npm", 2), term("a3", "Claude Code", 3, "busy", "claude")];
    windows[0].client.snapshot(windows[0].terminals);
    const b = fakeWindow("win-b", "johanna-kinesiologue", [term("b1", "zsh", 1), term("b2", "npm", 2, "unknown")], () => clientSecret.value);
    windows.push(b);
    b.client.start();
    await waitFor(() => b.status === "connected", "fenêtre B connectée");
    await waitFor(() => server.getClients().length === 2 && server.getClients().every((c) => c.terminals.length >= 2), "2 fenêtres");

    const { targets } = await service.list();
    assert.equal(targets.length, 5);
    assert.equal(new Set(targets.map((t) => t.id)).size, 5, "identifiants uniques");
    const zsh = targets.filter((t) => t.name === "zsh");
    assert.equal(zsh.length, 2);
    assert.notEqual(zsh[0].groupId, zsh[1].groupId);
    assert.deepEqual(new Set(zsh.map((t) => t.groupLabel)), new Set(["VS Code — bulle-back-end", "VS Code — johanna-kinesiologue"]));
  });

  it("insère dans le terminal exact choisi (sans Entrée), et seulement là", async () => {
    const { targets } = await service.list();
    const target = targets.find((t) => t.groupLabel.endsWith("johanna-kinesiologue") && t.name === "zsh")!;
    const r = await service.send({ targetId: target.id, text: "docker compose up -d", mode: "insert" });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(windows[1].received, [{ terminalId: "b1", text: "docker compose up -d", execute: false, reveal: false }]);
    assert.equal(windows[0].received.length, 0);
  });

  it("exécute dans un terminal prêt ; refuse l'exécution dans un terminal occupé", async () => {
    const { targets } = await service.list();
    const zshA = targets.find((t) => t.id.endsWith(":a1"))!;
    const ok = await service.send({ targetId: zshA.id, text: "git status", mode: "execute" });
    assert.equal(ok.ok, true);
    assert.deepEqual(windows[0].received.at(-1), { terminalId: "a1", text: "git status", execute: true, reveal: false });

    const claude = targets.find((t) => t.id.endsWith(":a3"))!;
    assert.equal(claude.state, "busy");
    const busy = await service.send({ targetId: claude.id, text: "git status", mode: "execute" });
    assert.equal(!busy.ok && busy.code, "terminal-busy");
    // Insertion dans un terminal occupé : confirmation explicite exigée.
    const ins = await service.send({ targetId: claude.id, text: "git status", mode: "insert" });
    assert.equal(!ins.ok && ins.code, "confirmation-required");
  });

  it("exige une confirmation : état inconnu ou commande destructrice", async () => {
    const { targets } = await service.list();
    const unknown = targets.find((t) => t.id.endsWith(":b2"))!;
    const r1 = await service.send({ targetId: unknown.id, text: "npm test", mode: "execute" });
    assert.equal(!r1.ok && r1.code, "confirmation-required");
    const zshA = targets.find((t) => t.id.endsWith(":a1"))!;
    const r2 = await service.send({ targetId: zshA.id, text: "rm -rf dist", mode: "execute" });
    assert.equal(!r2.ok && r2.code, "confirmation-required");
    // Confirmation accordée par le processus principal (boîte de dialogue simulée).
    const prompts: string[] = [];
    const confirming = new TerminalService([new VSCodeProvider(server)], {
      confirm: async (p) => {
        prompts.push(p.reason);
        return true;
      },
    });
    const before = windows[0].received.length;
    const r3 = await confirming.send({ targetId: zshA.id, text: "rm -rf dist", mode: "execute" });
    assert.equal(r3.ok, true);
    assert.equal(prompts.length, 1);
    assert.match(prompts[0], /destructrice/);
    assert.equal(windows[0].received.length, before + 1);
  });

  it("bloque les doubles envois (double-clic) et les commandes multi-lignes", async () => {
    const { targets } = await service.list();
    const zshA = targets.find((t) => t.id.endsWith(":a1"))!;
    const before = windows[0].received.length;
    const [x, y] = await Promise.all([
      service.send({ targetId: zshA.id, text: "npm run dev", mode: "insert" }),
      service.send({ targetId: zshA.id, text: "npm run dev", mode: "insert" }),
    ]);
    assert.equal([x, y].filter((r) => r.ok).length, 1);
    const again = await service.send({ targetId: zshA.id, text: "npm run dev", mode: "insert" });
    assert.equal(!again.ok && again.code, "duplicate");
    assert.equal(windows[0].received.length, before + 1);
    const multi = await service.send({ targetId: zshA.id, text: "a\nb", mode: "insert" });
    assert.equal(!multi.ok && multi.code, "invalid-command");
  });

  it("refuse un client non authentifié et une preuve invalide", async () => {
    const r1 = await rawExchange([{ type: "register", client: {}, terminals: [] }]);
    assert.match(r1, /Authentification requise|protocol/);
    const r2 = await rawExchange([
      { type: "hello", protocol: 1, clientNonce: newNonce() },
      { type: "auth", clientProof: "0".repeat(64) },
    ]);
    assert.match(r2, /auth-failed/);
    const r3 = await rawExchange([{ type: "hello", protocol: 99, clientNonce: newNonce() }]);
    assert.match(r3, /unsupported-version/);
  });

  it("ferme une connexion qui envoie une ligne trop longue", async () => {
    const r = await rawExchangeRaw("x".repeat(70 * 1024));
    assert.match(r, /protocol|illisible/);
  });

  it("l'extension rejette un faux serveur et n'exécute rien", async () => {
    const fakePath = path.join(tmp, "fake.sock");
    const fake = new BridgeServer({ socketPath: fakePath, secrets: new MemorySecrets(), serverVersion: "x" });
    (fake as unknown as { opts: { secrets: MemorySecrets } }).opts.secrets.value = newSecret(); // autre secret
    await fake.start();
    let sends = 0;
    let status: BridgeStatus = "stopped";
    const c = new BridgeClient({
      getSocketPath: () => fakePath,
      getSecret: async () => clientSecret.value,
      getRegistration: () => ({ client: { instanceId: "x", appName: "x", workspaceName: "x", workspaceFolders: [] }, terminals: [] }),
      onSend: async () => { sends++; return { ok: true }; },
      onStatus: (s) => (status = s),
      retryDelaysMs: [5000],
    });
    c.start();
    await waitFor(() => status === "rejected", "faux serveur rejeté");
    c.stop();
    await fake.stop();
    assert.equal(sends, 0);
  });

  it("déconnexion d'une fenêtre : ses terminaux disparaissent, l'envoi est refusé", async () => {
    const { targets } = await service.list();
    const zshB = targets.find((t) => t.id.endsWith(":b1"))!;
    windows[1].client.stop();
    await waitFor(() => server.getClients().length === 1, "fenêtre B retirée");
    const r = await service.send({ targetId: zshB.id, text: "ls", mode: "insert" });
    assert.equal(!r.ok && r.code, "target-disconnected");
    assert.equal((await service.list()).targets.some((t) => t.id === zshB.id), false);
  });

  it("se reconnecte après un redémarrage d'OtterDesk avec les mêmes identifiants", async () => {
    const before = (await service.list()).targets.map((t) => t.id).sort();
    await server.stop();
    await waitFor(() => windows[0].status !== "connected", "déconnexion détectée");
    server = new BridgeServer({ socketPath, secrets, serverVersion: "test" });
    await server.start();
    service = new TerminalService([new VSCodeProvider(server)]);
    await waitFor(() => server.getClients().length === 1, "reconnexion", 5000);
    const afterIds = (await service.list()).targets.map((t) => t.id).sort();
    assert.deepEqual(afterIds, before);
  });

  it("la révocation déconnecte les fenêtres et l'extension repasse en « non appairée »", async () => {
    server.unpair();
    await waitFor(() => windows[0].status === "not-paired", "statut not-paired après révocation");
    assert.equal(server.getClients().length, 0);
  });
});

// Envoie des messages bruts (client non conforme) et renvoie la réponse du serveur.
function rawExchange(messages: object[]): Promise<string> {
  return new Promise((resolve) => {
    const s = net.createConnection(socketPath);
    let data = "";
    s.setEncoding("utf8");
    s.on("connect", async () => {
      for (const m of messages) {
        s.write(encodeMessage(m as never));
        await new Promise((r) => setTimeout(r, 120));
      }
    });
    s.on("data", (d: string) => (data += d));
    s.on("close", () => resolve(data));
    s.on("error", () => resolve(data));
    setTimeout(() => s.destroy(), 1500);
  });
}

function rawExchangeRaw(payload: string): Promise<string> {
  return new Promise((resolve) => {
    const s = net.createConnection(socketPath);
    let data = "";
    s.setEncoding("utf8");
    s.on("connect", () => s.write(payload));
    s.on("data", (d: string) => (data += d));
    s.on("close", () => resolve(data));
    s.on("error", () => resolve(data));
    setTimeout(() => s.destroy(), 1500);
  });
}

// ─── Affichage du terminal (« reveal ») et compatibilité protocole v1 ───────────
describe("affichage du terminal VS Code après l'envoi", { skip: process.platform === "win32" }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "otr-"));
  const sock = path.join(dir, "r.sock");
  const secrets = new MemorySecrets();
  let server: BridgeServer;
  let service: TerminalService;
  let client: BridgeClient;
  let status: BridgeStatus = "stopped";
  const received: SendRequestFromServer[] = [];
  let revealResult = true;

  before(async () => {
    secrets.value = newSecret();
    server = new BridgeServer({ socketPath: sock, secrets, serverVersion: "t" });
    await server.start();
    service = new TerminalService([new VSCodeProvider(server)]);
    client = new BridgeClient({
      getSocketPath: () => sock,
      getSecret: async () => secrets.value,
      getRegistration: () => ({
        client: { instanceId: "win-r", appName: "Visual Studio Code", workspaceName: "bulle-back-end", workspaceFolders: ["/p"] },
        terminals: [term("r1", "zsh", 1)],
      }),
      onSend: async (req) => {
        received.push(req);
        return req.reveal ? { ok: true, revealed: revealResult } : { ok: true };
      },
      onStatus: (s) => (status = s),
      retryDelaysMs: [50],
    });
    client.start();
    await waitFor(() => status === "connected" && server.getClients().length === 1, "client v2 connecté");
  });

  after(async () => {
    client.stop();
    server.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("transmet la demande d'affichage à l'extension, qui confirme l'affichage", async () => {
    const r = await service.send({ targetId: "vscode:win-r:r1", text: "npm run dev", mode: "insert", reveal: true });
    assert.equal(r.ok, true);
    assert.deepEqual(r.ok && r.reveal, { revealed: true });
    assert.equal(received.at(-1)?.reveal, true);
  });

  it("sans affichage demandé : demande transmise avec reveal=false, aucun résultat d'affichage", async () => {
    const r = await service.send({ targetId: "vscode:win-r:r1", text: "git status", mode: "insert", reveal: false });
    assert.equal(r.ok && r.reveal, undefined);
    assert.equal(received.at(-1)?.reveal, false);
  });

  it("affichage impossible côté VS Code : transmission réussie, signalée, sans renvoi", async () => {
    revealResult = false;
    const sends = received.length;
    const r = await service.send({ targetId: "vscode:win-r:r1", text: "ls -la", mode: "insert", reveal: true });
    revealResult = true;
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.reveal?.revealed, false);
    assert.equal(received.length, sends + 1);
  });

  it("extension v1 : la commande est transmise sans champ « reveal » (compatibilité)", async () => {
    const raw = net.createConnection(sock);
    raw.setEncoding("utf8");
    const lines: Record<string, unknown>[] = [];
    let buf = "";
    raw.on("data", (d: string) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        lines.push(JSON.parse(buf.slice(0, i)));
        buf = buf.slice(i + 1);
      }
    });
    await new Promise((r) => raw.on("connect", r));
    const cN = newNonce();
    raw.write(encodeMessage({ type: "hello", protocol: 1, clientNonce: cN }));
    await waitFor(() => lines.some((l) => l.type === "challenge"), "challenge v1");
    const ch = lines.find((l) => l.type === "challenge") as { serverNonce: string };
    raw.write(encodeMessage({ type: "auth", clientProof: clientProof(secrets.value!, ch.serverNonce, cN) }));
    await waitFor(() => lines.some((l) => l.type === "welcome"), "welcome v1");
    raw.write(encodeMessage({
      type: "register",
      client: { instanceId: "win-v1", appName: "Visual Studio Code", workspaceName: "ancien", workspaceFolders: [] },
      terminals: [term("v1t", "zsh", 1)],
    }));
    await waitFor(() => server.getClients().some((c) => c.client.instanceId === "win-v1"), "client v1 enregistré");
    const pending = service.send({ targetId: "vscode:win-v1:v1t", text: "ls", mode: "insert", reveal: true });
    await waitFor(() => lines.some((l) => l.type === "send"), "send reçu par le client v1");
    const sent = lines.find((l) => l.type === "send") as Record<string, unknown>;
    assert.equal("reveal" in sent, false, "aucun champ inconnu envoyé à un client v1");
    raw.write(encodeMessage({ type: "send-result", requestId: sent.requestId as string, ok: true }));
    const r = await pending;
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.reveal?.revealed, false);
    assert.match((r.ok && r.reveal?.message) || "", /Mettez à jour l'extension/);
    raw.destroy();
  });
});

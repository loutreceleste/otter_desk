// Protocole du pont local OtterDesk ↔ extension VS Code.
// Transport : socket Unix (fichier, droits 0600), un message JSON par ligne.
//
// Séquence normale (client déjà appairé, secret partagé K) :
//   C → S  hello            { clientNonce }
//   S → C  challenge        { serverNonce, serverProof = HMAC(K, server|cN|sN) }   ← le client authentifie le serveur
//   C → S  auth             { clientProof = HMAC(K, client|sN|cN) }                ← le serveur authentifie le client
//   S → C  welcome
//   C → S  register         { client, terminals }
//   C → S  terminal-added / terminal-updated / terminal-removed / terminals (resynchronisation)
//   S → C  send             { requestId, terminalId, text, execute }
//   C → S  send-result      { requestId, ok, code?, error? }
//
// Appairage (code affiché dans OtterDesk, saisi dans VS Code) :
//   C → S  pair-hello       { clientNonce }
//   S → C  pair-challenge   { serverNonce, serverProof = HMAC(Kcode, …) }          ← le serveur prouve connaître le code
//   C → S  pair-auth        { clientProof = HMAC(Kcode, …) }                       ← le client prouve connaître le code
//   S → C  pair-complete    { secret K chiffré AES-256-GCM avec une clé dérivée du code }
// Le code et K ne circulent jamais en clair.

// v2 : demande de mise au premier plan (« reveal ») dans « send » / « send-result ».
// Le serveur accepte encore les clients v1 (sans mise au premier plan).
export const BRIDGE_PROTOCOL_VERSION = 2;
export const BRIDGE_SUPPORTED_PROTOCOLS: readonly number[] = [1, 2];
export const BRIDGE_MAX_LINE_BYTES = 64 * 1024;
/** Fichier pointeur (dans le dossier de données d'OtterDesk) indiquant le chemin du socket. */
export const BRIDGE_POINTER_FILE = "terminal-bridge.json";
export const BRIDGE_SOCKET_FILE = "terminal-bridge.sock";

export type BridgeTerminalState = "idle" | "busy" | "unknown";

export interface BridgeTerminalInfo {
  terminalId: string;
  name: string;
  index: number;
  state: BridgeTerminalState;
  runningCommand?: string;
  cwd?: string;
  shellIntegration: boolean;
}

export interface BridgeClientInfo {
  instanceId: string;
  appName: string;
  workspaceName: string;
  workspaceFolders: string[];
  remoteName?: string;
}

export type BridgeSendErrorCode =
  | "terminal-not-found"
  | "terminal-busy"
  | "invalid-command"
  | "failed";

export type ClientMessage =
  | { type: "hello"; protocol: number; clientNonce: string }
  | { type: "auth"; clientProof: string }
  | { type: "pair-hello"; protocol: number; clientNonce: string }
  | { type: "pair-auth"; clientProof: string }
  | { type: "register"; client: BridgeClientInfo; terminals: BridgeTerminalInfo[] }
  | { type: "terminals"; terminals: BridgeTerminalInfo[] }
  | { type: "terminal-added"; terminal: BridgeTerminalInfo }
  | { type: "terminal-updated"; terminal: BridgeTerminalInfo }
  | { type: "terminal-removed"; terminalId: string }
  | { type: "send-result"; requestId: string; ok: boolean; code?: BridgeSendErrorCode; error?: string; revealed?: boolean };

export type BridgeErrorCode =
  | "protocol"
  | "unsupported-version"
  | "not-paired"
  | "auth-failed"
  | "pairing-not-active"
  | "pairing-failed"
  | "timeout";

export type ServerMessage =
  | { type: "challenge"; serverNonce: string; serverProof: string }
  | { type: "welcome"; serverVersion: string }
  | { type: "pair-challenge"; serverNonce: string; serverProof: string }
  | { type: "pair-complete"; iv: string; ciphertext: string; tag: string }
  | { type: "send"; requestId: string; terminalId: string; text: string; execute: boolean; reveal?: boolean }
  | { type: "error"; code: BridgeErrorCode; message: string };

// ─── Validation ─────────────────────────────────────────────────────────────

const HEX64 = /^[0-9a-f]{64}$/;
// Pas de « : » : il sert de séparateur dans les identifiants de cible côté OtterDesk.
const ID = /^[A-Za-z0-9._-]{1,100}$/;
const B64 = /^[A-Za-z0-9+/=]{1,512}$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const optStr = (v: unknown, max: number) => v === undefined || str(v, max);
const keysOnly = (o: Obj, allowed: string[]) => Object.keys(o).every((k) => allowed.includes(k));

function isTerminalInfo(v: unknown): v is BridgeTerminalInfo {
  if (!isObj(v)) return false;
  return (
    keysOnly(v, ["terminalId", "name", "index", "state", "runningCommand", "cwd", "shellIntegration"]) &&
    str(v.terminalId, 100) && ID.test(v.terminalId) &&
    str(v.name, 200) &&
    Number.isInteger(v.index) && (v.index as number) >= 1 && (v.index as number) <= 1000 &&
    (v.state === "idle" || v.state === "busy" || v.state === "unknown") &&
    optStr(v.runningCommand, 500) &&
    optStr(v.cwd, 4096) &&
    typeof v.shellIntegration === "boolean"
  );
}

function isClientInfo(v: unknown): v is BridgeClientInfo {
  if (!isObj(v)) return false;
  return (
    keysOnly(v, ["instanceId", "appName", "workspaceName", "workspaceFolders", "remoteName"]) &&
    str(v.instanceId, 100) && ID.test(v.instanceId) &&
    str(v.appName, 100) &&
    str(v.workspaceName, 300) &&
    Array.isArray(v.workspaceFolders) && v.workspaceFolders.length <= 50 &&
    v.workspaceFolders.every((f) => str(f, 4096)) &&
    optStr(v.remoteName, 100)
  );
}

const isTerminalList = (v: unknown): v is BridgeTerminalInfo[] =>
  Array.isArray(v) && v.length <= 500 && v.every(isTerminalInfo);

/** Valide strictement un message client (champs inconnus refusés). */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (!isObj(raw) || typeof raw.type !== "string") return null;
  const m = raw;
  switch (m.type) {
    case "hello":
    case "pair-hello":
      return keysOnly(m, ["type", "protocol", "clientNonce"]) && Number.isInteger(m.protocol) &&
        str(m.clientNonce, 64) && HEX64.test(m.clientNonce)
        ? (m as ClientMessage) : null;
    case "auth":
    case "pair-auth":
      return keysOnly(m, ["type", "clientProof"]) && str(m.clientProof, 64) && HEX64.test(m.clientProof)
        ? (m as ClientMessage) : null;
    case "register":
      return keysOnly(m, ["type", "client", "terminals"]) && isClientInfo(m.client) && isTerminalList(m.terminals)
        ? (m as ClientMessage) : null;
    case "terminals":
      return keysOnly(m, ["type", "terminals"]) && isTerminalList(m.terminals) ? (m as ClientMessage) : null;
    case "terminal-added":
    case "terminal-updated":
      return keysOnly(m, ["type", "terminal"]) && isTerminalInfo(m.terminal) ? (m as ClientMessage) : null;
    case "terminal-removed":
      return keysOnly(m, ["type", "terminalId"]) && str(m.terminalId, 100) && ID.test(m.terminalId)
        ? (m as ClientMessage) : null;
    case "send-result":
      return keysOnly(m, ["type", "requestId", "ok", "code", "error", "revealed"]) &&
        (m.revealed === undefined || typeof m.revealed === "boolean") &&
        str(m.requestId, 100) && ID.test(m.requestId) && typeof m.ok === "boolean" &&
        (m.code === undefined || ["terminal-not-found", "terminal-busy", "invalid-command", "failed"].includes(m.code as string)) &&
        optStr(m.error, 500)
        ? (m as ClientMessage) : null;
    default:
      return null;
  }
}

/** Valide strictement un message serveur (utilisé par l'extension). */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (!isObj(raw) || typeof raw.type !== "string") return null;
  const m = raw;
  switch (m.type) {
    case "challenge":
    case "pair-challenge":
      return keysOnly(m, ["type", "serverNonce", "serverProof"]) &&
        str(m.serverNonce, 64) && HEX64.test(m.serverNonce) && str(m.serverProof, 64) && HEX64.test(m.serverProof)
        ? (m as ServerMessage) : null;
    case "welcome":
      return keysOnly(m, ["type", "serverVersion"]) && str(m.serverVersion, 50) ? (m as ServerMessage) : null;
    case "pair-complete":
      return keysOnly(m, ["type", "iv", "ciphertext", "tag"]) &&
        str(m.iv, 512) && B64.test(m.iv) && str(m.ciphertext, 512) && B64.test(m.ciphertext) && str(m.tag, 512) && B64.test(m.tag)
        ? (m as ServerMessage) : null;
    case "send":
      return keysOnly(m, ["type", "requestId", "terminalId", "text", "execute", "reveal"]) &&
        str(m.requestId, 100) && ID.test(m.requestId) && str(m.terminalId, 100) && ID.test(m.terminalId) &&
        str(m.text, 10000) && typeof m.execute === "boolean" &&
        (m.reveal === undefined || typeof m.reveal === "boolean")
        ? (m as ServerMessage) : null;
    case "error":
      return keysOnly(m, ["type", "code", "message"]) && str(m.code, 50) && str(m.message, 500)
        ? (m as ServerMessage) : null;
    default:
      return null;
  }
}

// ─── Découpage en lignes ────────────────────────────────────────────────────

export function encodeMessage(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg) + "\n";
}

/**
 * Accumule les octets reçus et produit des objets JSON, ligne par ligne.
 * Lève une erreur si une ligne dépasse la taille maximale ou n'est pas du JSON.
 */
export class LineDecoder {
  private buffer = "";
  constructor(private readonly maxLineBytes = BRIDGE_MAX_LINE_BYTES) {}

  push(chunk: string): unknown[] {
    this.buffer += chunk;
    const out: unknown[] = [];
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      if (line.length > this.maxLineBytes) throw new Error("ligne trop longue");
      if (line.trim().length === 0) continue;
      out.push(JSON.parse(line));
    }
    if (this.buffer.length > this.maxLineBytes) throw new Error("ligne trop longue");
    return out;
  }
}

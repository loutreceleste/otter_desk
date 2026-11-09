// Validation des requêtes d'envoi reçues du renderer (module pur, sans Electron : testable).
//
// Le renderer est considéré comme NON fiable pour tout ce qui touche à la sécurité :
//  - il ne transmet qu'une référence (commandId + step) à une commande enregistrée ;
//    le texte envoyé est relu en base par le processus principal ;
//  - il ne peut ni fournir de texte libre, ni lever une confirmation (« confirmed ») :
//    toute clé inconnue rend la requête invalide ;
//  - les confirmations sont décidées et affichées par le processus principal
//    (TerminalService + boîte de dialogue native).
import type { SendCommandRequest, SendRequest, SendResult } from "../../shared/terminalTypes";
import { parseCommandSteps } from "../../shared/commandSteps";

const ALLOWED_KEYS = new Set(["targetId", "commandId", "step", "mode", "reveal"]);
const MAX_TARGET_ID = 300;
const MAX_STEPS = 100;

export class InvalidSendRequestError extends Error {}

/** Valide strictement la forme de la requête IPC ; lève InvalidSendRequestError sinon. */
export function parseSendCommandRequest(v: unknown): SendCommandRequest {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new InvalidSendRequestError("Requête invalide");
  const r = v as Record<string, unknown>;
  for (const k of Object.keys(r)) {
    if (!ALLOWED_KEYS.has(k)) throw new InvalidSendRequestError(`Champ non autorisé : ${k}`);
  }
  if (typeof r.targetId !== "string" || r.targetId.length === 0 || r.targetId.length > MAX_TARGET_ID) {
    throw new InvalidSendRequestError("Cible invalide");
  }
  if (!Number.isSafeInteger(r.commandId) || (r.commandId as number) <= 0) {
    throw new InvalidSendRequestError("Commande invalide");
  }
  if (!Number.isSafeInteger(r.step) || (r.step as number) < 0 || (r.step as number) >= MAX_STEPS) {
    throw new InvalidSendRequestError("Étape invalide");
  }
  if (r.mode !== "insert" && r.mode !== "execute") throw new InvalidSendRequestError("Mode invalide");
  if (r.reveal !== undefined && typeof r.reveal !== "boolean") {
    throw new InvalidSendRequestError("Option d'affichage invalide");
  }
  return {
    targetId: r.targetId,
    commandId: r.commandId as number,
    step: r.step as number,
    mode: r.mode,
    reveal: r.reveal === true,
  };
}

/**
 * Transforme une requête IPC brute en requête interne : validation stricte, puis texte
 * relu en base (resolveCommandText) et découpé en étapes comme dans l'interface.
 */
export function buildSendRequest(
  raw: unknown,
  resolveCommandText: (commandId: number) => string | null
): { ok: true; request: SendRequest } | { ok: false; result: SendResult } {
  let parsed: SendCommandRequest;
  try {
    parsed = parseSendCommandRequest(raw);
  } catch (e) {
    return {
      ok: false,
      result: { ok: false, code: "invalid-request", message: e instanceof Error ? e.message : "Requête invalide" },
    };
  }
  const stored = resolveCommandText(parsed.commandId);
  if (stored === null) {
    return { ok: false, result: { ok: false, code: "command-not-found", message: "Cette commande n'existe plus." } };
  }
  const step = parseCommandSteps(stored)[parsed.step];
  if (!step) {
    return { ok: false, result: { ok: false, code: "command-not-found", message: "Cette étape n'existe plus." } };
  }
  return {
    ok: true,
    request: { targetId: parsed.targetId, text: step.cmd, mode: parsed.mode, reveal: parsed.reveal === true },
  };
}

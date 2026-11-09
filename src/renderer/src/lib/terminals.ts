import type {
  PairingInfo,
  SendCommandRequest,
  SendResult,
  TerminalListResult,
} from "../../../shared/terminalTypes";

/** La fonctionnalité « Envoyer vers un terminal » n'existe que sur macOS. */
export const terminalsSupported = window.api.platform === "darwin";

export const listTerminals = (): Promise<TerminalListResult> => window.api.terminals.list();
export const sendToTerminal = (req: SendCommandRequest): Promise<SendResult> => window.api.terminals.send(req);
export const startPairing = (providerId: string): Promise<PairingInfo> =>
  window.api.terminals.startPairing(providerId);
export const cancelPairing = (providerId: string): Promise<void> => window.api.terminals.cancelPairing(providerId);
export const unpairProvider = (providerId: string): Promise<void> => window.api.terminals.unpair(providerId);
export const onTerminalsChanged = (listener: () => void): (() => void) => window.api.terminals.onChanged(listener);
export const onTerminalsPaired = (listener: () => void): (() => void) => window.api.terminals.onPaired(listener);

// ─── Dernier terminal utilisé, par projet (préférence locale) ───────────────
const key = (projectId: number) => `otterdesk.lastTerminal.${projectId}`;

export function getLastTarget(projectId: number): string | null {
  try {
    return window.localStorage.getItem(key(projectId));
  } catch {
    return null;
  }
}

export function setLastTarget(projectId: number, targetId: string): void {
  try {
    window.localStorage.setItem(key(projectId), targetId);
  } catch {
    /* stockage indisponible : simple confort, sans conséquence */
  }
}

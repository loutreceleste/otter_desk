// Mise en place de l'envoi de commandes vers les terminaux (macOS uniquement).
import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BRIDGE_POINTER_FILE, BRIDGE_PROTOCOL_VERSION, BRIDGE_SOCKET_FILE } from "../../shared/terminalBridge/protocol";
import type { PairingInfo, SendResult, TerminalListResult } from "../../shared/terminalTypes";
import { ITerm2Provider } from "./iterm2/iterm2Provider";
import { TerminalAppProvider } from "./terminalApp/terminalAppProvider";
import { buildSendRequest } from "./sendRequest";
import { TerminalService, type ConfirmFn, type ConfirmationPrompt } from "./terminalService";
import { BridgeServer } from "./vscode/bridgeServer";
import { SafeStorageSecretStore } from "./vscode/secretStore";
import { VSCODE_PROVIDER_ID, VSCodeProvider } from "./vscode/vscodeProvider";

// Limite de longueur d'un chemin de socket Unix sous macOS (sun_path : 104 octets).
const MAX_SOCKET_PATH = 100;

function resolveSocketPath(userDataPath: string): string {
  const preferred = path.join(userDataPath, BRIDGE_SOCKET_FILE);
  if (Buffer.byteLength(preferred) <= MAX_SOCKET_PATH) return preferred;
  const dir = path.join(os.tmpdir(), `otterdesk-${process.getuid?.() ?? "user"}`);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  return path.join(dir, BRIDGE_SOCKET_FILE);
}

export interface TerminalsHandle {
  service: TerminalService;
  bridge: BridgeServer;
  dispose(): void;
}

export async function createTerminals(opts: {
  userDataPath: string;
  appVersion: string;
  log: (m: string) => void;
  /** Confirmation affichée par le processus principal (boîte de dialogue native). */
  confirm: ConfirmFn;
}): Promise<TerminalsHandle> {
  const socketPath = resolveSocketPath(opts.userDataPath);
  const bridge = new BridgeServer({
    socketPath,
    secrets: new SafeStorageSecretStore(path.join(opts.userDataPath, "terminal-bridge.secret"), opts.log),
    serverVersion: opts.appVersion,
    log: opts.log,
  });
  await bridge.start();

  // Fichier pointeur lu par l'extension VS Code pour trouver le socket.
  const pointer = path.join(opts.userDataPath, BRIDGE_POINTER_FILE);
  fs.writeFileSync(
    pointer,
    JSON.stringify({ socketPath, protocol: BRIDGE_PROTOCOL_VERSION, pid: process.pid }, null, 2),
    { mode: 0o600 }
  );

  const service = new TerminalService([new VSCodeProvider(bridge), new ITerm2Provider(), new TerminalAppProvider()], {
    confirm: opts.confirm,
  });
  return {
    service,
    bridge,
    dispose() {
      service.dispose();
      try {
        fs.unlinkSync(pointer);
      } catch {
        /* absent */
      }
    },
  };
}

// ─── IPC ─────────────────────────────────────────────────────────────────────

const UNSUPPORTED: TerminalListResult = { supported: false, providers: [], targets: [] };

/**
 * Confirmation native, affichée par le processus principal : le renderer ne peut ni la
 * contourner ni y répondre à la place de l'utilisateur. « Annuler » est le choix par
 * défaut (Entrée, Échap). Sans fenêtre visible, la demande est refusée.
 */
export function nativeConfirm(getWindow: () => BrowserWindow | null): ConfirmFn {
  return async (p: ConfirmationPrompt) => {
    const win = getWindow();
    if (!win || win.isDestroyed() || !win.isVisible()) return false;
    const action = p.mode === "execute" ? "Exécuter" : "Insérer";
    const { response } = await dialog.showMessageBox(win, {
      type: "warning",
      buttons: ["Annuler", action],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: "OtterDesk",
      message: p.mode === "execute" ? "Exécuter la commande ?" : "Insérer la commande ?",
      detail: `${p.reason}\n\nCible : ${p.targetLabel}\nCommande : ${p.text}`,
    });
    return response === 1;
  };
}

/**
 * Enregistre les handlers IPC « terminals:* ».
 * Sans handle (Windows, ou échec d'initialisation), la fonctionnalité est signalée
 * comme non prise en charge et aucun service n'est démarré.
 */
export function registerTerminalIpc(
  handle: TerminalsHandle | null,
  getWindow: () => BrowserWindow | null,
  resolveCommandText: (commandId: number) => string | null
): void {
  // Seule l'interface de la fenêtre principale peut piloter les terminaux.
  const fromMainWindow = (e: IpcMainInvokeEvent): boolean => {
    const win = getWindow();
    return Boolean(win && !win.isDestroyed() && e.sender === win.webContents && e.senderFrame === win.webContents.mainFrame);
  };

  ipcMain.handle("terminals:list", async (): Promise<TerminalListResult> => {
    if (!handle) return UNSUPPORTED;
    return handle.service.list();
  });

  ipcMain.handle("terminals:send", async (e, raw: unknown): Promise<SendResult> => {
    if (!handle) return { ok: false, code: "failed", message: "Fonction non disponible sur ce système." };
    if (!fromMainWindow(e)) return { ok: false, code: "invalid-request", message: "Origine de la requête refusée." };
    // Requête validée strictement, texte relu en base : rien de sensible ne vient du renderer.
    const built = buildSendRequest(raw, resolveCommandText);
    if (!built.ok) return built.result;
    return handle.service.send(built.request);
  });

  ipcMain.handle("terminals:pairing:start", (e, providerId: unknown): PairingInfo => {
    if (!handle || !fromMainWindow(e) || providerId !== VSCODE_PROVIDER_ID) throw new Error("Appairage non disponible");
    return handle.bridge.startPairing();
  });

  ipcMain.handle("terminals:pairing:cancel", (e, providerId: unknown) => {
    if (handle && fromMainWindow(e) && providerId === VSCODE_PROVIDER_ID) handle.bridge.cancelPairing();
  });

  ipcMain.handle("terminals:unpair", (e, providerId: unknown) => {
    if (handle && fromMainWindow(e) && providerId === VSCODE_PROVIDER_ID) handle.bridge.unpair();
  });

  if (handle) {
    // Notifie le renderer : terminal ouvert/fermé, fenêtre connectée/déconnectée, appairage.
    let timer: NodeJS.Timeout | null = null;
    handle.service.on("change", () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        const win = getWindow();
        if (win && !win.isDestroyed()) win.webContents.send("terminals:changed");
      }, 150);
    });
    handle.bridge.on("paired", () => {
      const win = getWindow();
      if (win && !win.isDestroyed()) win.webContents.send("terminals:paired");
    });
  }
}

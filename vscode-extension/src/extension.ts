// Extension compagnon « OtterDesk — Terminal Bridge ».
// Chaque fenêtre VS Code exécute sa propre instance de l'extension (installée une seule fois) :
// elle s'enregistre auprès d'OtterDesk avec un identifiant de fenêtre, publie ses terminaux
// et exécute les demandes d'envoi authentifiées.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import { checkSendableCommand } from "../../src/shared/commandSafety";
import { BRIDGE_POINTER_FILE, BRIDGE_SOCKET_FILE, type BridgeClientInfo } from "../../src/shared/terminalBridge/protocol";
import { BridgeClient, type BridgeStatus, type SendOutcome } from "./bridgeClient";
import { TerminalTracker } from "./terminalTracker";

const SECRET_KEY = "otterdesk.bridgeSecret";

const STATUS_TEXT: Record<BridgeStatus, { text: string; tooltip: string }> = {
  connecting: { text: "$(sync~spin) OtterDesk", tooltip: "Connexion à OtterDesk…" },
  connected: { text: "$(terminal) OtterDesk", tooltip: "Connecté à OtterDesk" },
  "waiting-for-otterdesk": { text: "$(debug-disconnect) OtterDesk", tooltip: "OtterDesk n'est pas lancé" },
  "not-paired": { text: "$(link) OtterDesk", tooltip: "Non appairé : cliquez pour connecter" },
  rejected: { text: "$(warning) OtterDesk", tooltip: "Connexion refusée" },
  stopped: { text: "$(circle-slash) OtterDesk", tooltip: "Arrêté" },
};

function dataDirectory(): string {
  const configured = vscode.workspace.getConfiguration("otterdesk").get<string>("dataDirectory")?.trim();
  if (process.env.OTTERDESK_DATA_DIR) return process.env.OTTERDESK_DATA_DIR;
  if (configured) return configured.replace(/^~(?=$|\/)/, os.homedir());
  return path.join(os.homedir(), "Library", "Application Support", "otter-desk");
}

/** Chemin du socket d'OtterDesk : fichier pointeur, sinon emplacement par défaut. */
function resolveSocketPath(): string | null {
  const dir = dataDirectory();
  try {
    const pointer = JSON.parse(fs.readFileSync(path.join(dir, BRIDGE_POINTER_FILE), "utf8")) as { socketPath?: unknown };
    if (typeof pointer.socketPath === "string" && path.isAbsolute(pointer.socketPath) && pointer.socketPath.endsWith(".sock")) {
      return fs.existsSync(pointer.socketPath) ? pointer.socketPath : null;
    }
  } catch {
    /* pas de pointeur */
  }
  const fallback = path.join(dir, BRIDGE_SOCKET_FILE);
  return fs.existsSync(fallback) ? fallback : null;
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("OtterDesk");
  const log = (m: string) => output.appendLine(`[${new Date().toLocaleTimeString()}] ${m}`);
  const instanceId = randomUUID(); // identifiant éphémère de cette fenêtre

  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10);
  statusItem.command = "otterdesk.showStatus";
  let lastDetail = "";
  const showStatus = (status: BridgeStatus, detail?: string) => {
    lastDetail = detail ?? "";
    statusItem.text = STATUS_TEXT[status].text;
    statusItem.tooltip = `${STATUS_TEXT[status].tooltip}${detail ? ` — ${detail}` : ""}`;
    statusItem.show();
  };

  const clientInfo = (): BridgeClientInfo => ({
    instanceId,
    appName: vscode.env.appName.slice(0, 100),
    workspaceName: (vscode.workspace.name ?? "Sans dossier").slice(0, 300),
    workspaceFolders: (vscode.workspace.workspaceFolders ?? []).slice(0, 50).map((f) => f.uri.fsPath.slice(0, 4096)),
    ...(vscode.env.remoteName ? { remoteName: vscode.env.remoteName.slice(0, 100) } : {}),
  });

  let client: BridgeClient;
  const tracker = new TerminalTracker({
    added: (t) => client.terminalAdded(t),
    updated: (t) => client.terminalUpdated(t),
    removed: (id) => client.terminalRemoved(id),
    snapshot: (all) => client.snapshot(all),
  });

  const handleSend = async (req: { terminalId: string; text: string; execute: boolean; reveal: boolean }): Promise<SendOutcome> => {
    // Revalidation locale (défense en profondeur) : même si OtterDesk a déjà vérifié.
    const check = checkSendableCommand(req.text);
    if (!check.ok || check.text !== req.text) return { ok: false, code: "invalid-command", error: "Commande refusée" };
    const terminal = tracker.find(req.terminalId);
    if (!terminal) return { ok: false, code: "terminal-not-found", error: "Terminal fermé" };
    if (req.execute && tracker.isBusy(terminal)) {
      return { ok: false, code: "terminal-busy", error: "Une commande est en cours dans ce terminal" };
    }
    terminal.sendText(req.text, req.execute);
    log(`${req.execute ? "exécution" : "insertion"} → « ${terminal.name} »`);
    if (!req.reveal) {
      // Sans affichage automatique : le terminal est rendu visible dans cette fenêtre
      // (panneau Terminal), sans changer de fenêtre ni d'application.
      terminal.show(req.execute);
      return { ok: true };
    }
    // Affichage : panneau Terminal visible, terminal exact sélectionné et focalisé, puis
    // CETTE fenêtre VS Code (celle du projet) mise au premier plan. OtterDesk active
    // ensuite l'application VS Code. Un échec ici ne renvoie jamais la commande.
    try {
      terminal.show(false);
      await vscode.commands.executeCommand("workbench.action.focusWindow");
      // Confirmation honnête : on attend que cette fenêtre ait réellement le focus.
      const revealed = await waitForWindowFocus(1500);
      if (!revealed) log("la fenêtre n'a pas reçu le focus");
      return { ok: true, revealed };
    } catch (e) {
      log(`affichage impossible : ${e instanceof Error ? e.message : e}`);
      return { ok: true, revealed: false };
    }
  };

  client = new BridgeClient({
    getSocketPath: resolveSocketPath,
    getSecret: async () => {
      const b64 = await context.secrets.get(SECRET_KEY);
      if (!b64) return null;
      const secret = Buffer.from(b64, "base64");
      return secret.length === 32 ? secret : null;
    },
    getRegistration: () => ({ client: clientInfo(), terminals: tracker.all() }),
    onSend: handleSend,
    onStatus: showStatus,
    log,
  });

  context.subscriptions.push(
    output,
    statusItem,
    tracker,
    { dispose: () => client.stop() },
    // Secret partagé entre toutes les fenêtres : un appairage fait dans une fenêtre
    // reconnecte automatiquement les autres.
    context.secrets.onDidChange((e) => {
      if (e.key === SECRET_KEY) client.reconnectNow();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => client.reconnectNow()),

    vscode.commands.registerCommand("otterdesk.pair", async (codeArg?: unknown) => {
      const socketPath = resolveSocketPath();
      if (!socketPath) {
        void vscode.window.showErrorMessage("OtterDesk n'est pas lancé (ou son dossier de données est introuvable).");
        return false;
      }
      const code =
        typeof codeArg === "string"
          ? codeArg
          : await vscode.window.showInputBox({
              title: "Connecter à OtterDesk",
              prompt: "Code affiché dans OtterDesk (Envoyer vers… › Connecter VS Code…)",
              placeHolder: "XXXX-XXXX",
              ignoreFocusOut: true,
              validateInput: (v) => (v.replace(/[^A-Za-z0-9]/g, "").length === 8 ? null : "Le code comporte 8 caractères"),
            });
      if (!code) return false;
      try {
        const secret = await BridgeClient.pair(socketPath, code);
        await context.secrets.store(SECRET_KEY, secret.toString("base64"));
        client.reconnectNow();
        log("appairage réussi");
        void vscode.window.showInformationMessage("VS Code est connecté à OtterDesk.");
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log(`appairage refusé : ${message}`);
        void vscode.window.showErrorMessage(`Appairage impossible : ${message}`);
        return false;
      }
    }),

    vscode.commands.registerCommand("otterdesk.unpair", async () => {
      await context.secrets.delete(SECRET_KEY);
      client.reconnectNow();
      void vscode.window.showInformationMessage("Appairage OtterDesk supprimé pour toutes les fenêtres VS Code.");
    }),

    vscode.commands.registerCommand("otterdesk.showStatus", async () => {
      const status = client.currentStatus;
      const detail = lastDetail ? ` (${lastDetail})` : "";
      const actions = status === "not-paired" ? ["Connecter…", "Journal"] : ["Reconnecter", "Journal"];
      const choice = await vscode.window.showInformationMessage(`OtterDesk : ${STATUS_TEXT[status].tooltip}${detail}`, ...actions);
      if (choice === "Connecter…") await vscode.commands.executeCommand("otterdesk.pair");
      if (choice === "Reconnecter") client.reconnectNow();
      if (choice === "Journal") output.show();
    }),

    // Utilisé par les tests automatisés et le dépannage : état + terminaux publiés.
    vscode.commands.registerCommand("otterdesk.debugState", () => ({
      status: client.currentStatus,
      instanceId,
      terminals: tracker.all(),
    }))
  );

  client.start();
  log(`extension active (fenêtre ${instanceId})`);
}

/** Résout true dès que la fenêtre VS Code courante a le focus (ou false après le délai). */
function waitForWindowFocus(timeoutMs: number): Promise<boolean> {
  if (vscode.window.state.focused) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sub.dispose();
      resolve(vscode.window.state.focused);
    }, timeoutMs);
    const sub = vscode.window.onDidChangeWindowState((s) => {
      if (s.focused) {
        clearTimeout(timer);
        sub.dispose();
        resolve(true);
      }
    });
  });
}

export function deactivate(): void {
  /* nettoyage via context.subscriptions */
}

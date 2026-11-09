// Fournisseur VS Code : expose les terminaux des fenêtres VS Code connectées au pont.
import os from "node:os";
import type { ProviderState, SendMode, SendResult, TerminalTarget } from "../../../shared/terminalTypes";
import type { SendOptions, TerminalProvider } from "../types";
import type { BridgeServer } from "./bridgeServer";

export const VSCODE_PROVIDER_ID = "vscode";

/** Raccourcit un chemin du dossier personnel en « ~/… » pour l'affichage. */
function tildify(p: string | undefined): string | undefined {
  if (!p) return p;
  const home = os.homedir();
  return p === home || p.startsWith(home + "/") ? "~" + p.slice(home.length) : p;
}

export function vscodeTargetId(instanceId: string, terminalId: string): string {
  return `${VSCODE_PROVIDER_ID}:${instanceId}:${terminalId}`;
}

export class VSCodeProvider implements TerminalProvider {
  readonly id = VSCODE_PROVIDER_ID;
  readonly label = "VS Code";

  constructor(private readonly bridge: BridgeServer) {}

  async list(): Promise<{ state: ProviderState; targets: TerminalTarget[] }> {
    if (!this.bridge.isPaired()) {
      return {
        state: {
          id: this.id,
          label: this.label,
          status: "not-paired",
          message: "Installez l'extension OtterDesk pour VS Code puis connectez-la.",
        },
        targets: [],
      };
    }
    const clients = this.bridge.getClients();
    if (clients.length === 0) {
      return {
        state: {
          id: this.id,
          label: this.label,
          status: "no-clients",
          message: "Aucune fenêtre VS Code connectée (extension OtterDesk active ?).",
        },
        targets: [],
      };
    }
    const targets: TerminalTarget[] = [];
    for (const { client, terminals } of clients) {
      const folders = client.workspaceFolders;
      const detail = [client.remoteName ? `distant : ${client.remoteName}` : null, tildify(folders[0]) ?? null]
        .filter(Boolean)
        .join(" · ");
      for (const t of terminals) {
        targets.push({
          id: vscodeTargetId(client.instanceId, t.terminalId),
          providerId: this.id,
          groupId: `${this.id}:${client.instanceId}`,
          groupLabel: `VS Code — ${client.workspaceName}`,
          groupDetail: detail || undefined,
          name: t.name,
          index: t.index,
          cwd: tildify(t.cwd),
          state: t.state,
          runningCommand: t.runningCommand,
          canInsert: true,
          canExecute: t.state !== "busy",
          note: t.state === "busy" ? "Terminal occupé : exécution automatique indisponible." : undefined,
        });
      }
    }
    return { state: { id: this.id, label: this.label, status: "ready" }, targets };
  }

  async send(target: TerminalTarget, text: string, mode: SendMode, options: SendOptions): Promise<SendResult> {
    const [, instanceId, terminalId] = target.id.split(":");
    const outcome = await this.bridge.sendToTerminal(instanceId, terminalId, text, mode === "execute", options.reveal);
    if (outcome.ok) {
      if (!options.reveal) return { ok: true, mode, targetLabel: "" };
      if (outcome.revealSupported === false) {
        return {
          ok: true,
          mode,
          targetLabel: "",
          reveal: { revealed: false, message: "Mettez à jour l'extension OtterDesk de VS Code pour afficher le terminal." },
        };
      }
      // L'extension sélectionne le terminal puis met SA fenêtre (celle du projet) au premier
      // plan ; elle ne confirme qu'après avoir constaté que la fenêtre a bien reçu le focus.
      // OtterDesk n'active pas VS Code lui-même : « open -a » viserait la première instance
      // de VS Code venue, pas forcément celle qui contient le terminal (vérifié en test).
      return outcome.revealed
        ? { ok: true, mode, targetLabel: "", reveal: { revealed: true } }
        : { ok: true, mode, targetLabel: "", reveal: { revealed: false, message: "VS Code n'a pas pu afficher sa fenêtre." } };
    }
    switch (outcome.code) {
      case "client-disconnected":
      case "terminal-not-found":
        return { ok: false, code: "target-disconnected", message: "Ce terminal n'est plus disponible." };
      case "terminal-busy":
        return { ok: false, code: "terminal-busy", message: outcome.error ?? "Terminal occupé." };
      case "timeout":
        return {
          ok: false,
          code: "timeout",
          message: "Pas de confirmation de VS Code : la commande a peut-être été transmise. Vérifiez le terminal avant de la renvoyer.",
        };
      default:
        return { ok: false, code: "failed", message: outcome.error ?? "Échec de l'envoi." };
    }
  }

  onDidChange(listener: () => void): () => void {
    this.bridge.on("change", listener);
    return () => this.bridge.off("change", listener);
  }

  dispose(): void {
    this.bridge.stop();
  }
}

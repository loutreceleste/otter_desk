// Service central : agrège les fournisseurs et applique les règles d'envoi.
// Les règles de sécurité vivent ici (processus principal) et non dans l'interface :
//  - la requête ne contient aucune « confirmation » venant du renderer ;
//  - lorsqu'une confirmation est requise, le service la demande lui-même via la fonction
//    `confirm` injectée (boîte de dialogue native en production) ; sans elle, l'envoi est refusé.
import { EventEmitter } from "node:events";
import { checkSendableCommand, destructiveReason } from "../../shared/commandSafety";
import type {
  ProviderState,
  SendMode,
  SendRequest,
  SendResult,
  TerminalListResult,
  TerminalTarget,
} from "../../shared/terminalTypes";
import { targetLabel, type TerminalProvider } from "./types";

const DUPLICATE_WINDOW_MS = 1500;
/** Après un délai dépassé, la commande a peut-être été transmise : renvoi bloqué plus longtemps. */
const UNCERTAIN_WINDOW_MS = 10_000;

/** Demande de confirmation présentée à l'utilisateur par le processus principal. */
export interface ConfirmationPrompt {
  mode: SendMode;
  /** Motif(s) de la confirmation (commande destructrice, état inconnu…). */
  reason: string;
  /** Cible lisible (« VS Code — projet › zsh »). */
  targetLabel: string;
  /** Texte exact qui sera transmis. */
  text: string;
}

/** Retourne true uniquement si l'utilisateur a explicitement accepté. */
export type ConfirmFn = (prompt: ConfirmationPrompt) => Promise<boolean>;

export interface TerminalServiceOptions {
  confirm?: ConfirmFn;
}

interface RecentSend {
  expiresAt: number;
  /** true : délai dépassé, transmission incertaine. */
  uncertain: boolean;
}

export class TerminalService extends EventEmitter {
  private readonly inFlight = new Set<string>();
  private readonly recent = new Map<string, RecentSend>();
  private readonly unsubscribers: Array<() => void> = [];
  private readonly confirm?: ConfirmFn;

  constructor(private readonly providers: TerminalProvider[], options: TerminalServiceOptions = {}) {
    super();
    this.confirm = options.confirm;
    for (const p of providers) {
      const off = p.onDidChange?.(() => this.emit("change"));
      if (off) this.unsubscribers.push(off);
    }
  }

  getProvider(id: string): TerminalProvider | undefined {
    return this.providers.find((p) => p.id === id);
  }

  async list(): Promise<TerminalListResult> {
    const results = await Promise.all(
      this.providers.map(async (p) => {
        try {
          return await p.list();
        } catch (e) {
          const state: ProviderState = {
            id: p.id,
            label: p.label,
            status: "error",
            message: e instanceof Error ? e.message : String(e),
          };
          return { state, targets: [] as TerminalTarget[] };
        }
      })
    );
    return {
      supported: true,
      providers: results.map((r) => r.state),
      targets: results.flatMap((r) => r.targets),
    };
  }

  async send(req: SendRequest): Promise<SendResult> {
    const check = checkSendableCommand(req.text);
    if (!check.ok) return { ok: false, code: "invalid-command", message: check.message };
    const text = check.text;

    // La cible est recherchée dans une liste fraîche : jamais d'envoi vers une cible
    // disparue ni de repli silencieux vers un autre terminal.
    const providerId = req.targetId.split(":")[0];
    const provider = this.getProvider(providerId);
    if (!provider) return { ok: false, code: "target-not-found", message: "Terminal inconnu." };
    let target = await this.findTarget(provider, req.targetId);
    if (!target) return this.disconnected();

    const ruleError = this.modeError(target, req.mode);
    if (ruleError) return ruleError;
    const reason = this.confirmationReason(target, text, req.mode);

    // Anti double-clic : un seul envoi en cours par terminal (y compris pendant la
    // confirmation), et pas deux envois identiques rapprochés.
    if (this.inFlight.has(target.id)) {
      return { ok: false, code: "in-progress", message: "Un envoi vers ce terminal est déjà en cours." };
    }
    const key = `${target.id}\u0000${req.mode}\u0000${text}`;
    this.pruneRecent();
    const last = this.recent.get(key);
    if (last) {
      return {
        ok: false,
        code: "duplicate",
        message: last.uncertain
          ? "Cette commande a peut-être déjà été transmise : vérifiez le terminal avant de la renvoyer."
          : "Commande déjà envoyée à l'instant.",
      };
    }

    this.inFlight.add(target.id);
    try {
      if (reason) {
        if (!this.confirm) {
          return { ok: false, code: "confirmation-required", message: `${reason} Confirmation impossible : envoi refusé.` };
        }
        let accepted = false;
        try {
          accepted = (await this.confirm({ mode: req.mode, reason, targetLabel: targetLabel(target), text })) === true;
        } catch {
          accepted = false;
        }
        if (!accepted) return { ok: false, code: "cancelled", message: "Envoi annulé." };

        // L'état a pu changer pendant la confirmation : nouvelle vérification complète.
        const again = await this.findTarget(provider, req.targetId);
        if (!again) return this.disconnected();
        const againError = this.modeError(again, req.mode);
        if (againError) return againError;
        const againReason = this.confirmationReason(again, text, req.mode);
        if (againReason && againReason !== reason) {
          return {
            ok: false,
            code: "state-changed",
            message: "L'état du terminal a changé pendant la confirmation : commande non envoyée.",
          };
        }
        target = again;
      }

      const result = await provider.send(target, text, req.mode, { reveal: req.reveal === true });
      if (result.ok) {
        this.recent.set(key, { expiresAt: Date.now() + DUPLICATE_WINDOW_MS, uncertain: false });
        return { ...result, targetLabel: targetLabel(target) };
      }
      if (result.code === "timeout") {
        // Pas de confirmation, mais la commande a pu arriver : on bloque un renvoi immédiat.
        this.recent.set(key, { expiresAt: Date.now() + UNCERTAIN_WINDOW_MS, uncertain: true });
      }
      return result;
    } finally {
      this.inFlight.delete(target.id);
    }
  }

  private async findTarget(provider: TerminalProvider, targetId: string): Promise<TerminalTarget | undefined> {
    const { targets } = await provider.list();
    return targets.find((t) => t.id === targetId);
  }

  private disconnected(): SendResult {
    return {
      ok: false,
      code: "target-disconnected",
      message: "Ce terminal n'est plus disponible. Choisissez un autre terminal.",
    };
  }

  /** Règles de mode (insertion possible, terminal occupé…), ou null si l'envoi est permis. */
  private modeError(target: TerminalTarget, mode: SendMode): SendResult | null {
    if (mode === "insert" && !target.canInsert) {
      return { ok: false, code: "mode-unsupported", message: target.note ?? "Insertion non disponible pour ce terminal." };
    }
    if (mode === "execute") {
      if (target.state === "busy") {
        return {
          ok: false,
          code: "terminal-busy",
          message: `Terminal occupé${target.runningCommand ? ` (${target.runningCommand})` : ""} : exécution automatique refusée.`,
        };
      }
      if (!target.canExecute) {
        return { ok: false, code: "mode-unsupported", message: target.note ?? "Exécution non disponible pour ce terminal." };
      }
    }
    return null;
  }

  private pruneRecent(): void {
    const now = Date.now();
    for (const [k, r] of this.recent) if (r.expiresAt <= now) this.recent.delete(k);
  }

  /** Motif de confirmation explicite requis avant l'envoi, ou null. */
  private confirmationReason(target: TerminalTarget, text: string, mode: SendMode): string | null {
    if (mode === "insert") {
      if (target.state === "busy") {
        return `Ce terminal exécute ${target.runningCommand ? `« ${target.runningCommand} »` : "une commande"} : le texte sera reçu par ce programme et non par le shell.`;
      }
      return null;
    }
    const reasons: string[] = [];
    const danger = destructiveReason(text);
    if (danger) reasons.push(`Commande potentiellement destructrice : ${danger}.`);
    if (target.state === "unknown") {
      reasons.push(
        "L'état de ce terminal est inconnu : si une application interactive y tourne (ex. Claude Code), c'est elle qui recevra la commande."
      );
    }
    if (target.providerId === "terminal-app") {
      reasons.push("Terminal.app ne permet pas l'insertion seule : la commande sera exécutée immédiatement.");
    }
    return reasons.length > 0 ? reasons.join(" ") : null;
  }

  dispose(): void {
    for (const off of this.unsubscribers) off();
    for (const p of this.providers) {
      try {
        p.dispose();
      } catch {
        /* on continue la libération des autres fournisseurs */
      }
    }
  }
}

// Fournisseur Terminal.app (macOS) via AppleScript (osascript).
//
// Limites (documentées) :
//  - Terminal.app n'offre aucune API d'insertion sans exécution (« do script » exécute
//    toujours) ; aucune simulation clavier n'est utilisée → seul le mode « exécuter »
//    est proposé, toujours après confirmation ;
//  - un onglet « busy » (commande en cours) est refusé ;
//  - nécessite l'autorisation macOS Automation (OtterDesk → Terminal).
import type { ProviderState, SendMode, SendResult, TerminalTarget } from "../../../shared/terminalTypes";
import { SEND_TIMEOUT_MS, defaultRunner, isProcessRunning, stableWindowNumbers, type Runner } from "../macApps";
import type { SendOptions, TerminalProvider } from "../types";

export const TERMINAL_APP_PROVIDER_ID = "terminal-app";

const FS = "\u001f"; // séparateur de champs
const RS = "\u001e"; // séparateur d'enregistrements

// Le texte de la commande est passé en argument (argv), jamais concaténé dans le script.
const LIST_SCRIPT = `
on run
  set fs to ASCII character 31
  set rs to ASCII character 30
  set out to {}
  tell application "Terminal"
    set wi to 0
    repeat with w in windows
      try
        set wid to id of w
        set wname to name of w
        set wi to wi + 1
        set ti to 0
        repeat with t in tabs of w
          set ti to ti + 1
          set procs to processes of t
          set lastProc to ""
          if (count of procs) > 0 then set lastProc to item -1 of procs
          set end of out to (wid as text) & fs & wi & fs & ti & fs & (tty of t) & fs & ((busy of t) as text) & fs & lastProc & fs & wname
        end repeat
      end try
    end repeat
  end tell
  set AppleScript's text item delimiters to rs
  return out as text
end run`;

// Envoi puis, si demandé, affichage (onglet sélectionné, fenêtre au premier plan,
// Terminal activé) dans le MÊME script : un échec d'affichage ne renvoie jamais la commande.
const SEND_SCRIPT = `
on run argv
  set targetWin to (item 1 of argv) as integer
  set targetTty to item 2 of argv
  set cmd to item 3 of argv
  set doReveal to item 4 of argv
  tell application "Terminal"
    try
      set w to window id targetWin
    on error
      return "NOTFOUND"
    end try
    repeat with t in tabs of w
      if (tty of t) is targetTty then
        if busy of t then return "BUSY"
        do script cmd in t
        if doReveal is "1" then
          try
            -- Activer d'abord : activer Terminal ensuite ramènerait sa dernière fenêtre active.
            activate
            set selected of t to true
            set index of w to 1
            set frontmost of w to true
            return "OK-REVEALED"
          on error
            return "OK-NOREVEAL"
          end try
        end if
        return "OK"
      end if
    end repeat
  end tell
  return "NOTFOUND"
end run`;

export class TerminalAppProvider implements TerminalProvider {
  readonly id = TERMINAL_APP_PROVIDER_ID;
  readonly label = "Terminal.app";

  constructor(private readonly run: Runner = defaultRunner) {}

  async list(): Promise<{ state: ProviderState; targets: TerminalTarget[] }> {
    const base = { id: this.id, label: this.label };
    if (!(await isProcessRunning(this.run, "Terminal"))) {
      return { state: { ...base, status: "not-running", message: "Terminal.app n'est pas ouvert." }, targets: [] };
    }
    const r = await this.run("/usr/bin/osascript", ["-e", LIST_SCRIPT]);
    if (!r.ok) {
      return r.denied
        ? {
            state: {
              ...base,
              status: "permission-denied",
              message:
                "Autorisez OtterDesk à contrôler Terminal : Réglages Système › Confidentialité et sécurité › Automatisation.",
            },
            targets: [],
          }
        : { state: { ...base, status: "error", message: "Terminal.app ne répond pas." }, targets: [] };
    }

    const rows = r.stdout.replace(/\n$/, "").split(RS).filter((l) => l.trim().length > 0);
    const tabsPerWindow = new Map<string, number>();
    const parsed = rows
      .map((row) => row.split(FS))
      .filter((f) => f.length >= 7)
      .map(([wid, wi, ti, tty, busy, proc, ...name]) => ({
        wid,
        wi: Number(wi),
        ti: Number(ti),
        tty,
        busy: busy === "true",
        proc: proc.replace(/^-/, ""),
        wname: name.join(FS),
      }))
      .filter((r) => /^\d+$/.test(r.wid) && /^\/dev\/ttys\d+$/.test(r.tty));
    for (const p of parsed) tabsPerWindow.set(p.wid, (tabsPerWindow.get(p.wid) ?? 0) + 1);
    const windowNumber = stableWindowNumbers(parsed.map((p) => p.wid));

    const targets: TerminalTarget[] = parsed.map((p) => ({
      id: `${this.id}:${p.wid}:${p.tty}`,
      providerId: this.id,
      groupId: this.id,
      groupLabel: "Terminal.app",
      name: `Fenêtre ${windowNumber.get(p.wid) ?? p.wi}${(tabsPerWindow.get(p.wid) ?? 1) > 1 ? ` · onglet ${p.ti}` : ""} — ${p.proc || "shell"}`,
      index: (windowNumber.get(p.wid) ?? p.wi) * 100 + p.ti,
      cwd: undefined,
      state: p.busy ? "busy" : "idle",
      runningCommand: p.busy ? p.proc : undefined,
      canInsert: false,
      canExecute: !p.busy,
      note: p.busy
        ? "Onglet occupé : envoi impossible."
        : "Terminal.app : exécution directe uniquement (pas d'insertion sans Entrée).",
    }));
    return { state: { ...base, status: "ready" }, targets };
  }

  async send(target: TerminalTarget, text: string, mode: SendMode, options: SendOptions): Promise<SendResult> {
    if (mode !== "execute") {
      return { ok: false, code: "mode-unsupported", message: "Terminal.app ne permet pas l'insertion sans exécution." };
    }
    const [, wid, tty] = target.id.split(":");
    const r = await this.run("/usr/bin/osascript", ["-e", SEND_SCRIPT, wid, tty, text, options.reveal ? "1" : "0"], SEND_TIMEOUT_MS);
    if (!r.ok) {
      if (r.timedOut) {
        return {
          ok: false,
          code: "timeout",
          message: "Pas de confirmation de Terminal.app : la commande a peut-être été transmise. Vérifiez le terminal avant de la renvoyer.",
        };
      }
      return r.denied
        ? { ok: false, code: "permission-denied", message: "Autorisation Automation refusée pour Terminal." }
        : { ok: false, code: "failed", message: "Terminal.app n'a pas accepté la commande." };
    }
    const out = r.stdout.trim();
    if (out === "OK") return { ok: true, mode, targetLabel: "" };
    if (out === "OK-REVEALED") return { ok: true, mode, targetLabel: "", reveal: { revealed: true } };
    if (out === "OK-NOREVEAL") {
      return { ok: true, mode, targetLabel: "", reveal: { revealed: false, message: "Terminal n'a pas pu afficher l'onglet." } };
    }
    if (out === "BUSY") return { ok: false, code: "terminal-busy", message: "Onglet occupé : commande non envoyée." };
    return { ok: false, code: "target-disconnected", message: "Cet onglet Terminal n'existe plus." };
  }

  dispose(): void {
    /* rien à libérer */
  }
}

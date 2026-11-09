// Fournisseur iTerm2 (macOS) via son interface AppleScript officielle (osascript).
// Aucune dépendance (pas d'API Python à activer), aucune simulation clavier :
//  - chaque session (y compris les panneaux divisés) est identifiée par son GUID ;
//  - insertion sans exécution : « write text … newline NO » (API officielle) ;
//  - exécution : « write text … » (avec retour à la ligne) ;
//  - affichage : « select » de la fenêtre, de l'onglet puis de la session, puis « activate » ;
//  - état : processus au premier plan du tty (ps), sans Shell Integration requise ;
//  - dossier courant : variable de session « session.path ».
import type { ProviderState, SendMode, SendResult, TerminalTarget } from "../../../shared/terminalTypes";
import { SEND_TIMEOUT_MS, defaultRunner, isProcessRunning, stableWindowNumbers, ttyStates, type Runner } from "../macApps";
import type { SendOptions, TerminalProvider } from "../types";
import os from "node:os";

export const ITERM2_PROVIDER_ID = "iterm2";

const FS = "\u001f";
const RS = "\u001e";

const LIST_SCRIPT = `
on run
  set fs to ASCII character 31
  set rs to ASCII character 30
  set out to {}
  tell application "iTerm2"
    set wi to 0
    repeat with w in windows
      try
        set wid to id of w
        set wname to name of w
        set wi to wi + 1
        set ti to 0
        repeat with t in tabs of w
          set ti to ti + 1
          set si to 0
          set nSessions to count of sessions of t
          repeat with s in sessions of t
            set si to si + 1
            set spath to ""
            try
              tell s to set spath to variable named "session.path"
            end try
            set end of out to (id of s) & fs & (wid as text) & fs & wi & fs & ti & fs & si & fs & nSessions & fs & (tty of s) & fs & spath & fs & (name of s) & fs & wname
          end repeat
        end repeat
      end try
    end repeat
  end tell
  set AppleScript's text item delimiters to rs
  return out as text
end run`;

// Envoi puis affichage éventuel dans le MÊME script (un échec d'affichage ne renvoie
// jamais la commande). Le texte est passé en argument, jamais concaténé au script.
const SEND_SCRIPT = `
on run argv
  set targetId to item 1 of argv
  set cmd to item 2 of argv
  set doExec to item 3 of argv
  set doReveal to item 4 of argv
  tell application "iTerm2"
    repeat with w in windows
      repeat with t in tabs of w
        repeat with s in sessions of t
          if (id of s) is targetId then
            if doExec is "1" then
              tell s to write text cmd
            else
              tell s to write text cmd newline no
            end if
            if doReveal is "1" then
              try
                tell w to select
                tell t to select
                tell s to select
                activate
                return "OK-REVEALED"
              on error
                return "OK-NOREVEAL"
              end try
            end if
            return "OK"
          end if
        end repeat
      end repeat
    end repeat
  end tell
  return "NOTFOUND"
end run`;

function tildify(p: string): string {
  const home = os.homedir();
  return p === home || p.startsWith(home + "/") ? "~" + p.slice(home.length) : p;
}

export class ITerm2Provider implements TerminalProvider {
  readonly id = ITERM2_PROVIDER_ID;
  readonly label = "iTerm2";

  constructor(private readonly run: Runner = defaultRunner) {}

  async list(): Promise<{ state: ProviderState; targets: TerminalTarget[] }> {
    const base = { id: this.id, label: this.label };
    if (!(await isProcessRunning(this.run, "iTerm2"))) {
      return { state: { ...base, status: "not-running", message: "iTerm2 n'est pas ouvert." }, targets: [] };
    }
    const r = await this.run("/usr/bin/osascript", ["-e", LIST_SCRIPT]);
    if (!r.ok) {
      return r.denied
        ? {
            state: {
              ...base,
              status: "permission-denied",
              message:
                "Autorisez OtterDesk à contrôler iTerm2 : Réglages Système › Confidentialité et sécurité › Automatisation.",
            },
            targets: [],
          }
        : { state: { ...base, status: "error", message: "iTerm2 ne répond pas." }, targets: [] };
    }

    const sessions = r.stdout
      .replace(/\n$/, "")
      .split(RS)
      .map((row) => row.split(FS))
      .filter((f) => f.length >= 10)
      .map(([sid, wid, wi, ti, si, n, tty, spath, sname, ...wname]) => ({
        sid,
        wid,
        wi: Number(wi),
        ti: Number(ti),
        si: Number(si),
        n: Number(n),
        tty,
        spath,
        sname,
        wname: wname.join(FS),
      }))
      // GUID iTerm2 : hexadécimal et tirets uniquement (sert d'identifiant de cible)
      .filter((s) => /^[A-Za-z0-9-]{1,100}$/.test(s.sid) && /^\d+$/.test(s.wid));

    const states = await ttyStates(this.run, sessions.map((s) => s.tty));
    const windowNumber = stableWindowNumbers(sessions.map((s) => s.wid));
    const tabsPerWindow = new Map<string, number>();
    for (const s of sessions) tabsPerWindow.set(s.wid, Math.max(tabsPerWindow.get(s.wid) ?? 0, s.ti));

    const targets: TerminalTarget[] = sessions.map((s) => {
      const st = states.get(s.tty) ?? { state: "unknown" as const };
      const where = [
        (tabsPerWindow.get(s.wid) ?? 1) > 1 ? `Onglet ${s.ti}` : null,
        s.n > 1 ? `panneau ${s.si}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        id: `${this.id}:${s.sid}`,
        providerId: this.id,
        groupId: `${this.id}:${s.wid}`,
        groupLabel: `iTerm2 — Fenêtre ${windowNumber.get(s.wid) ?? s.wi}`,
        groupDetail: s.wname ? tildify(s.wname) : undefined,
        name: `${where ? `${where} — ` : ""}${s.sname || "session"}`,
        index: (windowNumber.get(s.wid) ?? s.wi) * 10000 + s.ti * 100 + s.si,
        cwd: s.spath ? tildify(s.spath) : undefined,
        state: st.state,
        runningCommand: st.runningCommand,
        canInsert: true,
        canExecute: st.state !== "busy",
        note: st.state === "busy" ? "Session occupée : exécution automatique indisponible." : undefined,
      };
    });
    return { state: { ...base, status: "ready" }, targets };
  }

  async send(target: TerminalTarget, text: string, mode: SendMode, options: SendOptions): Promise<SendResult> {
    const sid = target.id.slice(this.id.length + 1);
    const r = await this.run("/usr/bin/osascript", [
      "-e",
      SEND_SCRIPT,
      sid,
      text,
      mode === "execute" ? "1" : "0",
      options.reveal ? "1" : "0",
    ], SEND_TIMEOUT_MS);
    if (!r.ok) {
      if (r.timedOut) {
        return {
          ok: false,
          code: "timeout",
          message: "Pas de confirmation de iTerm2 : la commande a peut-être été transmise. Vérifiez le terminal avant de la renvoyer.",
        };
      }
      return r.denied
        ? { ok: false, code: "permission-denied", message: "Autorisation Automation refusée pour iTerm2." }
        : { ok: false, code: "failed", message: "iTerm2 n'a pas accepté la commande." };
    }
    const out = r.stdout.trim();
    if (out === "OK") return { ok: true, mode, targetLabel: "" };
    if (out === "OK-REVEALED") return { ok: true, mode, targetLabel: "", reveal: { revealed: true } };
    if (out === "OK-NOREVEAL") {
      return { ok: true, mode, targetLabel: "", reveal: { revealed: false, message: "iTerm2 n'a pas pu afficher la session." } };
    }
    return { ok: false, code: "target-disconnected", message: "Cette session iTerm2 n'existe plus." };
  }

  dispose(): void {
    /* rien à libérer */
  }
}

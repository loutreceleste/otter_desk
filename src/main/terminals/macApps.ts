// Utilitaires macOS : exécution d'osascript / d'outils système sans shell.
import { execFile } from "node:child_process";

export type RunResult =
  | { ok: true; stdout: string }
  | {
      ok: false;
      denied: boolean;
      message: string;
      /** Processus arrêté faute de réponse : l'action a pu être effectuée malgré tout. */
      timedOut?: boolean;
    };

/** Délai des scripts d'envoi : plus long que la lecture, car l'application cible peut être lente. */
export const SEND_TIMEOUT_MS = 15_000;

/** Exécute un programme (sans shell) ; « denied » = autorisation Automation refusée. */
export type Runner = (file: string, args: string[], timeoutMs?: number) => Promise<RunResult>;

export const defaultRunner: Runner = (file, args, timeoutMs = 5000) =>
  new Promise((resolve) => {
    execFile(file, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const text = `${stderr || ""} ${err.message}`;
        const timedOut = (err as { killed?: boolean }).killed === true;
        resolve({
          ok: false,
          denied: /-1743|not authori[sz]ed|Not authorised/i.test(text),
          message: text.trim(),
          ...(timedOut ? { timedOut: true } : {}),
        });
      } else {
        resolve({ ok: true, stdout: String(stdout) });
      }
    });
  });

/** true si un processus portant exactement ce nom tourne (ne lance jamais l'application). */
export async function isProcessRunning(run: Runner, name: string): Promise<boolean> {
  return (await run("/usr/bin/pgrep", ["-x", name])).ok;
}

/**
 * Numéro stable de chaque fenêtre (1, 2, …) selon son identifiant (ordre de création),
 * et non selon l'ordre d'empilement qui change à chaque changement de fenêtre active.
 */
export function stableWindowNumbers(windowIds: string[]): Map<string, number> {
  const sorted = [...new Set(windowIds)].sort((a, b) => Number(a) - Number(b));
  return new Map(sorted.map((id, i) => [id, i + 1]));
}

const SHELLS = new Set(["zsh", "bash", "fish", "sh", "dash", "tcsh", "csh", "ksh", "nu", "pwsh", "xonsh", "elvish", "login"]);

export interface TtyState {
  state: "idle" | "busy" | "unknown";
  runningCommand?: string;
}

/**
 * État des terminaux d'après leurs processus au premier plan (ps, champ STAT « + ») :
 * seul un shell au premier plan → prêt ; un autre programme (ex. claude, npm) → occupé.
 */
export async function ttyStates(run: Runner, ttys: string[]): Promise<Map<string, TtyState>> {
  const result = new Map<string, TtyState>();
  const names = [...new Set(ttys.filter((t) => /^\/dev\/ttys\d+$/.test(t)).map((t) => t.replace("/dev/", "")))];
  if (names.length === 0) return result;
  const r = await run("/bin/ps", ["-o", "tty=,stat=,comm=", "-t", names.join(",")]);
  if (!r.ok) return result;
  const foreground = new Map<string, string[]>();
  for (const line of r.stdout.split("\n")) {
    const m = line.trim().match(/^(\S+)\s+(\S+)\s+(.+)$/);
    if (!m || !m[2].includes("+")) continue;
    const tty = `/dev/${m[1].startsWith("tty") ? m[1] : `tty${m[1]}`}`;
    const cmd = m[3].trim().split("/").pop()!.replace(/^-/, "");
    foreground.set(tty, [...(foreground.get(tty) ?? []), cmd]);
  }
  for (const name of names) {
    const tty = `/dev/${name}`;
    const procs = foreground.get(tty);
    if (!procs || procs.length === 0) {
      result.set(tty, { state: "unknown" });
      continue;
    }
    const other = procs.filter((p) => !SHELLS.has(p));
    result.set(tty, other.length > 0 ? { state: "busy", runningCommand: other[other.length - 1] } : { state: "idle" });
  }
  return result;
}

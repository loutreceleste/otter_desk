// Règles de sécurité appliquées avant tout envoi d'une commande vers un terminal.
// Module pur (aucune dépendance Node / DOM) : utilisé par le main, le renderer et
// l'extension VS Code (défense en profondeur).

export const MAX_COMMAND_LENGTH = 8000;

export type CommandCheck =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "too-long" | "multiline" | "control-chars"; message: string };

/**
 * Vérifie qu'une commande peut être transmise telle quelle à un terminal.
 * - les espaces de fin sont retirés (un saut de ligne final déclencherait l'exécution) ;
 * - une commande sur plusieurs lignes est refusée : en mode « insertion », le shell
 *   exécuterait les premières lignes ;
 * - les caractères de contrôle (Ctrl+C, séquences d'échappement…) sont refusés.
 */
export function checkSendableCommand(raw: unknown): CommandCheck {
  if (typeof raw !== "string") {
    return { ok: false, reason: "empty", message: "Commande vide." };
  }
  const text = raw.replace(/\s+$/u, "").replace(/^[\r\n]+/u, "");
  if (text.trim().length === 0) {
    return { ok: false, reason: "empty", message: "Commande vide." };
  }
  if (text.length > MAX_COMMAND_LENGTH) {
    return { ok: false, reason: "too-long", message: `Commande trop longue (> ${MAX_COMMAND_LENGTH} caractères).` };
  }
  if (/[\r\n]/u.test(text)) {
    return {
      ok: false,
      reason: "multiline",
      message: "Commande sur plusieurs lignes : utilisez Copier pour la coller vous-même.",
    };
  }
  // Tabulation autorisée ; tout autre caractère de contrôle C0/C1 ou DEL est refusé.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/u.test(text)) {
    return {
      ok: false,
      reason: "control-chars",
      message: "La commande contient des caractères de contrôle et ne peut pas être envoyée.",
    };
  }
  return { ok: true, text };
}

const DESTRUCTIVE_PATTERNS: Array<[RegExp, string]> = [
  [/(^|[\s;&|(])sudo\s/i, "élévation de privilèges (sudo)"],
  [/(^|[\s;&|(])rm\s+(-[a-z]*[rf][a-z]*\b|--recursive|--force)/i, "suppression de fichiers (rm -r / -f)"],
  [/(^|[\s;&|(])(mkfs|diskutil\s+(erase|reformat|partition))/i, "formatage de disque"],
  [/(^|[\s;&|(])dd\s+[^|;]*\bof=/i, "écriture brute sur un fichier ou un disque (dd)"],
  [/(^|[\s;&|(])(chmod|chown)\s+(-[a-z]*R|--recursive)/i, "modification récursive des droits"],
  [/(^|[\s;&|(])(shutdown|reboot|halt)\b/i, "arrêt ou redémarrage de la machine"],
  [/(^|[\s;&|(])(kill\s+-9|killall|pkill)\b/i, "arrêt forcé de processus"],
  [/\bgit\s+reset\s+[^;&|]*--hard\b/i, "git reset --hard (modifications perdues)"],
  [/\bgit\s+clean\s+[^;&|]*-[a-z]*f/i, "git clean (fichiers non suivis supprimés)"],
  [/\bgit\s+push\b[^;&|]*?(\s--force(-with-lease)?\b|\s-f\b|\s\+\S)/i, "git push forcé"],
  [/\bgit\s+branch\s+[^;&|]*-D\b/, "suppression forcée de branche"],
  [/\bgit\s+(checkout|restore)\s+[^;&|]*(\s--\s+\.|\s\.)\s*$/i, "annulation de toutes les modifications locales"],
  [/\bgit\s+stash\s+(drop|clear)\b/i, "suppression de stash"],
  [/\bdocker\s+(system|volume|image|container|network|builder)\s+prune\b/i, "nettoyage Docker (prune)"],
  [/\bdocker(-|\s+)compose\s+[^;&|]*\bdown\b[^;&|]*(-v\b|--volumes\b)/i, "suppression des volumes Docker"],
  [/\bdocker\s+(rm|rmi|volume\s+rm)\s+[^;&|]*-f\b/i, "suppression forcée Docker"],
  [/\b(drop\s+(database|table|schema)|truncate\s+table|delete\s+from)\b/i, "suppression de données SQL"],
  [/\b(doctrine:(database|schema):drop|migrate:(fresh|reset|rollback)|db:wipe|prisma\s+migrate\s+reset)\b/i, "réinitialisation de base de données"],
  [/\b(kubectl\s+delete|terraform\s+destroy|helm\s+(uninstall|delete))\b/i, "suppression d'infrastructure"],
  [/\bnpm\s+unpublish\b/i, "dépublication npm"],
  [/>\s*\/dev\/(sd|disk|nvme)/i, "écriture directe sur un disque"],
  [/:\(\)\s*\{\s*:\|:&\s*\};:/, "fork bomb"],
];

/** Retourne une description du risque si la commande paraît destructrice, sinon null. */
export function destructiveReason(text: string): string | null {
  for (const [re, label] of DESTRUCTIVE_PATTERNS) {
    if (re.test(text)) return label;
  }
  return null;
}

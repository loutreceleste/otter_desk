// Informations d'application exposées au renderer (version réelle, raccourci global).

export interface GlobalShortcutInfo {
  /** Accélérateur Electron enregistré (ex. « Command+Alt+Shift+D »). */
  accelerator: string;
  /** Touches à afficher (ex. ["⌘", "⌥", "⇧", "D"]). */
  keys: string[];
  /** true seulement si globalShortcut.register() a réussi. */
  registered: boolean;
  /** Explication lorsque le raccourci est inactif. */
  message?: string;
}

export interface AppInfo {
  /** Version réelle de l'application (app.getVersion()). */
  version: string;
  shortcut: GlobalShortcutInfo;
}

/**
 * Raccourci global afficher / masquer OtterDesk.
 * macOS : ⌘⌥⇧D (« D » comme OtterDesk). Vérifié : aucun raccourci par défaut de VS Code
 * n'utilise ⌘⌥⇧D (⌘⌥⇧O y est pris par « Focus Most Recent Chat Terminal Output ») ni
 * aucun raccourci système macOS. Windows : inchangé.
 * Limite : macOS accepte l'enregistrement même si une autre application a déjà déclaré
 * la même combinaison ; register() ne détecte donc que les refus réels.
 */
export function globalShortcutFor(platform: string): { accelerator: string; keys: string[] } {
  return platform === "darwin"
    ? { accelerator: "Command+Alt+Shift+D", keys: ["⌘", "⌥", "⇧", "D"] }
    : { accelerator: "CommandOrControl+Shift+Space", keys: ["Ctrl", "Shift", "Space"] };
}

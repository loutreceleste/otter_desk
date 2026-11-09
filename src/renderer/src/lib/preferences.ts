// Préférences locales de l'interface (même mécanisme que le thème : localStorage).

const REVEAL_KEY = "otterdesk.revealTerminalAfterSend";

/** « Afficher le terminal après l'envoi » — activé par défaut si jamais défini. */
export function getRevealAfterSend(): boolean {
  try {
    const v = window.localStorage.getItem(REVEAL_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

export function setRevealAfterSend(value: boolean): void {
  try {
    window.localStorage.setItem(REVEAL_KEY, value ? "true" : "false");
  } catch {
    /* stockage indisponible : la valeur par défaut (activé) s'applique */
  }
}

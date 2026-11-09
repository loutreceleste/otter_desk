import type { ProviderState, SendMode, SendResult, TerminalTarget } from "../../shared/terminalTypes";

export interface SendOptions {
  /** Mettre la session au premier plan après la transmission (sans jamais renvoyer la commande). */
  reveal: boolean;
}

/**
 * Fournisseur de terminaux (VS Code, Terminal.app, iTerm2…).
 * Pour ajouter une application : implémenter cette interface et l'enregistrer
 * dans createTerminalService() (src/main/terminals/index.ts).
 */
export interface TerminalProvider {
  readonly id: string;
  readonly label: string;
  /** Liste à jour des cibles disponibles et de l'état du fournisseur. */
  list(): Promise<{ state: ProviderState; targets: TerminalTarget[] }>;
  /**
   * Transmet le texte au terminal exact désigné par targetId.
   * Le service a déjà validé la commande, la cible et les confirmations.
   * Si options.reveal : afficher ensuite la session ; un échec d'affichage ne change pas
   * le résultat de la transmission (champ « reveal » du résultat).
   */
  send(target: TerminalTarget, text: string, mode: SendMode, options: SendOptions): Promise<SendResult>;
  /** Abonnement aux changements (terminal ouvert / fermé, fenêtre déconnectée…). */
  onDidChange?(listener: () => void): () => void;
  /** Libération synchrone (appelée pendant la fermeture de l'app). */
  dispose(): void;
}

/** Libellé lisible d'une cible, utilisé dans les messages de résultat. */
export function targetLabel(t: TerminalTarget): string {
  return `${t.groupLabel} › ${t.name}`;
}

// Types partagés main ↔ renderer pour l'envoi de commandes vers des terminaux.

/** insert : la commande est saisie sans Entrée ; execute : saisie + Entrée. */
export type SendMode = "insert" | "execute";

/**
 * État du shell d'un terminal :
 * - idle    : invite du shell prête (Shell Integration VS Code / onglet non occupé)
 * - busy    : une commande ou une application interactive est en cours
 * - unknown : impossible à déterminer (pas de Shell Integration, ex. CLI interactif)
 */
export type TerminalShellState = "idle" | "busy" | "unknown";

export type ProviderStatus =
  | "ready" // connecté, au moins un terminal ou aucun terminal ouvert
  | "not-paired" // VS Code : extension non appairée
  | "no-clients" // VS Code : appairé mais aucune fenêtre connectée
  | "not-running" // application non lancée
  | "permission-denied" // autorisation macOS « Automation » refusée
  | "error";

export interface ProviderState {
  id: string;
  label: string;
  status: ProviderStatus;
  message?: string;
}

export interface TerminalTarget {
  /** Identifiant interne unique de la session (jamais le seul nom affiché). */
  id: string;
  providerId: string;
  /** Regroupement (fenêtre VS Code, application) */
  groupId: string;
  groupLabel: string;
  /** Précision du groupe (dossier du workspace, connexion distante…) */
  groupDetail?: string;
  /** Nom affiché du terminal */
  name: string;
  /** Position dans son groupe (1 = premier) */
  index: number;
  cwd?: string;
  state: TerminalShellState;
  /** Commande en cours lorsque state = busy (si connue) */
  runningCommand?: string;
  canInsert: boolean;
  canExecute: boolean;
  /** Explication affichée lorsqu'un mode n'est pas disponible */
  note?: string;
}

export interface TerminalListResult {
  supported: boolean;
  providers: ProviderState[];
  targets: TerminalTarget[];
}

/**
 * Requête IPC du renderer : une RÉFÉRENCE à une commande enregistrée (identifiant + étape),
 * jamais un texte libre ni une confirmation. Le processus principal relit le texte en base
 * et décide seul des confirmations (boîte de dialogue native).
 */
export interface SendCommandRequest {
  targetId: string;
  commandId: number;
  /** Index de l'étape (0 pour une commande simple). */
  step: number;
  mode: SendMode;
  /** Mettre le terminal destinataire au premier plan après la transmission. */
  reveal?: boolean;
}

/** Requête interne au processus principal (texte déjà résolu depuis la base). */
export interface SendRequest {
  targetId: string;
  text: string;
  mode: SendMode;
  /** Mettre le terminal destinataire au premier plan après la transmission. */
  reveal?: boolean;
}

/** Résultat de la mise au premier plan (distinct de la transmission). */
export interface RevealOutcome {
  revealed: boolean;
  /** Raison de l'échec de l'affichage (la commande, elle, a bien été transmise). */
  message?: string;
}

export type SendErrorCode =
  | "invalid-command"
  | "target-not-found"
  | "target-disconnected"
  | "mode-unsupported"
  | "terminal-busy"
  | "confirmation-required"
  | "cancelled"
  | "state-changed"
  | "command-not-found"
  | "invalid-request"
  | "in-progress"
  | "duplicate"
  | "permission-denied"
  | "timeout"
  | "failed";

export type SendResult =
  | { ok: true; mode: SendMode; targetLabel: string; reveal?: RevealOutcome }
  | { ok: false; code: SendErrorCode; message: string };

export interface PairingInfo {
  code: string;
  expiresAt: number;
}

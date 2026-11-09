// Suivi des terminaux intégrés de la fenêtre VS Code courante.
//
// Identifiants : un identifiant aléatoire par objet Terminal (stable tant que le terminal
// existe dans cette fenêtre, éphémère d'une session VS Code à l'autre).
// État : via Shell Integration lorsqu'elle est active
//   - idle    : invite du shell prête
//   - busy    : une commande est en cours (ex. « claude », « npm run dev »)
//   - unknown : pas de Shell Integration (ex. terminal lancé directement sur un CLI interactif)
import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import type { BridgeTerminalInfo } from "../../src/shared/terminalBridge/protocol";

export interface TrackerEvents {
  added(info: BridgeTerminalInfo): void;
  updated(info: BridgeTerminalInfo): void;
  removed(terminalId: string): void;
  /** Réindexation (fermeture d'un terminal) : liste complète. */
  snapshot(all: BridgeTerminalInfo[]): void;
}

export class TerminalTracker implements vscode.Disposable {
  private readonly ids = new WeakMap<vscode.Terminal, string>();
  private readonly running = new Map<vscode.Terminal, string>();
  private readonly disposables: vscode.Disposable[] = [];
  private lastSnapshot = "";

  constructor(private readonly events: TrackerEvents) {
    const w = vscode.window;
    this.disposables.push(
      w.onDidOpenTerminal((t) => this.events.added(this.info(t))),
      w.onDidCloseTerminal((t) => {
        const id = this.ids.get(t);
        this.running.delete(t);
        if (id) this.events.removed(id);
        this.emitSnapshot(); // les positions (index) des autres terminaux changent
      }),
      w.onDidChangeTerminalShellIntegration(({ terminal }) => this.events.updated(this.info(terminal))),
      w.onDidStartTerminalShellExecution(({ terminal, execution }) => {
        this.running.set(terminal, execution.commandLine.value.slice(0, 200));
        this.events.updated(this.info(terminal));
      }),
      w.onDidEndTerminalShellExecution(({ terminal }) => {
        this.running.delete(terminal);
        this.events.updated(this.info(terminal));
      }),
      w.onDidChangeTerminalState((t) => this.events.updated(this.info(t)))
    );
    // Les renommages de terminaux n'ont pas d'événement dédié : contrôle périodique léger.
    const timer = setInterval(() => this.emitSnapshot(), 10_000);
    this.disposables.push({ dispose: () => clearInterval(timer) });
  }

  idOf(t: vscode.Terminal): string {
    let id = this.ids.get(t);
    if (!id) {
      id = randomUUID();
      this.ids.set(t, id);
    }
    return id;
  }

  find(terminalId: string): vscode.Terminal | undefined {
    return vscode.window.terminals.find((t) => this.ids.get(t) === terminalId);
  }

  isBusy(t: vscode.Terminal): boolean {
    return this.running.has(t);
  }

  info(t: vscode.Terminal): BridgeTerminalInfo {
    const integration = t.shellIntegration;
    const runningCommand = this.running.get(t);
    const state = runningCommand !== undefined ? "busy" : integration ? "idle" : "unknown";
    const cwd = integration?.cwd?.fsPath;
    return {
      terminalId: this.idOf(t),
      name: (t.name || "Terminal").slice(0, 200),
      index: Math.max(1, vscode.window.terminals.indexOf(t) + 1),
      state,
      ...(runningCommand ? { runningCommand } : {}),
      ...(cwd ? { cwd: cwd.slice(0, 4096) } : {}),
      shellIntegration: Boolean(integration),
    };
  }

  all(): BridgeTerminalInfo[] {
    return vscode.window.terminals.map((t) => this.info(t));
  }

  private emitSnapshot(): void {
    const all = this.all();
    const key = JSON.stringify(all);
    if (key === this.lastSnapshot) return;
    this.lastSnapshot = key;
    this.events.snapshot(all);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}

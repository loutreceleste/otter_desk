// Fournisseurs iTerm2 / Terminal.app avec un exécuteur simulé (aucune application lancée),
// et règles du service appliquées à ces fournisseurs.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ITerm2Provider } from "../src/main/terminals/iterm2/iterm2Provider";
import { TerminalAppProvider } from "../src/main/terminals/terminalApp/terminalAppProvider";
import { TerminalService } from "../src/main/terminals/terminalService";
import { ttyStates, type RunResult, type Runner } from "../src/main/terminals/macApps";

const FS = "\u001f", RS = "\u001e";

interface Call { file: string; args: string[] }

function fakeRunner(handler: (file: string, args: string[]) => RunResult): { run: Runner; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    run: async (file, args) => {
      calls.push({ file, args });
      return handler(file, args);
    },
  };
}

const ok = (stdout = ""): RunResult => ({ ok: true, stdout });
const fail = (denied = false): RunResult => ({ ok: false, denied, message: denied ? "execution error: Not authorized to send Apple events (-1743)" : "erreur" });

// Deux fenêtres iTerm2 : fenêtre 1 = 2 onglets, le 2e divisé en 2 panneaux ; fenêtre 2 = 1 session.
const ITERM_LIST = [
  ["AAAA-1", "4889", "1", "1", "1", "1", "/dev/ttys001", "/Users/me/projets/bulle", "~/projets/bulle (-zsh)", "bulle"],
  ["AAAA-2", "4889", "1", "2", "1", "2", "/dev/ttys002", "/Users/me/projets/bulle", "npm run dev", "bulle"],
  ["AAAA-3", "4889", "1", "2", "2", "2", "/dev/ttys003", "", "claude", "bulle"],
  ["BBBB-1", "5001", "2", "1", "1", "1", "/dev/ttys004", "/tmp", "zsh", "autre"],
].map((r) => r.join(FS)).join(RS);

const PS = [
  "s001 Ss+ -zsh",
  "s002 Ss  -zsh",
  "s002 S+  node",
  "s003 Ss  /bin/zsh",
  "s003 S+  claude",
  "s004 Ss+ zsh",
].join("\n");

function itermRunner(overrides: Partial<Record<"pgrep" | "list" | "ps" | "send", RunResult>> = {}) {
  return fakeRunner((file, args) => {
    if (file === "/usr/bin/pgrep") return overrides.pgrep ?? ok("123\n");
    if (file === "/bin/ps") return overrides.ps ?? ok(PS);
    if (file === "/usr/bin/osascript") {
      return args[1].includes("write text") ? overrides.send ?? ok("OK\n") : overrides.list ?? ok(ITERM_LIST + "\n");
    }
    return fail();
  });
}

describe("état des terminaux via ps (processus au premier plan)", () => {
  it("shell seul → prêt ; autre programme → occupé ; tty inconnu → inconnu", async () => {
    const { run } = itermRunner();
    const states = await ttyStates(run, ["/dev/ttys001", "/dev/ttys002", "/dev/ttys003", "/dev/ttys004", "/dev/ttys009"]);
    assert.deepEqual(states.get("/dev/ttys001"), { state: "idle" });
    assert.deepEqual(states.get("/dev/ttys002"), { state: "busy", runningCommand: "node" });
    assert.deepEqual(states.get("/dev/ttys003"), { state: "busy", runningCommand: "claude" });
    assert.deepEqual(states.get("/dev/ttys004"), { state: "idle" });
    assert.deepEqual(states.get("/dev/ttys009"), { state: "unknown" });
  });
});

describe("fournisseur iTerm2", () => {
  it("liste fenêtres, onglets et panneaux avec des identifiants uniques", async () => {
    const { state, targets } = await new ITerm2Provider(itermRunner().run).list();
    assert.equal(state.status, "ready");
    assert.equal(targets.length, 4);
    assert.equal(new Set(targets.map((t) => t.id)).size, 4);
    const pane2 = targets.find((t) => t.id === "iterm2:AAAA-3")!;
    assert.equal(pane2.groupLabel, "iTerm2 — Fenêtre 1");
    assert.equal(pane2.name, "Onglet 2 · panneau 2 — claude");
    assert.equal(pane2.state, "busy");
    assert.equal(pane2.canExecute, false);
    assert.equal(pane2.canInsert, true);
    const first = targets.find((t) => t.id === "iterm2:AAAA-1")!;
    assert.equal(first.state, "idle");
    assert.equal(first.name, "Onglet 1 — ~/projets/bulle (-zsh)");
    const other = targets.find((t) => t.id === "iterm2:BBBB-1")!;
    assert.equal(other.groupLabel, "iTerm2 — Fenêtre 2");
    assert.equal(other.name, "zsh", "fenêtre à onglet et panneau uniques : nom simple");
    assert.equal(other.cwd, "/tmp");
  });

  it("iTerm2 fermé : aucune requête AppleScript (l'application n'est pas lancée)", async () => {
    const r = itermRunner({ pgrep: fail() });
    const { state, targets } = await new ITerm2Provider(r.run).list();
    assert.equal(state.status, "not-running");
    assert.equal(targets.length, 0);
    assert.equal(r.calls.some((c) => c.file === "/usr/bin/osascript"), false);
  });

  it("autorisation Automation refusée : état explicite", async () => {
    const { state } = await new ITerm2Provider(itermRunner({ list: fail(true) }).run).list();
    assert.equal(state.status, "permission-denied");
    assert.match(state.message!, /Automatisation/);
  });

  it("insertion : « newline no » ; exécution : retour à la ligne ; texte passé en argument", async () => {
    const r = itermRunner();
    const p = new ITerm2Provider(r.run);
    const target = (await p.list()).targets.find((t) => t.id === "iterm2:AAAA-1")!;
    await p.send(target, "echo \"a b\" ; ls", "insert", { reveal: false });
    await p.send(target, "git status", "execute", { reveal: true });
    const sends = r.calls.filter((c) => c.file === "/usr/bin/osascript" && c.args[1].includes("write text"));
    assert.deepEqual(sends[0].args.slice(2), ["AAAA-1", "echo \"a b\" ; ls", "0", "0"]);
    assert.deepEqual(sends[1].args.slice(2), ["AAAA-1", "git status", "1", "1"]);
    assert.ok(sends[0].args[1].includes("newline no"));
    assert.ok(!sends[0].args[1].includes("echo"), "la commande n'est jamais concaténée au script");
  });

  it("affichage : réussi, échoué (sans renvoi), session fermée", async () => {
    const base = (await new ITerm2Provider(itermRunner().run).list()).targets[0];
    const revealed = await new ITerm2Provider(itermRunner({ send: ok("OK-REVEALED") }).run).send(base, "ls", "insert", { reveal: true });
    assert.deepEqual(revealed.ok && revealed.reveal, { revealed: true });
    const r = itermRunner({ send: ok("OK-NOREVEAL") });
    const noReveal = await new ITerm2Provider(r.run).send(base, "ls", "insert", { reveal: true });
    assert.equal(noReveal.ok, true, "la transmission reste un succès");
    assert.equal(noReveal.ok && noReveal.reveal?.revealed, false);
    assert.equal(r.calls.filter((c) => c.args[1]?.includes("write text")).length, 1, "aucun renvoi");
    const gone = await new ITerm2Provider(itermRunner({ send: ok("NOTFOUND") }).run).send(base, "ls", "insert", { reveal: false });
    assert.equal(!gone.ok && gone.code, "target-disconnected");
    const denied = await new ITerm2Provider(itermRunner({ send: fail(true) }).run).send(base, "ls", "insert", { reveal: false });
    assert.equal(!denied.ok && denied.code, "permission-denied");
  });

  it("règles du service : session occupée, état inconnu, commande destructrice", async () => {
    const svc = new TerminalService([new ITerm2Provider(itermRunner().run)]);
    const busy = await svc.send({ targetId: "iterm2:AAAA-3", text: "ls", mode: "execute" });
    assert.equal(!busy.ok && busy.code, "terminal-busy");
    const insBusy = await svc.send({ targetId: "iterm2:AAAA-3", text: "ls", mode: "insert" });
    assert.equal(!insBusy.ok && insBusy.code, "confirmation-required");
    const danger = await svc.send({ targetId: "iterm2:AAAA-1", text: "git reset --hard", mode: "execute" });
    assert.equal(!danger.ok && danger.code, "confirmation-required");
    const fine = await svc.send({ targetId: "iterm2:AAAA-1", text: "git status", mode: "execute", reveal: true });
    assert.equal(fine.ok, true);
    const missing = await svc.send({ targetId: "iterm2:ZZZZ", text: "ls", mode: "insert" });
    assert.equal(!missing.ok && missing.code, "target-disconnected");
  });
});

describe("fournisseur Terminal.app (affichage)", () => {
  const LIST = ["101", "1", "1", "/dev/ttys010", "false", "-zsh", "fenêtre"].join(FS);
  const run = (send: RunResult) =>
    fakeRunner((file, args) =>
      file === "/usr/bin/pgrep" ? ok("1") : args[1].includes("do script") ? send : ok(LIST)
    );

  it("transmet l'option d'affichage et distingue transmission / affichage", async () => {
    const r = run(ok("OK-REVEALED"));
    const p = new TerminalAppProvider(r.run);
    const [t] = (await p.list()).targets;
    const res = await p.send(t, "ls", "execute", { reveal: true });
    assert.deepEqual(res.ok && res.reveal, { revealed: true });
    const call = r.calls.find((c) => c.args[1]?.includes("do script"))!;
    assert.deepEqual(call.args.slice(2), ["101", "/dev/ttys010", "ls", "1"]);
    const res2 = await new TerminalAppProvider(run(ok("OK-NOREVEAL")).run).send(t, "ls", "execute", { reveal: true });
    assert.equal(res2.ok && res2.reveal?.revealed, false);
    const res3 = await new TerminalAppProvider(run(ok("OK")).run).send(t, "ls", "execute", { reveal: false });
    assert.deepEqual(res3, { ok: true, mode: "execute", targetLabel: "" });
  });

  it("Terminal fermé : aucune requête AppleScript", async () => {
    const r = fakeRunner((file) => (file === "/usr/bin/pgrep" ? fail() : ok()));
    const { state } = await new TerminalAppProvider(r.run).list();
    assert.equal(state.status, "not-running");
    assert.equal(r.calls.length, 1);
  });
});

describe("numérotation stable des fenêtres", () => {
  it("ne dépend pas de l'ordre d'empilement (fenêtre active)", async () => {
    const reordered = ITERM_LIST.split(RS).reverse().join(RS); // autre fenêtre au premier plan
    const a = await new ITerm2Provider(itermRunner().run).list();
    const b = await new ITerm2Provider(itermRunner({ list: ok(reordered) }).run).list();
    const label = (r: typeof a, id: string) => r.targets.find((t) => t.id === id)!.groupLabel;
    for (const id of ["iterm2:AAAA-1", "iterm2:BBBB-1"]) assert.equal(label(a, id), label(b, id));
    assert.equal(label(a, "iterm2:AAAA-1"), "iTerm2 — Fenêtre 1"); // id 4889 < 5001
  });
});

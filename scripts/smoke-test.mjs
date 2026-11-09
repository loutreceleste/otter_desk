// Test de fumée de l'application PACKAGÉE (Windows en CI, utilisable aussi sur macOS).
//
//   node scripts/smoke-test.mjs <exécutable> [--json <rapport.json>]
//
// L'application est lancée avec un dossier de données temporaire (--user-data-dir) : les
// données de l'utilisateur ne sont jamais touchées. Elle est pilotée via le protocole
// DevTools (--remote-debugging-port), comme le ferait l'interface :
//   démarrage, SQLite (création, lecture, écriture), persistance après redémarrage,
//   gestion des projets et commandes, navigation, bouton Copier (Windows), barre de titre,
//   protections (CSP, navigation bloquée) et absence des intégrations macOS sous Windows.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const exe = process.argv[2];
const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
if (!exe || !existsSync(exe)) {
  console.error("Usage : node scripts/smoke-test.mjs <chemin de l'exécutable OtterDesk> [--json rapport.json]");
  process.exit(2);
}

const isWin = process.platform === "win32";
const PORT = 9400 + Math.floor(Math.random() * 400);
const userData = mkdtempSync(path.join(os.tmpdir(), "otterdesk-smoke-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok), detail: String(detail ?? "") });
  console.log(`${ok ? "✔" : "✖"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ─── Lancement / arrêt ───────────────────────────────────────────────────────

function launch() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(exe, [`--user-data-dir=${userData}`, `--remote-debugging-port=${PORT}`], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: false,
  });
  child.output = "";
  child.stdout.on("data", (d) => (child.output += d));
  child.stderr.on("data", (d) => (child.output += d));
  return child;
}

async function stop(child) {
  if (child.exitCode !== null) return;
  if (isWin) {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      /* déjà arrêté */
    }
  } else {
    child.kill("SIGTERM");
  }
  for (let i = 0; i < 50 && child.exitCode === null && child.signalCode === null; i++) await sleep(100);
  await sleep(1000); // libération des fichiers (Windows)
}

// ─── Client DevTools minimal ─────────────────────────────────────────────────

async function connect() {
  let page;
  for (let i = 0; i < 120 && !page; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      page = list.find((p) => p.type === "page" && /index\.html/.test(p.url));
    } catch {
      /* pas encore prêt */
    }
    if (!page) await sleep(500);
  }
  if (!page) throw new Error("fenêtre OtterDesk introuvable via DevTools");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  const exceptions = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
    if (m.method === "Runtime.exceptionThrown") {
      exceptions.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.result?.exceptionDetails) {
      throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
    }
    return r.result?.result?.value;
  };
  await send("Runtime.enable");
  return { ws, evaluate, exceptions };
}

async function waitFor(evaluate, expression, label, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await evaluate(expression)) return true;
    } catch {
      /* page en cours de chargement */
    }
    await sleep(250);
  }
  throw new Error(`délai dépassé : ${label}`);
}

function readClipboard() {
  if (isWin) {
    return execFileSync("powershell", ["-NoProfile", "-Command", "Get-Clipboard -Raw"], { encoding: "utf8" }).replace(/\r?\n$/, "");
  }
  return null; // macOS / Linux : non vérifié (on ne touche pas au presse-papiers de l'utilisateur)
}

// ─── Scénario ────────────────────────────────────────────────────────────────

const MARK = `Smoke ${Date.now()}`;
let app = launch();
try {
  let { ws, evaluate, exceptions } = await connect();
  await waitFor(evaluate, "document.querySelector('#root')?.children.length > 0", "rendu de l'interface");
  await waitFor(evaluate, "document.querySelectorAll('h1').length > 0", "projet sélectionné");

  const platform = await evaluate("window.api.platform");
  check("démarrage et rendu de l'interface", true, `plateforme ${platform}`);
  check("plateforme attendue", platform === process.platform, platform);
  const version = await evaluate("window.api.app.getInfo().then((i) => i.version)");
  check("version de l'application", /^\d+\.\d+\.\d+/.test(version), version);
  check("CSP présente", await evaluate(`!!document.querySelector('meta[http-equiv="Content-Security-Policy"]')`));

  // SQLite : base créée dans le dossier de données isolé, données de démonstration lisibles
  check("base SQLite créée", existsSync(path.join(userData, "otterdesk.db")), path.join(userData, "otterdesk.db"));
  const seeded = await evaluate("window.api.projects.getAll().then((p) => p.length)");
  check("lecture SQLite (projets de démonstration)", seeded > 0, `${seeded} projet(s)`);

  // Gestion des projets et commandes (écriture SQLite)
  const projectId = await evaluate(
    `window.api.projects.create({ name: ${JSON.stringify(MARK)}, description: "test", color: "#6366f1" }).then((p) => p.id)`
  );
  check("création d'un projet", Number.isInteger(projectId), projectId);
  const commandId = await evaluate(`window.api.commands.create({
      project_id: ${projectId}, title: "Commande smoke", command: "echo otterdesk-smoke",
      description: "", category: "Test", is_favorite: false, tags: ["smoke"] }).then((c) => c.id)`);
  check("création d'une commande", Number.isInteger(commandId), commandId);
  await evaluate(`window.api.commands.update({ id: ${commandId}, project_id: ${projectId}, title: "Commande smoke modifiée",
      command: "echo otterdesk-smoke", description: "", category: "Test", is_favorite: true, tags: ["smoke"] })`);
  const updated = await evaluate(`window.api.commands.getByProject(${projectId})`);
  check(
    "modification d'une commande",
    updated.length === 1 && updated[0].title === "Commande smoke modifiée" && updated[0].is_favorite === true,
    updated[0]?.title
  );
  const found = await evaluate(`window.api.commands.search("otterdesk-smoke").then((r) => r.length)`);
  check("recherche", found >= 1, `${found} résultat(s)`);

  // Navigation : sélection du projet dans la barre latérale (rechargement pour l'afficher)
  await evaluate("location.reload()");
  await sleep(1500);
  ({ ws, evaluate, exceptions } = await connect());
  await waitFor(evaluate, `[...document.querySelectorAll("span")].some((s) => s.textContent === ${JSON.stringify(MARK)})`, "projet dans la barre latérale");
  await evaluate(`[...document.querySelectorAll("span")].find((s) => s.textContent === ${JSON.stringify(MARK)}).closest("div").click()`);
  await waitFor(evaluate, `[...document.querySelectorAll("h1")].some((h) => h.textContent.includes(${JSON.stringify(MARK)}))`, "affichage du projet");
  check("navigation vers un projet", true);
  check("commande affichée", await evaluate(`document.body.innerText.includes("echo otterdesk-smoke")`));

  // Bouton Copier (presse-papiers vérifié sous Windows uniquement)
  await evaluate(`document.querySelector('button[title="Copier"]').click()`);
  await sleep(500);
  if (isWin) {
    const clip = readClipboard();
    check("bouton Copier → presse-papiers", clip === "echo otterdesk-smoke", JSON.stringify(clip));
  } else {
    check("bouton Copier (retour visuel)", await evaluate(`!!document.querySelector('button[title="Copié !"]')`));
  }

  // Barre de titre et intégrations propres à la plateforme
  if (isWin) {
    const controls = await evaluate(`["Réduire", "Agrandir", "Fermer"].every((t) => !!document.querySelector('button[title="' + t + '"]'))`);
    check("barre de titre Windows (Réduire, Agrandir, Fermer)", controls);
    const terminals = await evaluate("window.api.terminals.list()");
    check("intégrations terminaux macOS désactivées", terminals.supported === false, JSON.stringify(terminals));
    check("aucun bouton Envoyer", await evaluate(`!document.querySelector('[aria-haspopup="menu"][title*="terminal"]')`));
    const send = await evaluate(`window.api.terminals.send({ targetId: "x:y", commandId: ${commandId}, step: 0, mode: "execute" })`);
    check("envoi vers un terminal refusé", send?.ok === false, send?.message);
  } else {
    check("barre de titre macOS (sans boutons Windows)", await evaluate(`!document.querySelector('button[title="Réduire"]')`));
  }

  // Protections
  const start = await evaluate("location.href");
  await evaluate(`location.assign("https://example.com/")`);
  await sleep(800);
  check("navigation externe bloquée", (await evaluate("location.href")) === start);
  check("window.open refusé", await evaluate(`window.open("https://example.com") === null`));

  check("aucune exception JavaScript", exceptions.length === 0, exceptions.join(" | "));
  ws.close();

  // Persistance : redémarrage avec le même dossier de données
  await stop(app);
  app = launch();
  ({ ws, evaluate, exceptions } = await connect());
  await waitFor(evaluate, "document.querySelector('#root')?.children.length > 0", "rendu après redémarrage");
  const persisted = await evaluate(
    `window.api.projects.getAll().then((ps) => ps.find((p) => p.name === ${JSON.stringify(MARK)})).then((p) => p ? window.api.commands.getByProject(p.id) : [])`
  );
  check("persistance après redémarrage", persisted.length === 1 && persisted[0].command === "echo otterdesk-smoke", persisted[0]?.title);
  const reseeded = await evaluate("window.api.projects.getAll().then((p) => p.length)");
  check("pas de nouvelle création des données de démonstration", reseeded === seeded + 1, `${reseeded} projet(s)`);

  // Suppression (nettoyage, écriture SQLite)
  await evaluate(`window.api.projects.delete(${projectId})`);
  const after = await evaluate(`window.api.projects.getAll().then((ps) => ps.some((p) => p.id === ${projectId}))`);
  check("suppression d'un projet", after === false);
  ws.close();
} catch (e) {
  check("scénario complet", false, e instanceof Error ? e.message : String(e));
  if (app.output) console.error(app.output.slice(-2000));
} finally {
  await stop(app);
  try {
    rmSync(userData, { recursive: true, force: true });
  } catch {
    /* fichiers encore verrouillés : dossier temporaire */
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies`);
// GitHub Actions : résultats visibles comme annotations de l'exécution
if (process.env.GITHUB_ACTIONS) {
  const esc = (t) => String(t).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  const label = path.basename(jsonOut ?? exe);
  console.log(`::notice title=Test de fumée ${label}::${esc(`${results.length - failed.length}/${results.length} vérifications réussies (${process.platform})\n${results.map((r) => `${r.ok ? "✔" : "✖"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`).join("\n")}`)}`);
  for (const f of failed) console.log(`::error title=Test de fumée ${label}::${esc(`${f.name} — ${f.detail}`)}`);
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ platform: process.platform, results }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);

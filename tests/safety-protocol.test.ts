import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkSendableCommand, destructiveReason } from "../src/shared/commandSafety";
import { LineDecoder, parseClientMessage, parseServerMessage } from "../src/shared/terminalBridge/protocol";
import {
  derivePairingKey,
  generatePairingCode,
  newNonce,
  newSecret,
  normalizePairingCode,
  openSecret,
  sealSecret,
} from "../src/shared/terminalBridge/crypto";

describe("checkSendableCommand", () => {
  it("accepte une commande simple et retire les espaces / sauts de ligne finaux", () => {
    const r = checkSendableCommand("docker compose up -d \n");
    assert.deepEqual(r, { ok: true, text: "docker compose up -d" });
  });
  it("refuse une commande vide", () => {
    assert.equal(checkSendableCommand("   ").ok, false);
    assert.equal(checkSendableCommand(undefined).ok, false);
  });
  it("refuse une commande multi-ligne (sinon exécutée en mode insertion)", () => {
    const r = checkSendableCommand("cd app\nnpm i");
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.reason, "multiline");
  });
  it("refuse les caractères de contrôle (Ctrl+C, échappements)", () => {
    for (const s of ["ls\u0003", "echo \u001b[31m", "a\u007f"]) {
      const r = checkSendableCommand(s);
      assert.equal(!r.ok && r.reason, "control-chars", JSON.stringify(s));
    }
    assert.equal(checkSendableCommand("printf 'a\tb'").ok, true);
  });
  it("refuse une commande trop longue", () => {
    assert.equal(checkSendableCommand("x".repeat(9000)).ok, false);
  });
});

describe("destructiveReason", () => {
  const dangerous = [
    "rm -rf node_modules",
    "sudo apt update",
    "git reset --hard HEAD~1",
    "git push --force origin main",
    "git push -f",
    "git clean -fd",
    "docker system prune -a",
    "docker compose down -v",
    "php bin/console doctrine:database:drop --force",
    "DROP TABLE users;",
    "kubectl delete pod x",
    "terraform destroy",
  ];
  const safe = [
    "docker compose up -d",
    "git status",
    "git push origin main",
    "npm run dev",
    "ls -la",
    "rmdir vide",
    "git checkout -b feature/x",
    "php bin/console cache:clear",
  ];
  for (const c of dangerous) it(`signale : ${c}`, () => assert.notEqual(destructiveReason(c), null));
  for (const c of safe) it(`ne signale pas : ${c}`, () => assert.equal(destructiveReason(c), null));
});

describe("protocole", () => {
  const nonce = newNonce();
  it("valide un hello correct", () => {
    assert.ok(parseClientMessage({ type: "hello", protocol: 1, clientNonce: nonce }));
  });
  it("refuse les champs inconnus, types incorrects et identifiants avec « : »", () => {
    assert.equal(parseClientMessage({ type: "hello", protocol: 1, clientNonce: nonce, extra: 1 }), null);
    assert.equal(parseClientMessage({ type: "hello", protocol: "1", clientNonce: nonce }), null);
    assert.equal(parseClientMessage({ type: "terminal-removed", terminalId: "a:b" }), null);
    assert.equal(parseClientMessage({ type: "exec", cmd: "rm -rf /" }), null);
    assert.equal(parseClientMessage(null), null);
  });
  it("valide un enregistrement complet", () => {
    const msg = {
      type: "register",
      client: { instanceId: "abc-1", appName: "Visual Studio Code", workspaceName: "bulle-back-end", workspaceFolders: ["/x"] },
      terminals: [{ terminalId: "t1", name: "zsh", index: 1, state: "idle", shellIntegration: true }],
    };
    assert.ok(parseClientMessage(msg));
    const bad = structuredClone(msg);
    (bad.terminals[0] as Record<string, unknown>).state = "running";
    assert.equal(parseClientMessage(bad), null);
  });
  it("valide les messages serveur", () => {
    assert.ok(parseServerMessage({ type: "send", requestId: "r1", terminalId: "t1", text: "ls", execute: false }));
    assert.equal(parseServerMessage({ type: "send", requestId: "r1", terminalId: "t1", text: "ls" }), null);
  });
  it("découpe les lignes et refuse une ligne trop longue", () => {
    const d = new LineDecoder(100);
    assert.deepEqual(d.push('{"a":1}\n{"b"'), [{ a: 1 }]);
    assert.deepEqual(d.push(":2}\n"), [{ b: 2 }]);
    assert.throws(() => new LineDecoder(10).push("x".repeat(50)));
  });
});

describe("cryptographie d'appairage", () => {
  it("génère des codes XXXX-XXXX sans caractères ambigus", () => {
    for (let i = 0; i < 50; i++) assert.match(generatePairingCode(), /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
    assert.equal(normalizePairingCode("abcd efgh"), "ABCDEFGH");
  });
  it("chiffre et déchiffre le secret ; un autre code échoue", () => {
    const cN = newNonce(), sN = newNonce();
    const key = derivePairingKey("ABCD-EFGH", cN, sN);
    const secret = newSecret();
    const sealed = sealSecret(key, secret);
    assert.deepEqual(openSecret(derivePairingKey("abcd efgh", cN, sN), sealed), secret);
    assert.throws(() => openSecret(derivePairingKey("ABCD-EFGJ", cN, sN), sealed));
  });
});

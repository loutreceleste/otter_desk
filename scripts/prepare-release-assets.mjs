// Prépare les fichiers à joindre à une GitHub Release dans release/github/ :
//   - OtterDesk-<version>-arm64.dmg     (archive versionnée)
//   - OtterDesk-mac-arm64.dmg           (nom stable → lien permanent du README)
//   - otterdesk-terminal-bridge.vsix    (extension VS Code, si elle a été construite)
//   - SHA256SUMS.txt
// Les fichiers sont des liens physiques (aucun doublon sur le disque).
import { createHash } from "node:crypto";
import { createReadStream, existsSync, linkSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const out = path.join(root, "release", "github");

const versionedDmg = path.join(root, "release", `OtterDesk-${version}-arm64.dmg`);
if (!existsSync(versionedDmg)) {
  console.error(`✖ DMG introuvable : ${path.relative(root, versionedDmg)} — lancez d'abord « npm run dist:mac ».`);
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const assets = [
  [versionedDmg, `OtterDesk-${version}-arm64.dmg`],
  [versionedDmg, "OtterDesk-mac-arm64.dmg"],
];
const vsix = path.join(root, "vscode-extension", "otterdesk-terminal-bridge.vsix");
if (existsSync(vsix)) assets.push([vsix, "otterdesk-terminal-bridge.vsix"]);

const sha256 = (file) =>
  new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file).on("data", (d) => h.update(d)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });

const sums = [];
for (const [src, name] of assets) {
  linkSync(src, path.join(out, name));
  sums.push(`${await sha256(src)}  ${name}`);
  console.log(`✓ ${name} (${(statSync(src).size / 1e6).toFixed(1)} Mo)`);
}
writeFileSync(path.join(out, "SHA256SUMS.txt"), sums.join("\n") + "\n");
console.log(`✓ SHA256SUMS.txt\n→ ${path.relative(root, out)}/`);

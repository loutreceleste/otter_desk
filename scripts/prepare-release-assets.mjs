// Prépare les fichiers à joindre à une GitHub Release dans release/github/.
//
//   node scripts/prepare-release-assets.mjs                     (local : tout ce qui a été construit)
//   node scripts/prepare-release-assets.mjs --platform mac      (CI : DMG + VSIX)
//   node scripts/prepare-release-assets.mjs --platform win      (CI : exécutables Windows)
//   node scripts/prepare-release-assets.mjs --platform win --no-checksums
//
// Fichiers produits :
//   macOS    OtterDesk-<version>-arm64.dmg           (versionné)
//            OtterDesk-mac-arm64.dmg                 (nom stable → lien permanent du README)
//   Windows  OtterDesk-<version>-Setup-x64.exe       (versionné)
//            OtterDesk-Windows-Setup-x64.exe         (nom stable)
//            OtterDesk-<version>-Portable-x64.exe    (versionné)
//            OtterDesk-Windows-Portable-x64.exe      (nom stable)
//   VS Code  otterdesk-terminal-bridge.vsix
//   SHA256SUMS.txt (sauf --no-checksums : la CI le calcule sur l'ensemble des plateformes)
//
// Le dossier traité est le dossier courant (racine du projet construit), ce qui permet
// d'utiliser ce script sur les sources d'un tag plus ancien.
import { createHash } from "node:crypto";
import { copyFileSync, createReadStream, existsSync, linkSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const platformArg = args.includes("--platform") ? args[args.indexOf("--platform") + 1] : "all";
if (!["all", "mac", "win"].includes(platformArg)) {
  console.error(`✖ Plateforme inconnue : ${platformArg} (mac, win)`);
  process.exit(1);
}
const withChecksums = !args.includes("--no-checksums");

const root = process.cwd();
const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const releaseDir = path.join(root, "release");
const out = path.join(releaseDir, "github");
const fail = (msg) => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};

/** [source, nom publié] */
const assets = [];

// ─── macOS ───────────────────────────────────────────────────────────────────
const dmg = path.join(releaseDir, `OtterDesk-${version}-arm64.dmg`);
if (platformArg === "mac" || (platformArg === "all" && existsSync(dmg))) {
  if (!existsSync(dmg)) fail(`DMG introuvable : release/OtterDesk-${version}-arm64.dmg — lancez d'abord « npm run dist:mac ».`);
  assets.push([dmg, `OtterDesk-${version}-arm64.dmg`], [dmg, "OtterDesk-mac-arm64.dmg"]);
  const vsix = path.join(root, "vscode-extension", "otterdesk-terminal-bridge.vsix");
  if (existsSync(vsix)) assets.push([vsix, "otterdesk-terminal-bridge.vsix"]);
  else if (platformArg === "mac") fail("VSIX introuvable : construisez l'extension (cd vscode-extension && npm run package).");
}

// ─── Windows ─────────────────────────────────────────────────────────────────
// Recherche tolérante : noms actuels (OtterDesk-<v>-Setup-x64.exe) comme anciens
// (« OtterDesk Setup <v>.exe », « OtterDesk-<v>-portable.exe »). Le désinstallateur
// temporaire de NSIS et les .blockmap sont ignorés.
const exes = existsSync(releaseDir)
  ? readdirSync(releaseDir).filter((f) => /\.exe$/i.test(f) && f.includes(version) && !/uninstaller/i.test(f))
  : [];
const setups = exes.filter((f) => /setup/i.test(f));
const portables = exes.filter((f) => /portable/i.test(f));
if (platformArg === "win" || (platformArg === "all" && (setups.length || portables.length))) {
  if (setups.length !== 1) fail(`Installateur Windows : ${setups.length} fichier(s) trouvé(s) dans release/ (${setups.join(", ") || "aucun"}) — lancez « npm run dist:win ».`);
  if (portables.length !== 1) fail(`Version portable Windows : ${portables.length} fichier(s) trouvé(s) dans release/ (${portables.join(", ") || "aucun"}).`);
  const setup = path.join(releaseDir, setups[0]);
  const portable = path.join(releaseDir, portables[0]);
  assets.push(
    [setup, `OtterDesk-${version}-Setup-x64.exe`],
    [setup, "OtterDesk-Windows-Setup-x64.exe"],
    [portable, `OtterDesk-${version}-Portable-x64.exe`],
    [portable, "OtterDesk-Windows-Portable-x64.exe"]
  );
}

if (assets.length === 0) fail("Aucun fichier à publier : construisez d'abord l'application (npm run dist:mac / dist:win).");

// ─── Copie et sommes de contrôle ─────────────────────────────────────────────
const sha256 = (file) =>
  new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file).on("data", (d) => h.update(d)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const sums = [];
for (const [src, name] of assets) {
  const dest = path.join(out, name);
  try {
    linkSync(src, dest); // lien physique : aucun doublon sur le disque
  } catch {
    copyFileSync(src, dest);
  }
  if (withChecksums) sums.push(`${await sha256(dest)}  ${name}`);
  console.log(`✓ ${name} (${(statSync(dest).size / 1e6).toFixed(1)} Mo)`);
}
if (withChecksums) {
  sums.sort((a, b) => (a.slice(66) < b.slice(66) ? -1 : a.slice(66) > b.slice(66) ? 1 : 0)); // ordre stable (comme « LC_ALL=C sort -k2 »)
  writeFileSync(path.join(out, "SHA256SUMS.txt"), sums.join("\n") + "\n");
  console.log("✓ SHA256SUMS.txt");
}
console.log(`→ ${path.relative(root, out)}/`);

// Génère resources/icon.ico et copie les assets vers le renderer
const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");
const pngToIco = require("png-to-ico");

const ROOT = path.join(__dirname, "..");

const assetsDir = path.join(ROOT, "src", "renderer", "src", "assets");
const publicDir = path.join(ROOT, "src", "renderer", "public");
fs.mkdirSync(assetsDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const iconSrc = path.join(ROOT, "resources", "icon.png");

async function main() {
  if (fs.existsSync(iconSrc)) {
    // Redimensionne en carré 256x256 (contenu centré, fond transparent)
    const image = await Jimp.read(iconSrc);
    image.contain(256, 256);
    const squarePng = await image.getBufferAsync(Jimp.MIME_PNG);
    const ico = await pngToIco(squarePng);
    fs.writeFileSync(path.join(ROOT, "resources", "icon.ico"), ico);
    fs.copyFileSync(iconSrc, path.join(publicDir, "icon.png"));
    console.log("✓ icon.ico généré (256x256) + public/icon.png copié");
  } else {
    console.warn("⚠ resources/icon.png introuvable");
  }

  const headbandSrc = path.join(ROOT, "resources", "headband.png");
  if (fs.existsSync(headbandSrc)) {
    fs.copyFileSync(headbandSrc, path.join(assetsDir, "headband.png"));
    console.log("✓ headband.png copié dans src/renderer/src/assets/");
  } else {
    console.warn("⚠ resources/headband.png introuvable");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

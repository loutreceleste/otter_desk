// Génère les icônes dérivées de resources/icon.png et copie les assets vers le renderer :
//   - resources/icon.ico              (Windows)
//   - resources/icon-mac.png          (macOS, 1024x1024, gabarit « squircle » → .icns par electron-builder)
//   - resources/trayTemplate(@2x).png (macOS, barre des menus, silhouette monochrome)
// Une icône n'est générée que si elle est absente, pour ne pas écraser les fichiers
// commités (ex. icon.ico) à chaque build. Pour régénérer après une modification :
//   FORCE_ICONS=all node scripts/generate-icon.js        (toutes les icônes)
//   FORCE_ICONS=mac,tray node scripts/generate-icon.js   (cibles : ico, mac, tray)
const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");
const pngToIco = require("png-to-ico");

const ROOT = path.join(__dirname, "..");
const RES = path.join(ROOT, "resources");

const assetsDir = path.join(ROOT, "src", "renderer", "src", "assets");
const publicDir = path.join(ROOT, "src", "renderer", "public");
fs.mkdirSync(assetsDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const iconSrc = path.join(RES, "icon.png");

const FORCED = new Set((process.env.FORCE_ICONS || "").split(",").map((v) => v.trim()).filter(Boolean));

function isStale(target, kind) {
  return FORCED.has("all") || FORCED.has("1") || FORCED.has(kind) || !fs.existsSync(target);
}

// Windows : carré 256x256 (contenu centré, fond transparent)
async function buildIco() {
  const target = path.join(RES, "icon.ico");
  if (!isStale(target, "ico")) return console.log("• icon.ico à jour");
  const image = await Jimp.read(iconSrc);
  image.contain(256, 256);
  const ico = await pngToIco(await image.getBufferAsync(Jimp.MIME_PNG));
  fs.writeFileSync(target, ico);
  console.log("✓ icon.ico généré (256x256)");
}

// Couleur de fond du logo : teinte claire opaque la plus fréquente (le crème du disque)
function dominantLightColor(img) {
  const hist = new Map();
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
    const d = this.bitmap.data;
    if (d[idx + 3] === 255 && d[idx] > 235 && d[idx + 1] > 235 && d[idx + 2] > 235) {
      const k = (d[idx] << 16) | (d[idx + 1] << 8) | d[idx + 2];
      hist.set(k, (hist.get(k) || 0) + 1);
    }
  });
  let best = 0xffffff, n = -1;
  for (const [k, c] of hist) if (c > n) { best = k; n = c; }
  return { r: (best >> 16) & 255, g: (best >> 8) & 255, b: best & 255 };
}

// macOS : gabarit d'icône d'application (Big Sur → Tahoe) :
//   canevas 1024x1024, forme « squircle » de 824x824 centrée (marges de 100 px),
//   remplie avec le fond crème d'origine du logo, logo inchangé centré dedans.
// Une seule forme arrondie (pas de second masque) : macOS affiche l'icône telle quelle
// au lieu de la placer dans un carré gris (« icon jail » de macOS Tahoe).
// Aucun effet ajouté (ni ombre, ni dégradé, ni relief).
async function buildMacIcon() {
  const target = path.join(RES, "icon-mac.png");
  if (!isStale(target, "mac")) return console.log("• icon-mac.png à jour");

  const SIZE = 1024, BODY = 824, OFFSET = (SIZE - BODY) / 2, N = 5; // superellipse ≈ coins continus Apple
  const logo = await Jimp.read(iconSrc);
  const bg = dominantLightColor(logo);
  const canvas = new Jimp(SIZE, SIZE, 0x00000000);

  // Squircle anticrénelé (suréchantillonnage 4x4)
  const half = BODY / 2, cx = SIZE / 2, cy = SIZE / 2, SS = 4;
  canvas.scan(0, 0, SIZE, SIZE, function (x, y, idx) {
    let inside = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const u = Math.abs((x + (sx + 0.5) / SS - cx) / half);
        const v = Math.abs((y + (sy + 0.5) / SS - cy) / half);
        if (Math.pow(u, N) + Math.pow(v, N) <= 1) inside++;
      }
    }
    if (inside > 0) {
      this.bitmap.data[idx] = bg.r;
      this.bitmap.data[idx + 1] = bg.g;
      this.bitmap.data[idx + 2] = bg.b;
      this.bitmap.data[idx + 3] = Math.round((inside / (SS * SS)) * 255);
    }
  });

  // Le bord extérieur du disque d'origine porte une frange d'anticrénelage sombre
  // (résidu de détourage) qui dessinerait un cercle gris sur le fond crème.
  // Seuls les pixels semi-transparents de cette frange extérieure prennent la couleur
  // du fond (opacité conservée) ; le dessin du logo n'est pas modifié.
  const lw = logo.bitmap.width, lh = logo.bitmap.height;
  let bx0 = lw, by0 = lh, bx1 = 0, by1 = 0;
  logo.scan(0, 0, lw, lh, function (x, y, idx) {
    if (this.bitmap.data[idx + 3] > 200) {
      bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y);
    }
  });
  const ecx = (bx0 + bx1) / 2, ecy = (by0 + by1) / 2, erx = (bx1 - bx0) / 2, ery = (by1 - by0) / 2;
  logo.scan(0, 0, lw, lh, function (x, y, idx) {
    const d = this.bitmap.data;
    const dist = Math.hypot((x - ecx) / erx, (y - ecy) / ery);
    if (d[idx + 3] < 255 && dist > 0.97) {
      d[idx] = bg.r; d[idx + 1] = bg.g; d[idx + 2] = bg.b;
    }
  });

  // Logo d'origine : mise à l'échelle uniforme (proportions conservées), centré dans la forme
  // (scaleToFit plutôt que contain : contain fusionne sur un fond noir transparent,
  //  ce qui assombrit les pixels semi-transparents du bord)
  logo.scaleToFit(BODY, BODY, Jimp.RESIZE_BICUBIC);
  canvas.composite(
    logo,
    OFFSET + Math.round((BODY - logo.bitmap.width) / 2),
    OFFSET + Math.round((BODY - logo.bitmap.height) / 2)
  );
  await canvas.writeAsync(target);
  console.log(`✓ icon-mac.png généré (1024x1024, fond rgb(${bg.r},${bg.g},${bg.b}))`);
}

// macOS : image « Template » de la barre des menus.
// Seuls les traits sombres du logo sont conservés (noir + alpha) ; macOS les
// recolore automatiquement en mode clair / sombre.
async function buildTrayTemplate() {
  const t1 = path.join(RES, "trayTemplate.png");
  const t2 = path.join(RES, "trayTemplate@2x.png");
  if (!isStale(t1, "tray") && !isStale(t2, "tray")) return console.log("• trayTemplate à jour");

  const src = await Jimp.read(iconSrc);
  const { width, height } = src.bitmap;
  const mask = new Jimp(width, height, 0x00000000);
  let minX = width, minY = height, maxX = -1, maxY = -1;

  src.scan(0, 0, width, height, function (x, y, idx) {
    const [r, g, b, a] = this.bitmap.data.slice(idx, idx + 4);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Opacité proportionnelle à la « noirceur » du pixel (anticrénelage conservé)
    const alpha = Math.round(Math.max(0, Math.min(1, (200 - lum) / 140)) * a);
    if (alpha > 0) {
      mask.bitmap.data.writeUInt32BE(alpha, idx); // r=g=b=0, alpha
      if (alpha > 64) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  });

  if (maxX < 0) throw new Error("Aucun trait sombre détecté dans icon.png pour le tray");
  mask.crop(minX, minY, maxX - minX + 1, maxY - minY + 1);

  for (const [size, file] of [[16, t1], [32, t2]]) {
    const img = mask.clone().contain(size, size, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE, Jimp.RESIZE_BICUBIC);
    await img.writeAsync(file);
  }
  console.log("✓ trayTemplate.png (16x16) + trayTemplate@2x.png (32x32) générés");
}

async function main() {
  if (fs.existsSync(iconSrc)) {
    await buildIco();
    await buildMacIcon();
    await buildTrayTemplate();
    fs.copyFileSync(iconSrc, path.join(publicDir, "icon.png"));
    console.log("✓ public/icon.png copié");
  } else {
    console.warn("⚠ resources/icon.png introuvable");
  }

  const headbandSrc = path.join(RES, "headband.png");
  if (fs.existsSync(headbandSrc)) {
    fs.copyFileSync(headbandSrc, path.join(assetsDir, "headband.png"));
    console.log("✓ headband.png copié dans src/renderer/src/assets/");
  } else {
    console.warn("⚠ resources/headband.png introuvable");
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

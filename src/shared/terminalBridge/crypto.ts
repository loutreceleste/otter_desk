// Primitives cryptographiques du pont local (Node.js : main OtterDesk + extension VS Code).
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const LABEL = "otterdesk/terminal-bridge/v1";

export const SECRET_BYTES = 32;

export function newNonce(): string {
  return randomBytes(32).toString("hex");
}

export function newSecret(): Buffer {
  return randomBytes(SECRET_BYTES);
}

function hmacHex(key: Buffer, ...parts: string[]): string {
  return createHmac("sha256", key).update(parts.join("|")).digest("hex");
}

/** Comparaison à temps constant de deux empreintes hexadécimales. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

// ─── Authentification mutuelle avec le secret partagé K ─────────────────────
export const serverProof = (k: Buffer, clientNonce: string, serverNonce: string) =>
  hmacHex(k, LABEL, "server", clientNonce, serverNonce);
export const clientProof = (k: Buffer, serverNonce: string, clientNonce: string) =>
  hmacHex(k, LABEL, "client", serverNonce, clientNonce);

// ─── Appairage par code court ───────────────────────────────────────────────
// Alphabet sans caractères ambigus (0/O, 1/I/L).
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Code d'appairage de 8 caractères (≈ 40 bits), affiché sous la forme XXXX-XXXX. */
export function generatePairingCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizePairingCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Clé dérivée du code (scrypt) liée aux deux nonces de la session d'appairage. */
export function derivePairingKey(code: string, clientNonce: string, serverNonce: string): Buffer {
  return scryptSync(normalizePairingCode(code), `${LABEL}|pair|${clientNonce}|${serverNonce}`, 32, {
    N: 16384,
    r: 8,
    p: 1,
  });
}

export const pairServerProof = (kc: Buffer, clientNonce: string, serverNonce: string) =>
  hmacHex(kc, LABEL, "pair-server", clientNonce, serverNonce);
export const pairClientProof = (kc: Buffer, serverNonce: string, clientNonce: string) =>
  hmacHex(kc, LABEL, "pair-client", serverNonce, clientNonce);

function sealKey(pairingKey: Buffer): Buffer {
  return Buffer.from(hkdfSync("sha256", pairingKey, Buffer.alloc(0), `${LABEL}|seal`, 32));
}

export interface SealedSecret {
  iv: string;
  ciphertext: string;
  tag: string;
}

/** Chiffre le secret partagé K pour le transmettre au client pendant l'appairage. */
export function sealSecret(pairingKey: Buffer, secret: Buffer): SealedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(pairingKey), iv);
  const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function openSecret(pairingKey: Buffer, sealed: SealedSecret): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", sealKey(pairingKey), Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  const secret = Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64")), decipher.final()]);
  if (secret.length !== SECRET_BYTES) throw new Error("secret invalide");
  return secret;
}

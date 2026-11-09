// Stockage du secret d'appairage VS Code, chiffré par safeStorage (Trousseau macOS).
// Le secret n'est jamais écrit en clair : sans chiffrement disponible, l'appairage est refusé.
import { safeStorage } from "electron";
import fs from "node:fs";
import type { SecretStore } from "./bridgeServer";

export class SafeStorageSecretStore implements SecretStore {
  private cache: Buffer | null | undefined;

  constructor(private readonly file: string, private readonly log: (m: string) => void = () => {}) {}

  get(): Buffer | null {
    if (this.cache !== undefined) return this.cache;
    this.cache = null;
    try {
      if (fs.existsSync(this.file) && safeStorage.isEncryptionAvailable()) {
        const b64 = safeStorage.decryptString(fs.readFileSync(this.file));
        const secret = Buffer.from(b64, "base64");
        if (secret.length === 32) this.cache = secret;
      }
    } catch (e) {
      // Secret illisible (trousseau différent, fichier corrompu) : un nouvel appairage sera nécessaire.
      this.log(`[terminal-bridge] secret d'appairage illisible : ${e instanceof Error ? e.message : e}`);
    }
    return this.cache;
  }

  set(secret: Buffer): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Chiffrement du trousseau indisponible : appairage impossible.");
    }
    const encrypted = safeStorage.encryptString(secret.toString("base64"));
    fs.writeFileSync(this.file, encrypted, { mode: 0o600 });
    fs.chmodSync(this.file, 0o600);
    this.cache = Buffer.from(secret);
  }

  clear(): void {
    this.cache = null;
    try {
      fs.unlinkSync(this.file);
    } catch {
      /* absent */
    }
  }
}

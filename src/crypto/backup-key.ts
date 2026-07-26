/** Imports a canonical process/Worker binding as a non-extractable backup-only AES key. */
import {
  createBackupEncryptionKey,
  type BackupEncryptionKey,
} from "./backup-envelope";
import { decodeBase64Url } from "./envelope";

/** Imports and brands a canonical 256-bit backup binding, then clears its mutable decode buffer. */
export async function importBackupEncryptionKey(
  encodedKey: string,
  keyVersion: number,
): Promise<BackupEncryptionKey> {
  let raw: Uint8Array | undefined;
  let keyMaterial: Uint8Array<ArrayBuffer> | undefined;
  try {
    raw = decodeBase64Url(encodedKey, "Backup key", 43);
    if (encodedKey.length !== 43 || raw.byteLength !== 32) {
      throw new Error("Backup key binding is invalid.");
    }
    keyMaterial = new Uint8Array(raw.byteLength);
    keyMaterial.set(raw);
    const key = await crypto.subtle.importKey(
      "raw",
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    return createBackupEncryptionKey(key, keyVersion);
  } catch {
    throw new Error("Backup key binding is invalid.");
  } finally {
    raw?.fill(0);
    keyMaterial?.fill(0);
  }
}

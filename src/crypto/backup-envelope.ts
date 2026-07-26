/** Authenticates and encrypts complete Vision backup payloads with a backup-purpose AES key. */
import {
  decodeBase64Url,
  encodeBase64Url,
  validateKeyVersion,
} from "./envelope";

/**
 * Maximum encrypted payload after accounting for a 4 MiB archive's base64
 * expansion, manifest, JSON framing, ciphertext, and Worker heap headroom.
 */
export const MAX_BACKUP_PLAINTEXT_BYTES = 6 * 1024 * 1024;

/** Public serialization metadata for one authenticated encrypted backup object. */
export interface EncryptedBackup {
  readonly format: "vision-backup-envelope";
  readonly version: 1;
  readonly algorithm: "A256GCM";
  readonly keyVersion: number;
  readonly iv: string;
  readonly ciphertext: string;
}

/** A cryptographic key explicitly admitted for the backup-only purpose. */
export interface BackupEncryptionKey {
  readonly purpose: "vision-backup";
  readonly keyVersion: number;
  readonly key: CryptoKey;
}

const ENVELOPE_KEYS = [
  "algorithm",
  "ciphertext",
  "format",
  "iv",
  "keyVersion",
  "version",
] as const;
const IV_BYTES = 12;
const IV_BASE64URL_CHARS = 16;
const MAX_CIPHERTEXT_BASE64URL_CHARS =
  Math.ceil((MAX_BACKUP_PLAINTEXT_BYTES + 16) / 3) * 4;
/** Maximum encoded length for one component inside the bounded plaintext payload. */
export const MAX_BACKUP_COMPONENT_BASE64URL_CHARS =
  Math.ceil(MAX_BACKUP_PLAINTEXT_BYTES / 3) * 4;
const encoder = new TextEncoder();

/** Brands a non-extractable AES-256-GCM key as backup-only after strict validation. */
export function createBackupEncryptionKey(
  key: CryptoKey,
  keyVersion: number,
): BackupEncryptionKey {
  validateBackupCryptoKey(key);
  return Object.freeze({
    purpose: "vision-backup" as const,
    keyVersion: validateKeyVersion(keyVersion),
    key,
  });
}

/** Encrypts an already assembled manifest-plus-archive payload under a fresh IV. */
export async function encryptBackupEnvelope(
  plaintext: Uint8Array,
  backupKey: BackupEncryptionKey,
): Promise<EncryptedBackup> {
  validateBackupKey(backupKey);
  if (
    !(plaintext instanceof Uint8Array) ||
    plaintext.byteLength > MAX_BACKUP_PLAINTEXT_BYTES
  ) {
    throw new Error("Backup plaintext exceeds the supported size.");
  }

  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: backupEnvelopeAad(backupKey.keyVersion),
      tagLength: 128,
    },
    backupKey.key,
    copyToArrayBuffer(plaintext),
  );

  return Object.freeze({
    format: "vision-backup-envelope" as const,
    version: 1 as const,
    algorithm: "A256GCM" as const,
    keyVersion: backupKey.keyVersion,
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
  });
}

/** Authenticates and decrypts a complete backup payload without exposing partial plaintext. */
export async function decryptBackupEnvelope(
  encrypted: unknown,
  backupKey: BackupEncryptionKey,
): Promise<Uint8Array> {
  validateBackupKey(backupKey);
  const envelope = validateEncryptedBackup(encrypted);
  if (envelope.keyVersion !== backupKey.keyVersion) {
    throw new Error("Backup key version does not match the encrypted object.");
  }

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: copyToArrayBuffer(
          decodeBase64Url(
            envelope.iv,
            "Backup IV",
            IV_BASE64URL_CHARS,
          ),
        ),
        additionalData: backupEnvelopeAad(envelope.keyVersion),
        tagLength: 128,
      },
      backupKey.key,
      copyToArrayBuffer(
        decodeBase64Url(
          envelope.ciphertext,
          "Backup ciphertext",
          MAX_CIPHERTEXT_BASE64URL_CHARS,
        ),
      ),
    );
    const plaintextBytes = new Uint8Array(plaintext);
    if (plaintextBytes.byteLength > MAX_BACKUP_PLAINTEXT_BYTES) {
      throw new Error("Backup plaintext exceeds the supported size.");
    }
    return plaintextBytes;
  } catch {
    throw new Error("Backup authentication failed.");
  }
}

/** Serializes an encrypted backup using one deterministic closed JSON shape. */
export function serializeEncryptedBackup(encrypted: unknown): string {
  const envelope = validateEncryptedBackup(encrypted);
  return JSON.stringify({
    format: envelope.format,
    version: envelope.version,
    algorithm: envelope.algorithm,
    keyVersion: envelope.keyVersion,
    iv: envelope.iv,
    ciphertext: envelope.ciphertext,
  });
}

/** Parses and validates an encrypted backup object from persisted JSON. */
export function parseEncryptedBackup(serialized: string): EncryptedBackup {
  if (
    typeof serialized !== "string" ||
    serialized.length === 0 ||
    serialized.length > MAX_CIPHERTEXT_BASE64URL_CHARS + 512
  ) {
    throw new Error("Encrypted backup serialization is invalid.");
  }
  try {
    return validateEncryptedBackup(JSON.parse(serialized));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Encrypted backup")) {
      throw error;
    }
    throw new Error("Encrypted backup serialization is invalid.");
  }
}

/** Strictly validates envelope structure, algorithm, sizes, and canonical encoding. */
export function validateEncryptedBackup(value: unknown): EncryptedBackup {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("Encrypted backup must be an object.");
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("Encrypted backup must be a plain object.");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(value);
    if (
      keys.some(
        (key) =>
          typeof key !== "string" ||
          !descriptors[key]?.enumerable ||
          !("value" in descriptors[key]!),
      )
    ) {
      throw new Error("Encrypted backup fields are invalid.");
    }
    const actualKeys = keys.map(String).sort();
    const expectedKeys = [...ENVELOPE_KEYS].sort();
    if (
      actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key, index) => key !== expectedKeys[index])
    ) {
      throw new Error("Encrypted backup fields do not match version 1.");
    }
    const record = Object.fromEntries(
      Object.entries(descriptors).map(([key, descriptor]) => [
        key,
        descriptor.value,
      ]),
    );
    if (
      record.format !== "vision-backup-envelope" ||
      record.version !== 1 ||
      record.algorithm !== "A256GCM"
    ) {
      throw new Error("Encrypted backup version or algorithm is unsupported.");
    }
    const keyVersion = validateKeyVersion(record.keyVersion);
    if (
      typeof record.iv !== "string" ||
      record.iv.length !== IV_BASE64URL_CHARS ||
      decodeBase64Url(
        record.iv,
        "Backup IV",
        IV_BASE64URL_CHARS,
      ).byteLength !== IV_BYTES
    ) {
      throw new Error("Encrypted backup IV is invalid.");
    }
    if (
      typeof record.ciphertext !== "string" ||
      record.ciphertext.length < 22 ||
      record.ciphertext.length > MAX_CIPHERTEXT_BASE64URL_CHARS
    ) {
      throw new Error("Encrypted backup ciphertext size is invalid.");
    }
    decodeBase64Url(
      record.ciphertext,
      "Backup ciphertext",
      MAX_CIPHERTEXT_BASE64URL_CHARS,
    );

    return Object.freeze({
      format: "vision-backup-envelope" as const,
      version: 1 as const,
      algorithm: "A256GCM" as const,
      keyVersion,
      iv: record.iv,
      ciphertext: record.ciphertext,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Encrypted backup")) {
      throw error;
    }
    throw new Error("Encrypted backup is invalid.");
  }
}

/** Encodes the immutable purpose and envelope version as AES-GCM additional data. */
function backupEnvelopeAad(keyVersion: number): Uint8Array<ArrayBuffer> {
  return copyToArrayBuffer(
    encoder.encode(
      JSON.stringify(["vision-backup-envelope", 1, "A256GCM", keyVersion]),
    ),
  );
}

/** Validates the purpose wrapper and its exact key-version binding. */
function validateBackupKey(backupKey: BackupEncryptionKey): void {
  if (
    typeof backupKey !== "object" ||
    backupKey === null ||
    backupKey.purpose !== "vision-backup"
  ) {
    throw new Error("A backup-purpose encryption key is required.");
  }
  validateKeyVersion(backupKey.keyVersion);
  validateBackupCryptoKey(backupKey.key);
}

/** Requires a non-extractable AES-256-GCM key capable of both backup operations. */
function validateBackupCryptoKey(key: CryptoKey): void {
  const algorithm = key?.algorithm as AesKeyAlgorithm | undefined;
  if (
    key?.type !== "secret" ||
    key.extractable ||
    algorithm?.name !== "AES-GCM" ||
    algorithm.length !== 256 ||
    !key.usages.includes("encrypt") ||
    !key.usages.includes("decrypt")
  ) {
    throw new Error(
      "Backup encryption requires a non-extractable AES-256-GCM key.",
    );
  }
}

/** Copies an arbitrary byte view into a Web Crypto-compatible owned ArrayBuffer. */
function copyToArrayBuffer(
  bytes: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

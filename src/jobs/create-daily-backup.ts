/** Creates and verifies one encrypted logical backup object per UTC date. */
import {
  decryptBackupEnvelope,
  parseEncryptedBackup,
  serializeEncryptedBackup,
  type BackupEncryptionKey,
} from "../crypto/backup-envelope";
import { decodeBase64Url } from "../crypto/envelope";
import {
  countSnapshotRows,
  decodeCanonicalBackupArchive,
  exportBackup,
  parseBackupPayload,
  sha256Base64Url,
} from "../data/backup/export-backup";
import {
  BACKUP_FORMAT_V1,
  BACKUP_TABLES,
  validateBackupManifest,
  type BackupSnapshotV1,
} from "../domain/backup/manifest";

/** Fixed private prefix used by creation, restore, and retention. */
export const BACKUP_OBJECT_PREFIX = "backups/v1/" as const;

/** The sole safe custom-metadata shape stored beside an encrypted object. */
export interface BackupObjectMetadata {
  readonly format: typeof BACKUP_FORMAT_V1;
  readonly createdDate: string;
  readonly ciphertextSha256: string;
  readonly keyVersion: string;
}

/** Safe object facts exposed by the R2 adapter without body content. */
export interface BackupObjectHead {
  readonly key: string;
  readonly etag: string;
  readonly customMetadata: Readonly<Record<string, string>>;
  readonly bodySha256?: string;
}

/** Narrow object-storage port shared by backup creation and retention. */
export interface BackupObjectStore {
  putIfAbsent(
    key: string,
    body: Uint8Array,
    customMetadata: BackupObjectMetadata,
    bodySha256: string,
  ): Promise<boolean>;
  head(key: string): Promise<BackupObjectHead | null>;
  get(
    key: string,
  ): Promise<
    | (BackupObjectHead & {
        readonly body: Uint8Array;
      })
    | null
  >;
  list(
    prefix: string,
    cursor?: string,
  ): Promise<{
    readonly objects: readonly BackupObjectHead[];
    readonly cursor?: string;
  }>;
  delete(key: string): Promise<void>;
}

/** Database boundary that owns one complete repeatable-read capture. */
export interface BackupSnapshotSource {
  readConsistentSnapshot(): Promise<BackupSnapshotV1>;
}

/** Dependencies kept explicit for deterministic storage and race tests. */
export interface CreateDailyBackupDependencies {
  readonly store: BackupObjectStore;
  readonly snapshotSource: BackupSnapshotSource;
  readonly backupKey: BackupEncryptionKey;
}

/** Safe evidence for one created or already-existing verified daily backup. */
export interface BackupResult {
  readonly status: "created" | "existing";
  readonly objectKey: string;
  readonly createdDate: string;
  readonly ciphertextSha256: string;
  readonly keyVersion: number;
}

const encoder = new TextEncoder();
const METADATA_KEYS = [
  "ciphertextSha256",
  "createdDate",
  "format",
  "keyVersion",
] as const;
const SHA256_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

/** Conditionally creates, then independently heads and reads one daily object. */
export async function createDailyBackup(
  now: Date,
  dependencies: CreateDailyBackupDependencies,
): Promise<BackupResult> {
  const createdDate = utcDate(now);
  const objectKey = await dailyObjectKey(createdDate);
  let existing: BackupObjectHead | null;
  try {
    existing = await dependencies.store.head(objectKey);
  } catch {
    throw new Error("Backup storage read failed.");
  }
  if (existing) {
    return verifyStoredBackup(
      dependencies.store,
      objectKey,
      createdDate,
      dependencies.backupKey,
      "existing",
    );
  }

  let body: Uint8Array;
  let bodySha256: string;
  let ciphertextSha256: string;
  let customMetadata: BackupObjectMetadata;
  try {
    const snapshot =
      await dependencies.snapshotSource.readConsistentSnapshot();
    const encrypted = await exportBackup(snapshot, dependencies.backupKey, {
      createdAt: now.toISOString(),
    });
    body = encoder.encode(serializeEncryptedBackup(encrypted));
    bodySha256 = await sha256Base64Url(body);
    ciphertextSha256 = await sha256Base64Url(
      decodeBase64Url(
        encrypted.ciphertext,
        "Backup ciphertext",
        encrypted.ciphertext.length,
      ),
    );
    customMetadata = Object.freeze({
      format: BACKUP_FORMAT_V1,
      createdDate,
      ciphertextSha256,
      keyVersion: String(encrypted.keyVersion),
    });
  } catch {
    throw new Error("Backup creation failed.");
  }

  let created: boolean;
  try {
    created = await dependencies.store.putIfAbsent(
      objectKey,
      body,
      customMetadata,
      bodySha256,
    );
  } catch {
    throw new Error("Backup storage write failed.");
  }
  try {
    return await verifyStoredBackup(
      dependencies.store,
      objectKey,
      createdDate,
      dependencies.backupKey,
      created ? "created" : "existing",
    );
  } catch {
    if (created) {
      try {
        await dependencies.store.delete(objectKey);
      } catch {
        // The failed verification remains a failure; retention/operator repair can retry cleanup safely.
      }
    }
    throw new Error("Backup verification failed.");
  }
}

/** Revalidates metadata, native body checksum, canonical envelope, and ciphertext digest. */
export async function verifyStoredBackup(
  store: BackupObjectStore,
  objectKey: string,
  createdDate: string,
  backupKey: BackupEncryptionKey,
  status: BackupResult["status"] = "existing",
): Promise<BackupResult> {
  try {
    const expectedKey = await dailyObjectKey(createdDate);
    if (objectKey !== expectedKey) throw new Error("Unexpected object key.");
    const head = await store.head(objectKey);
    const object = await store.get(objectKey);
    if (
      !head ||
      !object ||
      head.key !== objectKey ||
      object.key !== objectKey ||
      head.etag !== object.etag ||
      typeof head.bodySha256 !== "string" ||
      head.bodySha256 !== object.bodySha256
    ) {
      throw new Error("Object identity changed.");
    }
    const headMetadata = validateMetadata(head.customMetadata, createdDate);
    const bodyMetadata = validateMetadata(object.customMetadata, createdDate);
    if (JSON.stringify(headMetadata) !== JSON.stringify(bodyMetadata)) {
      throw new Error("Metadata changed.");
    }
    const actualBodySha256 = await sha256Base64Url(object.body);
    if (actualBodySha256 !== head.bodySha256) {
      throw new Error("Object checksum mismatch.");
    }
    const serialized = new TextDecoder("utf-8", { fatal: true }).decode(
      object.body,
    );
    const encrypted = parseEncryptedBackup(serialized);
    if (serializeEncryptedBackup(encrypted) !== serialized) {
      throw new Error("Object serialization is not canonical.");
    }
    if (
      encrypted.keyVersion !== Number(headMetadata.keyVersion) ||
      encrypted.format !== "vision-backup-envelope"
    ) {
      throw new Error("Envelope metadata mismatch.");
    }
    const actualCiphertextSha256 = await sha256Base64Url(
      decodeBase64Url(
        encrypted.ciphertext,
        "Backup ciphertext",
        encrypted.ciphertext.length,
      ),
    );
    if (actualCiphertextSha256 !== headMetadata.ciphertextSha256) {
      throw new Error("Ciphertext checksum mismatch.");
    }
    let plaintext: Uint8Array | undefined;
    let archive: Uint8Array | undefined;
    try {
      plaintext = await decryptBackupEnvelope(encrypted, backupKey);
      const payload = parseBackupPayload(plaintext);
      archive = payload.archive;
      const manifest = validateBackupManifest(payload.manifest);
      if (
        manifest.createdAt.slice(0, 10) !== createdDate ||
        manifest.keyVersion !== encrypted.keyVersion ||
        manifest.plaintextSha256 !== await sha256Base64Url(archive)
      ) {
        throw new Error("Backup manifest does not match the object.");
      }
      const rowCounts = countSnapshotRows(
        decodeCanonicalBackupArchive(archive),
      );
      if (
        BACKUP_TABLES.some(
          (table) => rowCounts[table] !== manifest.rowCounts[table],
        )
      ) {
        throw new Error("Backup manifest row counts do not match.");
      }
    } finally {
      plaintext?.fill(0);
      archive?.fill(0);
    }
    return Object.freeze({
      status,
      objectKey,
      createdDate,
      ciphertextSha256: actualCiphertextSha256,
      keyVersion: encrypted.keyVersion,
    });
  } catch {
    throw new Error("Backup verification failed.");
  }
}

/** Derives one content-free deterministic opaque identifier for a UTC date. */
async function dailyObjectKey(createdDate: string): Promise<string> {
  const opaqueId = await sha256Base64Url(
    encoder.encode(`vision-backup-object\u0000${createdDate}`),
  );
  const [year, month, day] = createdDate.split("-");
  return `${BACKUP_OBJECT_PREFIX}${year}/${month}/${day}/${opaqueId}.vision-backup`;
}

/** Converts one valid scheduler instant to its canonical UTC calendar date. */
function utcDate(now: Date): string {
  const time = Date.prototype.getTime.call(now);
  if (!Number.isFinite(time)) throw new Error("Backup time is invalid.");
  return now.toISOString().slice(0, 10);
}

/** Owns and validates the closed privacy-safe custom metadata record. */
function validateMetadata(
  metadata: Readonly<Record<string, string>>,
  createdDate: string,
): BackupObjectMetadata {
  const keys = Object.keys(metadata).sort();
  if (
    keys.length !== METADATA_KEYS.length ||
    keys.some((key, index) => key !== METADATA_KEYS[index]) ||
    metadata.format !== BACKUP_FORMAT_V1 ||
    metadata.createdDate !== createdDate ||
    typeof metadata.ciphertextSha256 !== "string" ||
    !SHA256_PATTERN.test(metadata.ciphertextSha256) ||
    typeof metadata.keyVersion !== "string" ||
    !/^[1-9]\d*$/u.test(metadata.keyVersion) ||
    !Number.isSafeInteger(Number(metadata.keyVersion))
  ) {
    throw new Error("Backup object metadata is invalid.");
  }
  return Object.freeze({
    format: BACKUP_FORMAT_V1,
    createdDate,
    ciphertextSha256: metadata.ciphertextSha256,
    keyVersion: metadata.keyVersion,
  });
}

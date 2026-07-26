/** Defines Vision's closed, versioned logical-backup manifest and authoritative table order. */
import {
  BACKUP_TABLES,
  type BackupTableName,
} from "./schema-contract";

export {
  BACKUP_TABLES,
  type BackupTableName,
} from "./schema-contract";

/** The only logical backup format accepted by this Phase B implementation. */
export const BACKUP_FORMAT_V1 = "vision-backup/v1" as const;

/** The latest migration version represented by this backup contract. */
export const BACKUP_SCHEMA_VERSION = 9 as const;

/** Values accepted from a consistent raw database snapshot. */
export type BackupValue =
  | null
  | boolean
  | number
  | string
  | bigint
  | Date
  | Uint8Array
  | readonly BackupValue[]
  | Readonly<{ [key: string]: BackupValue }>;

/** One raw authoritative row; byte arrays remain application ciphertext. */
export type BackupRow = Readonly<Record<string, BackupValue>>;

/** A complete consistent snapshot at the current migration version. */
export interface BackupSnapshotV1 {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  readonly tables: Readonly<Record<BackupTableName, readonly BackupRow[]>>;
}

/** Row totals for every authoritative table in canonical order. */
export type BackupRowCounts = Readonly<Record<BackupTableName, number>>;

/** Authenticated recovery metadata stored only inside the encrypted payload. */
export interface BackupManifestV1 {
  readonly format: typeof BACKUP_FORMAT_V1;
  readonly createdAt: string;
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  readonly rowCounts: BackupRowCounts;
  readonly plaintextSha256: string;
  readonly keyVersion: number;
}

/** Inputs whose fixed version fields are supplied by the manifest factory. */
export interface CreateBackupManifestInput {
  readonly createdAt: string;
  readonly rowCounts: BackupRowCounts;
  readonly plaintextSha256: string;
  readonly keyVersion: number;
}

const MANIFEST_KEYS = [
  "createdAt",
  "format",
  "keyVersion",
  "plaintextSha256",
  "rowCounts",
  "schemaVersion",
] as const;
const SHA256_BASE64URL_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Creates and revalidates an immutable current-version backup manifest. */
export function createBackupManifest(
  input: CreateBackupManifestInput,
): BackupManifestV1 {
  return validateBackupManifest({
    format: BACKUP_FORMAT_V1,
    createdAt: input.createdAt,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    rowCounts: input.rowCounts,
    plaintextSha256: input.plaintextSha256,
    keyVersion: input.keyVersion,
  });
}

/** Strictly validates an untrusted manifest without accepting version drift or extra fields. */
export function validateBackupManifest(value: unknown): BackupManifestV1 {
  try {
    const record = requirePlainRecord(value, "Backup manifest");
    requireExactKeys(record, MANIFEST_KEYS, "Backup manifest fields");

    if (record.format !== BACKUP_FORMAT_V1) {
      throw new Error("Backup manifest format is unsupported.");
    }
    if (record.schemaVersion !== BACKUP_SCHEMA_VERSION) {
      throw new Error("Backup manifest schema version is unsupported.");
    }
    if (
      typeof record.createdAt !== "string" ||
      !ISO_INSTANT_PATTERN.test(record.createdAt) ||
      new Date(record.createdAt).toISOString() !== record.createdAt
    ) {
      throw new Error("Backup manifest createdAt must be a canonical UTC instant.");
    }
    if (
      typeof record.plaintextSha256 !== "string" ||
      !SHA256_BASE64URL_PATTERN.test(record.plaintextSha256)
    ) {
      throw new Error("Backup manifest checksum must be a canonical SHA-256 base64url value.");
    }
    if (
      !Number.isSafeInteger(record.keyVersion) ||
      (record.keyVersion as number) <= 0
    ) {
      throw new Error("Backup manifest key version must be a positive safe integer.");
    }

    const rowCountsRecord = requirePlainRecord(
      record.rowCounts,
      "Backup manifest row counts",
    );
    requireExactKeys(
      rowCountsRecord,
      BACKUP_TABLES,
      "Backup manifest row counts",
    );
    const rowCounts = Object.fromEntries(
      BACKUP_TABLES.map((table) => {
        const count = rowCountsRecord[table];
        if (!Number.isSafeInteger(count) || (count as number) < 0) {
          throw new Error(
            "Backup manifest row counts must be non-negative safe integers.",
          );
        }
        return [table, count as number];
      }),
    ) as Record<BackupTableName, number>;

    return Object.freeze({
      format: BACKUP_FORMAT_V1,
      createdAt: record.createdAt,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      rowCounts: Object.freeze(rowCounts),
      plaintextSha256: record.plaintextSha256,
      keyVersion: record.keyVersion as number,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Backup")) {
      throw error;
    }
    throw new Error("Backup manifest is invalid.");
  }
}

/** Requires an ordinary data object with enumerable value properties only. */
function requirePlainRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain object.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(value).some(
      (key) =>
        typeof key !== "string" ||
        !descriptors[key]?.enumerable ||
        !("value" in descriptors[key]!),
    )
  ) {
    throw new Error(`${label} must contain enumerable value properties only.`);
  }
  return Object.fromEntries(
    Object.entries(descriptors).map(([key, descriptor]) => [
      key,
      descriptor.value,
    ]),
  );
}

/** Enforces a closed property set independently of source key order. */
function requireExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actualKeys = Object.keys(record).sort();
  const expectedKeys = [...expected].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error(`${label} do not match the supported version.`);
  }
}

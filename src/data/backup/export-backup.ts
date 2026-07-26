/** Canonically captures, validates, bounds, and encrypts a complete raw snapshot. */
import {
  encryptBackupEnvelope,
  MAX_BACKUP_PLAINTEXT_BYTES,
  type BackupEncryptionKey,
  type EncryptedBackup,
} from "../../crypto/backup-envelope";
import { decodeBase64Url, encodeBase64Url } from "../../crypto/envelope";
import {
  BACKUP_SCHEMA_CONTRACT,
  BACKUP_TABLE_COLUMNS,
  validateBackupReferences,
  validateBackupRow,
  validateBackupTableIdentities,
} from "../../domain/backup/schema-contract";
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  createBackupManifest,
  type BackupRow,
  type BackupRowCounts,
  type BackupSnapshotV1,
  type BackupTableName,
  type BackupValue,
} from "../../domain/backup/manifest";

export { BACKUP_TABLE_COLUMNS } from "../../domain/backup/schema-contract";

/** Optional deterministic clock input used by jobs and tests. */
export interface ExportBackupOptions {
  readonly createdAt?: string;
}

/** Worker-safe traversal and serialization ceilings for one private backup. */
export const BACKUP_ARCHIVE_LIMITS = Object.freeze({
  maximumArchiveBytes: 4 * 1024 * 1024,
  maximumRecordBytes: 512 * 1024,
  maximumRecords: 10_000,
  maximumRowsPerTable: 10_000,
  maximumValueDepth: 24,
  maximumStringBytes: 256 * 1024,
  maximumByteValueBytes: 256 * 1024,
  maximumArrayItems: 10_000,
  maximumObjectProperties: 1_000,
});

type EncodedBackupValue =
  | readonly ["null"]
  | readonly ["boolean", boolean]
  | readonly ["number", number]
  | readonly ["string", string]
  | readonly ["bigint", string]
  | readonly ["date", string]
  | readonly ["bytes", string]
  | readonly ["array", readonly EncodedBackupValue[]]
  | readonly [
      "object",
      readonly (readonly [string, EncodedBackupValue])[],
    ];

interface BackupArchiveRecordV1 {
  readonly recordVersion: 1;
  readonly table: BackupTableName;
  readonly key: EncodedBackupValue;
  readonly row: EncodedBackupValue;
}

interface CapturedBackup {
  readonly archive: Uint8Array;
  readonly rowCounts: BackupRowCounts;
}

const textEncoder = new TextEncoder();
const fatalTextDecoder = new TextDecoder("utf-8", { fatal: true });
const PAYLOAD_KEYS = ["archive", "manifest"] as const;
const RECORD_KEYS = ["key", "recordVersion", "row", "table"] as const;
const MAX_ARCHIVE_BASE64URL_CHARS = base64UrlLength(
  BACKUP_ARCHIVE_LIMITS.maximumArchiveBytes,
);

/** Exports one owned consistent capture as an authenticated encrypted object. */
export async function exportBackup(
  snapshot: BackupSnapshotV1,
  backupKey: BackupEncryptionKey,
  options: ExportBackupOptions = {},
): Promise<EncryptedBackup> {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const captured = captureCanonicalBackup(snapshot);
  const plaintextSha256 = await sha256Base64Url(captured.archive);
  const manifest = createBackupManifest({
    createdAt,
    rowCounts: captured.rowCounts,
    plaintextSha256,
    keyVersion: backupKey.keyVersion,
  });
  const archiveLength = base64UrlLength(captured.archive.byteLength);
  const payloadWithoutArchive = textEncoder.encode(
    JSON.stringify({ manifest, archive: "" }),
  ).byteLength;
  if (
    archiveLength > MAX_ARCHIVE_BASE64URL_CHARS ||
    payloadWithoutArchive + archiveLength > MAX_BACKUP_PLAINTEXT_BYTES
  ) {
    throw new Error("Backup payload exceeds the supported size limit.");
  }
  const payload = textEncoder.encode(
    JSON.stringify({
      manifest,
      archive: encodeBase64Url(captured.archive),
    }),
  );
  if (payload.byteLength > MAX_BACKUP_PLAINTEXT_BYTES) {
    throw new Error("Backup payload exceeds the supported size limit.");
  }
  return encryptBackupEnvelope(payload, backupKey);
}

/** Encodes every row as bounded versioned NDJSON in fixed table/key order. */
export function encodeCanonicalBackupArchive(
  snapshot: BackupSnapshotV1,
): Uint8Array {
  return captureCanonicalBackup(snapshot).archive;
}

/** Parses canonical NDJSON while rejecting every alternate byte representation. */
export function decodeCanonicalBackupArchive(
  archive: Uint8Array,
): BackupSnapshotV1 {
  if (!(archive instanceof Uint8Array)) {
    throw new Error("Backup archive must be bytes.");
  }
  if (archive.byteLength > BACKUP_ARCHIVE_LIMITS.maximumArchiveBytes) {
    throw new Error("Backup archive exceeds the supported size limit.");
  }
  let text: string;
  try {
    text = fatalTextDecoder.decode(archive);
  } catch {
    throw new Error("Backup archive is not valid UTF-8.");
  }
  if (text !== "" && !text.endsWith("\n")) {
    throw new Error("Backup archive must end with a newline.");
  }

  const lines = text === "" ? [] : text.slice(0, -1).split("\n");
  if (lines.length > BACKUP_ARCHIVE_LIMITS.maximumRecords) {
    throw new Error("Backup archive exceeds the record-count limit.");
  }
  const tables = Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, [] as BackupRow[]]),
  ) as Record<BackupTableName, BackupRow[]>;
  let lastTableIndex = -1;
  let lastKey = "";

  for (const line of lines) {
    if (line.length === 0) {
      throw new Error("Backup archive contains an empty record.");
    }
    if (
      line.length > BACKUP_ARCHIVE_LIMITS.maximumRecordBytes ||
      textEncoder.encode(line).byteLength >
        BACKUP_ARCHIVE_LIMITS.maximumRecordBytes
    ) {
      throw new Error("Backup archive record exceeds the supported size limit.");
    }
    let candidate: unknown;
    try {
      candidate = JSON.parse(line);
    } catch {
      throw new Error("Backup archive contains invalid JSON.");
    }
    const record = parseArchiveRecord(candidate);
    const tableIndex = BACKUP_TABLES.indexOf(record.table);
    const decodedRow = decodeBackupValue(record.row, 0);
    if (!isPlainObject(decodedRow)) {
      throw new Error("Backup archive row must decode to an object.");
    }
    const row = decodedRow as BackupRow;
    validateBackupRow(record.table, row);
    const expectedKey = encodePrimaryKey(record.table, row);
    const canonicalKey = JSON.stringify(expectedKey);
    if (JSON.stringify(record.key) !== canonicalKey) {
      throw new Error("Backup archive record key does not match its row.");
    }
    const canonicalRecord: BackupArchiveRecordV1 = {
      recordVersion: 1,
      table: record.table,
      key: expectedKey,
      row: encodeBackupValue(row, 0),
    };
    if (JSON.stringify(canonicalRecord) !== line) {
      throw new Error("Backup archive record bytes are not canonical.");
    }
    if (
      tableIndex < lastTableIndex ||
      (tableIndex === lastTableIndex && canonicalKey <= lastKey)
    ) {
      throw new Error(
        "Backup archive record order or primary-key uniqueness is invalid.",
      );
    }
    lastTableIndex = tableIndex;
    lastKey = canonicalKey;
    tables[record.table].push(row);
  }

  for (const table of BACKUP_TABLES) {
    if (tables[table].length > BACKUP_ARCHIVE_LIMITS.maximumRowsPerTable) {
      throw new Error(`Backup ${table} row count exceeds the supported limit.`);
    }
    validateBackupTableIdentities(table, tables[table]);
  }
  validateBackupReferences(tables);
  return { schemaVersion: BACKUP_SCHEMA_VERSION, tables };
}

/** Parses the bounded decrypted manifest-plus-archive payload as a closed object. */
export function parseBackupPayload(plaintext: Uint8Array): {
  readonly manifest: unknown;
  readonly archive: Uint8Array;
} {
  if (
    !(plaintext instanceof Uint8Array) ||
    plaintext.byteLength > MAX_BACKUP_PLAINTEXT_BYTES
  ) {
    throw new Error("Backup payload exceeds the supported size limit.");
  }
  let candidate: unknown;
  try {
    candidate = JSON.parse(fatalTextDecoder.decode(plaintext));
  } catch {
    throw new Error("Backup payload is invalid.");
  }
  if (!isPlainObject(candidate)) {
    throw new Error("Backup payload must be an object.");
  }
  requireExactKeys(candidate, PAYLOAD_KEYS, "Backup payload");
  if (
    typeof candidate.archive !== "string" ||
    candidate.archive.length > MAX_ARCHIVE_BASE64URL_CHARS
  ) {
    throw new Error("Backup payload archive is invalid.");
  }
  return {
    manifest: candidate.manifest,
    archive:
      candidate.archive === ""
        ? new Uint8Array(0)
        : decodeBase64Url(
            candidate.archive,
            "Backup archive",
            MAX_ARCHIVE_BASE64URL_CHARS,
          ),
  };
}

/** Produces row totals after validating the complete table container. */
export function countSnapshotRows(
  snapshot: BackupSnapshotV1,
): BackupRowCounts {
  validateSnapshotShape(snapshot);
  return Object.freeze(
    Object.fromEntries(
      BACKUP_TABLES.map((table) => [table, snapshot.tables[table].length]),
    ) as Record<BackupTableName, number>,
  );
}

/** Hashes owned plaintext bytes using canonical unpadded base64url output. */
export async function sha256Base64Url(bytes: Uint8Array): Promise<string> {
  const ownedBytes = new Uint8Array(bytes.byteLength);
  ownedBytes.set(bytes);
  return encodeBase64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", ownedBytes)),
  );
}

/** Captures rows, counts, schema facts, references, and bounded canonical bytes synchronously. */
function captureCanonicalBackup(
  snapshot: BackupSnapshotV1,
): CapturedBackup {
  validateSnapshotShape(snapshot);
  const capturedTables = Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, [] as BackupRow[]]),
  ) as Record<BackupTableName, BackupRow[]>;
  const rowCounts = {} as Record<BackupTableName, number>;
  let totalRecords = 0;

  for (const table of BACKUP_TABLES) {
    const sourceRows = snapshot.tables[table];
    if (sourceRows.length > BACKUP_ARCHIVE_LIMITS.maximumRowsPerTable) {
      throw new Error(`Backup ${table} row count exceeds the supported limit.`);
    }
    totalRecords += sourceRows.length;
    if (totalRecords > BACKUP_ARCHIVE_LIMITS.maximumRecords) {
      throw new Error("Backup snapshot exceeds the record-count limit.");
    }
    const ownedRows = Array.from(sourceRows, (row) => snapshotPlainRow(row));
    for (const row of ownedRows) validateBackupRow(table, row);
    validateBackupTableIdentities(table, ownedRows);
    capturedTables[table] = ownedRows;
    rowCounts[table] = ownedRows.length;
  }
  validateBackupReferences(capturedTables);

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (const table of BACKUP_TABLES) {
    const records = capturedTables[table].map((row) =>
      createArchiveRecord(table, row),
    );
    records.sort((left, right) => compareCanonicalKeys(left.key, right.key));
    for (const record of records) {
      const chunk = textEncoder.encode(`${JSON.stringify(record)}\n`);
      if (chunk.byteLength - 1 > BACKUP_ARCHIVE_LIMITS.maximumRecordBytes) {
        throw new Error("Backup archive record exceeds the supported size limit.");
      }
      if (
        totalBytes + chunk.byteLength >
        BACKUP_ARCHIVE_LIMITS.maximumArchiveBytes
      ) {
        throw new Error("Backup archive exceeds the supported size limit.");
      }
      chunks.push(chunk);
      totalBytes += chunk.byteLength;
    }
  }

  const archive = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    archive.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return {
    archive,
    rowCounts: Object.freeze(rowCounts),
  };
}

/** Creates one canonical record without decrypting any byte-array field. */
function createArchiveRecord(
  table: BackupTableName,
  row: BackupRow,
): BackupArchiveRecordV1 {
  return {
    recordVersion: 1,
    table,
    key: encodePrimaryKey(table, row),
    row: encodeBackupValue(row, 0),
  };
}

/** Extracts a complete scalar primary key from the authoritative schema contract. */
function encodePrimaryKey(
  table: BackupTableName,
  row: BackupRow,
): EncodedBackupValue {
  const values = BACKUP_SCHEMA_CONTRACT[table].primaryKey.map((column) => {
    const value = row[column];
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "bigint"
    ) {
      throw new Error(`Backup ${table} primary key column ${column} is invalid.`);
    }
    return encodeBackupValue(value, 1);
  });
  return ["array", values];
}

/** Encodes one value into an unambiguous bounded tagged representation. */
function encodeBackupValue(
  value: BackupValue,
  depth: number,
): EncodedBackupValue {
  if (depth > BACKUP_ARCHIVE_LIMITS.maximumValueDepth) {
    throw new Error("Backup value nesting depth exceeds the supported limit.");
  }
  if (value === null) return ["null"];
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "string") {
    requireBoundedString(value);
    return ["string", value];
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new Error("Backup numeric values must be finite and canonical.");
    }
    return ["number", value];
  }
  if (typeof value === "bigint") {
    const encoded = value.toString();
    requireBoundedString(encoded);
    return ["bigint", encoded];
  }
  if (value instanceof Date) {
    const instant = Date.prototype.toISOString.call(value);
    return ["date", instant];
  }
  if (value instanceof Uint8Array) {
    if (
      value.byteLength > BACKUP_ARCHIVE_LIMITS.maximumByteValueBytes
    ) {
      throw new Error("Backup byte value exceeds the supported size limit.");
    }
    return ["bytes", encodeBase64Url(value)];
  }
  if (Array.isArray(value)) {
    if (value.length > BACKUP_ARCHIVE_LIMITS.maximumArrayItems) {
      throw new Error("Backup array exceeds the supported item limit.");
    }
    return [
      "array",
      value.map((entry) => encodeBackupValue(entry, depth + 1)),
    ];
  }
  const record = snapshotPlainRow(value as BackupRow);
  const keys = Object.keys(record);
  if (keys.length > BACKUP_ARCHIVE_LIMITS.maximumObjectProperties) {
    throw new Error("Backup object exceeds the supported property limit.");
  }
  return [
    "object",
    keys.sort(compareStrings).map((key) => {
      requireBoundedString(key);
      return [key, encodeBackupValue(record[key]!, depth + 1)] as const;
    }),
  ];
}

/** Decodes one bounded tagged value without ambiguous object sentinels. */
function decodeBackupValue(
  value: unknown,
  depth: number,
): BackupValue {
  if (depth > BACKUP_ARCHIVE_LIMITS.maximumValueDepth) {
    throw new Error("Backup value nesting depth exceeds the supported limit.");
  }
  if (!Array.isArray(value) || typeof value[0] !== "string") {
    throw new Error("Backup archive contains an invalid encoded value.");
  }
  const tag = value[0];
  if (tag === "null" && value.length === 1) return null;
  if (tag === "boolean" && value.length === 2 && typeof value[1] === "boolean") {
    return value[1];
  }
  if (
    tag === "number" &&
    value.length === 2 &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1]) &&
    !Object.is(value[1], -0)
  ) {
    return value[1];
  }
  if (tag === "string" && value.length === 2 && typeof value[1] === "string") {
    requireBoundedString(value[1]);
    return value[1];
  }
  if (
    tag === "bigint" &&
    value.length === 2 &&
    typeof value[1] === "string" &&
    /^-?(0|[1-9]\d*)$/.test(value[1])
  ) {
    requireBoundedString(value[1]);
    return BigInt(value[1]);
  }
  if (
    tag === "date" &&
    value.length === 2 &&
    typeof value[1] === "string" &&
    new Date(value[1]).toISOString() === value[1]
  ) {
    return new Date(value[1]);
  }
  if (tag === "bytes" && value.length === 2 && typeof value[1] === "string") {
    if (
      value[1].length >
      base64UrlLength(BACKUP_ARCHIVE_LIMITS.maximumByteValueBytes)
    ) {
      throw new Error("Backup byte value exceeds the supported size limit.");
    }
    const bytes = decodeBase64Url(
      value[1],
      "Backup byte value",
      base64UrlLength(BACKUP_ARCHIVE_LIMITS.maximumByteValueBytes),
    );
    if (bytes.byteLength > BACKUP_ARCHIVE_LIMITS.maximumByteValueBytes) {
      throw new Error("Backup byte value exceeds the supported size limit.");
    }
    return bytes;
  }
  if (tag === "array" && value.length === 2 && Array.isArray(value[1])) {
    if (value[1].length > BACKUP_ARCHIVE_LIMITS.maximumArrayItems) {
      throw new Error("Backup array exceeds the supported item limit.");
    }
    return value[1].map((entry) => decodeBackupValue(entry, depth + 1));
  }
  if (tag === "object" && value.length === 2 && Array.isArray(value[1])) {
    if (value[1].length > BACKUP_ARCHIVE_LIMITS.maximumObjectProperties) {
      throw new Error("Backup object exceeds the supported property limit.");
    }
    const result: Record<string, BackupValue> = Object.create(null);
    let previousKey: string | undefined;
    for (const entry of value[1]) {
      if (
        !Array.isArray(entry) ||
        entry.length !== 2 ||
        typeof entry[0] !== "string" ||
        (previousKey !== undefined && compareStrings(previousKey, entry[0]) >= 0)
      ) {
        throw new Error("Backup object keys are invalid or noncanonical.");
      }
      requireBoundedString(entry[0]);
      previousKey = entry[0];
      result[entry[0]] = decodeBackupValue(entry[1], depth + 1);
    }
    return result;
  }
  throw new Error("Backup archive contains an unsupported encoded value.");
}

/** Parses one closed record and validates its table and record version. */
function parseArchiveRecord(value: unknown): BackupArchiveRecordV1 {
  if (!isPlainObject(value)) {
    throw new Error("Backup archive record must be an object.");
  }
  requireExactKeys(value, RECORD_KEYS, "Backup archive record");
  if (value.recordVersion !== 1) {
    throw new Error("Backup archive record version is unsupported.");
  }
  if (
    typeof value.table !== "string" ||
    !BACKUP_TABLES.includes(value.table as BackupTableName)
  ) {
    throw new Error("Backup archive table is unsupported.");
  }
  return {
    recordVersion: 1,
    table: value.table as BackupTableName,
    key: value.key as EncodedBackupValue,
    row: value.row as EncodedBackupValue,
  };
}

/** Validates the complete table set and cheap collection limits first. */
function validateSnapshotShape(snapshot: BackupSnapshotV1): void {
  if (!isPlainObject(snapshot)) {
    throw new Error("Backup snapshot must be an object.");
  }
  requireExactKeys(snapshot, ["schemaVersion", "tables"], "Backup snapshot");
  if (snapshot.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error("Backup snapshot schema version is unsupported.");
  }
  if (!isPlainObject(snapshot.tables)) {
    throw new Error("Backup snapshot tables must be an object.");
  }
  requireExactKeys(snapshot.tables, BACKUP_TABLES, "Backup snapshot tables");
  let totalRows = 0;
  for (const table of BACKUP_TABLES) {
    const rows = snapshot.tables[table];
    if (!Array.isArray(rows)) {
      throw new Error(`Backup snapshot table ${table} must be an array.`);
    }
    if (rows.length > BACKUP_ARCHIVE_LIMITS.maximumRowsPerTable) {
      throw new Error(`Backup ${table} row count exceeds the supported limit.`);
    }
    totalRows += rows.length;
    if (totalRows > BACKUP_ARCHIVE_LIMITS.maximumRecords) {
      throw new Error("Backup snapshot exceeds the record-count limit.");
    }
  }
}

/** Snapshots enumerable value properties without invoking accessors. */
function snapshotPlainRow(value: BackupRow): BackupRow {
  if (!isPlainObject(value)) {
    throw new Error("Backup rows and JSON objects must be plain objects.");
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
    throw new Error("Backup rows must contain enumerable value properties only.");
  }
  if (
    Object.keys(descriptors).length >
    BACKUP_ARCHIVE_LIMITS.maximumObjectProperties
  ) {
    throw new Error("Backup object exceeds the supported property limit.");
  }
  return Object.fromEntries(
    Object.entries(descriptors).map(([key, descriptor]) => [
      key,
      descriptor.value as BackupValue,
    ]),
  );
}

/** Reports whether a value is an ordinary record. */
function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Requires exactly the supported own string keys. */
function requireExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const keys = Reflect.ownKeys(record);
  if (keys.some((key) => typeof key !== "string")) {
    throw new Error(`${label} contains unsupported fields.`);
  }
  const actual = keys.map(String).sort(compareStrings);
  const sortedExpected = [...expected].sort(compareStrings);
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new Error(`${label} fields do not match the supported version.`);
  }
}

/** Rejects large strings before UTF-8 expansion, then verifies the exact byte bound. */
function requireBoundedString(value: string): void {
  if (
    value.length > BACKUP_ARCHIVE_LIMITS.maximumStringBytes ||
    textEncoder.encode(value).byteLength >
      BACKUP_ARCHIVE_LIMITS.maximumStringBytes
  ) {
    throw new Error("Backup string exceeds the supported size limit.");
  }
}

/** Returns the unpadded base64url character count for a byte length. */
function base64UrlLength(byteLength: number): number {
  const padded = Math.ceil(byteLength / 3) * 4;
  const remainder = byteLength % 3;
  return padded - (remainder === 0 ? 0 : 3 - remainder);
}

/** Orders encoded primary keys by their canonical JSON representation. */
function compareCanonicalKeys(
  left: EncodedBackupValue,
  right: EncodedBackupValue,
): number {
  return compareStrings(JSON.stringify(left), JSON.stringify(right));
}

/** Performs locale-independent UTF-16 lexical ordering. */
function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

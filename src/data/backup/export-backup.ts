/** Canonically encodes a complete raw snapshot and encrypts it without opening app ciphertext. */
import {
  encryptBackupEnvelope,
  MAX_BACKUP_COMPONENT_BASE64URL_CHARS,
  MAX_BACKUP_PLAINTEXT_BYTES,
  type BackupEncryptionKey,
  type EncryptedBackup,
} from "../../crypto/backup-envelope";
import { decodeBase64Url, encodeBase64Url } from "../../crypto/envelope";
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  createBackupManifest,
  type BackupManifestV1,
  type BackupRow,
  type BackupRowCounts,
  type BackupSnapshotV1,
  type BackupTableName,
  type BackupValue,
} from "../../domain/backup/manifest";

/** Optional deterministic clock input used by jobs and tests. */
export interface ExportBackupOptions {
  readonly createdAt?: string;
}

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

const PRIMARY_KEYS: Readonly<
  Record<BackupTableName, readonly string[]>
> = {
  data_key_state: ["id"],
  wrapped_data_keys: ["owner_id", "domain", "key_version"],
  oauth_admission_windows: ["admission_key_hash"],
  oauth_transactions: ["state_hash"],
  auth_sessions: ["session_id_hash"],
  google_oauth_tokens: ["owner_id"],
  calendar_setup_states: ["owner_id"],
  calendar_setup_candidates: ["owner_id", "provider_calendar_id"],
  vision_calendar_connections: ["owner_id"],
  nodes: ["id"],
  events: ["node_id"],
  event_sync_payloads: ["node_id"],
  node_annotations: ["id"],
  node_category_assignments: ["node_id"],
  edges: ["id"],
  audit_events: ["id"],
  operation_ledger: ["operation_id"],
  calendar_create_snapshots: ["operation_id", "provider_calendar_id"],
  recoverable_deletions: ["node_id"],
  sync_checkpoints: ["id"],
  sync_channels: ["id"],
  calendar_sync_maintenance: [
    "owner_id",
    "provider",
    "provider_calendar_id",
  ],
  calendar_sync_jobs: ["job_id"],
  sync_runs: ["job_id"],
  projection_rebuild_generations: ["id"],
  projection_rebuild_changes: ["generation_id", "identity_hash"],
  ai_usage_months: ["owner_id", "budget_month"],
  ai_usage_reservations: ["id"],
  ai_usage_ledger: ["id"],
};

/** Exact migration-9 columns required for each version-1 backup row. */
export const BACKUP_TABLE_COLUMNS: Readonly<
  Record<BackupTableName, readonly string[]>
> = {
  data_key_state: ["id", "active_key_version"],
  wrapped_data_keys: [
    "owner_id",
    "domain",
    "key_version",
    "iv",
    "wrapped_key",
  ],
  oauth_admission_windows: [
    "admission_key_hash",
    "window_started_at",
    "request_count",
  ],
  oauth_transactions: [
    "state_hash",
    "admission_key_hash",
    "admission_slot",
    "verifier_envelope",
    "nonce_envelope",
    "created_at",
    "expires_at",
    "consumed_at",
  ],
  auth_sessions: [
    "session_id_hash",
    "owner_id",
    "google_subject",
    "email_envelope",
    "csrf_token_envelope",
    "created_at",
    "expires_at",
    "revoked_at",
  ],
  google_oauth_tokens: [
    "owner_id",
    "google_subject",
    "refresh_token_envelope",
    "refresh_token_digest",
    "access_token_envelope",
    "access_expires_at",
    "granted_scopes",
    "token_version",
    "updated_at",
  ],
  calendar_setup_states: [
    "owner_id",
    "google_subject",
    "setup_version",
    "status",
    "action_required",
    "updated_at",
  ],
  calendar_setup_candidates: [
    "owner_id",
    "provider_calendar_id",
    "google_subject",
    "summary",
    "ownership_access_role",
    "time_zone",
    "provider_etag",
    "verified_at",
  ],
  vision_calendar_connections: [
    "owner_id",
    "google_subject",
    "provider_calendar_id",
    "summary",
    "ownership_access_role",
    "time_zone",
    "provider_etag",
    "verified_at",
    "connection_kind",
  ],
  nodes: [
    "id",
    "owner_id",
    "identity_kind",
    "provider",
    "provider_node_id",
    "node_type",
    "domain",
    "domain_state",
    "privacy",
    "provenance",
    "lifecycle",
    "created_at",
    "updated_at",
    "valid_from",
    "valid_to",
    "version",
    "model_confidence",
  ],
  events: [
    "node_id",
    "owner_id",
    "node_type",
    "provider",
    "provider_calendar_id",
    "provider_event_id",
    "provider_version",
    "starts_at",
    "ends_at",
    "time_zone",
    "busy",
    "status",
    "recurrence_id",
    "title_envelope",
    "description_envelope",
    "attendees_envelope",
    "location_envelope",
    "meeting_link_envelope",
    "protected_key_version",
  ],
  event_sync_payloads: [
    "node_id",
    "owner_id",
    "protected_payload_envelope",
    "protected_key_version",
  ],
  node_annotations: [
    "id",
    "owner_id",
    "node_id",
    "provenance",
    "annotation_envelope",
    "key_version",
    "created_at",
    "updated_at",
  ],
  node_category_assignments: [
    "node_id",
    "owner_id",
    "domain",
    "domain_state",
    "provenance",
    "assigned_at",
    "version",
  ],
  edges: [
    "id",
    "owner_id",
    "source_node_id",
    "source_node_type",
    "destination_node_id",
    "destination_node_type",
    "relation",
    "origin",
    "evidence",
    "confidence",
    "lifecycle",
    "privacy",
    "valid_from",
    "valid_to",
    "version",
  ],
  audit_events: [
    "id",
    "owner_id",
    "node_id",
    "actor_type",
    "action",
    "outcome",
    "provider",
    "error_category",
    "occurred_at",
  ],
  operation_ledger: [
    "operation_id",
    "owner_id",
    "provider",
    "provider_operation_id",
    "operation_kind",
    "status",
    "requested_at",
    "completed_at",
    "response_envelope",
    "setup_version",
    "result_calendar_id",
  ],
  calendar_create_snapshots: [
    "operation_id",
    "owner_id",
    "provider_calendar_id",
  ],
  recoverable_deletions: [
    "node_id",
    "owner_id",
    "deleted_at",
    "purge_after",
    "recovery_envelope",
  ],
  sync_checkpoints: [
    "id",
    "owner_id",
    "provider",
    "provider_calendar_id",
    "sync_token_envelope",
    "key_version",
    "committed_at",
    "version",
    "status",
    "last_error_category",
    "updated_at",
  ],
  sync_channels: [
    "id",
    "owner_id",
    "provider",
    "provider_calendar_id",
    "provider_channel_id",
    "provider_resource_id",
    "verification_token_envelope",
    "expires_at",
    "verification_token_hash",
    "lifecycle",
    "created_at",
    "activated_at",
    "retired_at",
    "failure_count",
    "last_failure_at",
    "renewal_generation",
    "renewal_lease_id",
    "cleanup_required",
  ],
  calendar_sync_maintenance: [
    "owner_id",
    "provider",
    "provider_calendar_id",
    "connection_version",
    "checkpoint_version",
    "renewal_generation",
    "renewal_lease_id",
    "renewal_lease_expires_at",
    "renewal_failures",
    "current_channel_row_id",
    "credential_failure_checkpoint_version",
    "credential_failure_category",
    "credential_failure_recorded_at",
    "created_at",
    "updated_at",
  ],
  calendar_sync_jobs: [
    "job_id",
    "owner_id",
    "provider",
    "provider_calendar_id",
    "reason",
    "status",
    "attempts",
    "claim_id",
    "claimed_at",
    "completed_at",
    "last_error_category",
    "action_required",
    "checkpoint_version",
    "page_count",
    "staged_count",
    "upserted_count",
    "deleted_count",
    "unchanged_count",
    "created_at",
    "updated_at",
  ],
  sync_runs: [
    "job_id",
    "owner_id",
    "provider",
    "provider_calendar_id",
    "reason",
    "page_count",
    "staged_count",
    "upserted_count",
    "deleted_count",
    "unchanged_count",
    "started_at",
    "completed_at",
    "checkpoint_version",
  ],
  projection_rebuild_generations: [
    "id",
    "owner_id",
    "provider",
    "provider_calendar_id",
    "job_id",
    "queue_claim_id",
    "base_checkpoint_version",
    "status",
    "page_count",
    "created_at",
    "updated_at",
    "activated_at",
  ],
  projection_rebuild_changes: [
    "generation_id",
    "identity_hash",
    "ordinal",
    "planning_json",
    "protected_payload_envelope",
    "protected_key_version",
  ],
  ai_usage_months: [
    "owner_id",
    "budget_month",
    "settled_cents",
    "reserved_cents",
    "created_at",
    "updated_at",
  ],
  ai_usage_reservations: [
    "id",
    "owner_id",
    "budget_month",
    "idempotency_key",
    "request_class",
    "status",
    "estimated_cents",
    "actual_cents",
    "provider_request_id",
    "model_id",
    "input_tokens",
    "output_tokens",
    "total_tokens",
    "created_at",
    "expires_at",
    "dispatched_at",
    "completed_at",
  ],
  ai_usage_ledger: [
    "id",
    "reservation_id",
    "owner_id",
    "budget_month",
    "event_type",
    "estimated_cents",
    "actual_cents",
    "provider_request_id",
    "model_id",
    "input_tokens",
    "output_tokens",
    "total_tokens",
    "occurred_at",
  ],
};

const textEncoder = new TextEncoder();
const fatalTextDecoder = new TextDecoder("utf-8", { fatal: true });
const PAYLOAD_KEYS = ["archive", "manifest"] as const;
const RECORD_KEYS = ["key", "recordVersion", "row", "table"] as const;

/** Exports a consistent raw snapshot as one authenticated encrypted object. */
export async function exportBackup(
  snapshot: BackupSnapshotV1,
  backupKey: BackupEncryptionKey,
  options: ExportBackupOptions = {},
): Promise<EncryptedBackup> {
  validateSnapshotShape(snapshot);
  const archive = encodeCanonicalBackupArchive(snapshot);
  const plaintextSha256 = await sha256Base64Url(archive);
  const manifest = createBackupManifest({
    createdAt: options.createdAt ?? new Date().toISOString(),
    rowCounts: countSnapshotRows(snapshot),
    plaintextSha256,
    keyVersion: backupKey.keyVersion,
  });
  const payload = textEncoder.encode(
    JSON.stringify({
      manifest,
      archive: encodeBase64Url(archive),
    }),
  );
  return encryptBackupEnvelope(payload, backupKey);
}

/** Encodes every row as versioned NDJSON in fixed table and primary-key order. */
export function encodeCanonicalBackupArchive(
  snapshot: BackupSnapshotV1,
): Uint8Array {
  validateSnapshotShape(snapshot);
  const lines: string[] = [];

  for (const table of BACKUP_TABLES) {
    const records = snapshot.tables[table].map((row) =>
      createArchiveRecord(table, row),
    );
    records.sort((left, right) =>
      compareCanonicalKeys(left.key, right.key),
    );
    for (let index = 1; index < records.length; index += 1) {
      if (
        compareCanonicalKeys(records[index - 1]!.key, records[index]!.key) === 0
      ) {
        throw new Error(`Backup snapshot contains a duplicate ${table} primary key.`);
      }
    }
    lines.push(...records.map((record) => JSON.stringify(record)));
  }

  return textEncoder.encode(lines.length === 0 ? "" : `${lines.join("\n")}\n`);
}

/** Parses canonical NDJSON back into raw typed rows while rejecting noncanonical input. */
export function decodeCanonicalBackupArchive(
  archive: Uint8Array,
): BackupSnapshotV1 {
  if (!(archive instanceof Uint8Array)) {
    throw new Error("Backup archive must be bytes.");
  }
  if (archive.byteLength > MAX_BACKUP_PLAINTEXT_BYTES) {
    throw new Error("Backup archive exceeds the supported size.");
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

  const tables = Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, [] as BackupRow[]]),
  ) as Record<BackupTableName, BackupRow[]>;
  let lastTableIndex = -1;
  let lastKey = "";

  for (const line of text === "" ? [] : text.slice(0, -1).split("\n")) {
    if (line.length === 0) {
      throw new Error("Backup archive contains an empty record.");
    }
    let candidate: unknown;
    try {
      candidate = JSON.parse(line);
    } catch {
      throw new Error("Backup archive contains invalid JSON.");
    }
    const record = parseArchiveRecord(candidate);
    const tableIndex = BACKUP_TABLES.indexOf(record.table);
    const canonicalKey = JSON.stringify(record.key);
    if (
      tableIndex < lastTableIndex ||
      (tableIndex === lastTableIndex && canonicalKey <= lastKey)
    ) {
      throw new Error("Backup archive record order or primary-key uniqueness is invalid.");
    }
    lastTableIndex = tableIndex;
    lastKey = canonicalKey;

    const decodedRow = decodeBackupValue(record.row);
    if (!isPlainObject(decodedRow)) {
      throw new Error("Backup archive row must decode to an object.");
    }
    const row = decodedRow as BackupRow;
    validateRowColumns(record.table, row);
    const expectedKey = encodePrimaryKey(record.table, row);
    if (JSON.stringify(expectedKey) !== canonicalKey) {
      throw new Error("Backup archive record key does not match its row.");
    }
    tables[record.table].push(row);
  }

  return { schemaVersion: BACKUP_SCHEMA_VERSION, tables };
}

/** Parses the decrypted manifest-plus-archive payload as a closed object. */
export function parseBackupPayload(plaintext: Uint8Array): {
  readonly manifest: unknown;
  readonly archive: Uint8Array;
} {
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
  if (typeof candidate.archive !== "string") {
    throw new Error("Backup payload archive is invalid.");
  }
  return {
    manifest: candidate.manifest,
    archive: decodeBase64Url(
      candidate.archive,
      "Backup archive",
      MAX_BACKUP_COMPONENT_BASE64URL_CHARS,
    ),
  };
}

/** Produces canonical row totals for the manifest and restore report. */
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

/** Hashes plaintext bytes using canonical unpadded base64url output. */
export async function sha256Base64Url(bytes: Uint8Array): Promise<string> {
  const ownedBytes = new Uint8Array(bytes.byteLength);
  ownedBytes.set(bytes);
  return encodeBase64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", ownedBytes)),
  );
}

/** Creates one canonical record without decrypting any byte-array field. */
function createArchiveRecord(
  table: BackupTableName,
  row: BackupRow,
): BackupArchiveRecordV1 {
  const clonedRow = snapshotPlainRow(row);
  validateRowColumns(table, clonedRow);
  return {
    recordVersion: 1,
    table,
    key: encodePrimaryKey(table, clonedRow),
    row: encodeBackupValue(clonedRow),
  };
}

/** Extracts a complete scalar primary key from a raw row. */
function encodePrimaryKey(
  table: BackupTableName,
  row: BackupRow,
): EncodedBackupValue {
  const values = PRIMARY_KEYS[table].map((column) => {
    if (!Object.hasOwn(row, column)) {
      throw new Error(`Backup ${table} row is missing primary key column ${column}.`);
    }
    const value = row[column];
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "bigint"
    ) {
      throw new Error(`Backup ${table} primary key column ${column} is invalid.`);
    }
    return encodeBackupValue(value);
  });
  return ["array", values];
}

/** Encodes one value into an unambiguous deterministic tagged representation. */
function encodeBackupValue(value: BackupValue): EncodedBackupValue {
  if (value === null) return ["null"];
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "string") return ["string", value];
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Backup numeric values must be finite.");
    }
    return ["number", value];
  }
  if (typeof value === "bigint") return ["bigint", value.toString()];
  if (value instanceof Date) {
    const instant = Date.prototype.toISOString.call(value);
    return ["date", instant];
  }
  if (value instanceof Uint8Array) {
    return ["bytes", encodeBase64Url(value)];
  }
  if (Array.isArray(value)) {
    return ["array", value.map((entry) => encodeBackupValue(entry))];
  }
  const record = snapshotPlainRow(value as BackupRow);
  return [
    "object",
    Object.keys(record)
      .sort(compareStrings)
      .map((key) => [key, encodeBackupValue(record[key]!)] as const),
  ];
}

/** Decodes one strict tagged value without permitting ambiguous user-object sentinels. */
function decodeBackupValue(value: unknown): BackupValue {
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
    Number.isFinite(value[1])
  ) {
    return value[1];
  }
  if (tag === "string" && value.length === 2 && typeof value[1] === "string") {
    return value[1];
  }
  if (
    tag === "bigint" &&
    value.length === 2 &&
    typeof value[1] === "string" &&
    /^-?(0|[1-9]\d*)$/.test(value[1])
  ) {
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
    return decodeBase64Url(value[1], "Backup byte value");
  }
  if (tag === "array" && value.length === 2 && Array.isArray(value[1])) {
    return value[1].map((entry) => decodeBackupValue(entry));
  }
  if (tag === "object" && value.length === 2 && Array.isArray(value[1])) {
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
      previousKey = entry[0];
      result[entry[0]] = decodeBackupValue(entry[1]);
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

/** Validates the complete table set before reading any row data. */
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
  for (const table of BACKUP_TABLES) {
    if (!Array.isArray(snapshot.tables[table])) {
      throw new Error(`Backup snapshot table ${table} must be an array.`);
    }
  }
}

/** Snapshots enumerable data properties to prevent accessors changing during export. */
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
  return Object.fromEntries(
    Object.entries(descriptors).map(([key, descriptor]) => [
      key,
      descriptor.value as BackupValue,
    ]),
  );
}

/** Requires every row to match the exact current migration column set before staging. */
function validateRowColumns(
  table: BackupTableName,
  row: BackupRow,
): void {
  requireExactKeys(
    row,
    BACKUP_TABLE_COLUMNS[table],
    `Backup ${table} row`,
  );
}

/** Reports whether a value is an ordinary record without invoking property getters. */
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

/** Compares two canonical primary keys by their stable JSON bytes. */
function compareCanonicalKeys(
  left: EncodedBackupValue,
  right: EncodedBackupValue,
): number {
  return compareStrings(JSON.stringify(left), JSON.stringify(right));
}

/** Provides locale-independent UTF-16 lexical ordering. */
function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

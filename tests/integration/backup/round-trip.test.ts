import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import {
  createBackupEncryptionKey,
  decryptBackupEnvelope,
  encryptBackupEnvelope,
  MAX_BACKUP_PLAINTEXT_BYTES,
  serializeEncryptedBackup,
  type EncryptedBackup,
} from "../../../src/crypto/backup-envelope";
import {
  decodeBase64Url,
  encodeBase64Url,
  encryptText,
  serializeCipherEnvelope,
} from "../../../src/crypto/envelope";
import {
  BACKUP_FORMAT_V1,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  type BackupRow,
  type BackupSnapshotV1,
  type BackupTableName,
  type BackupValue,
} from "../../../src/domain/backup/manifest";
import {
  BACKUP_ARCHIVE_LIMITS,
  decodeCanonicalBackupArchive,
  encodeCanonicalBackupArchive,
  BACKUP_TABLE_COLUMNS,
  exportBackup,
  sha256Base64Url,
} from "../../../src/data/backup/export-backup";
import {
  BackupRestorePromotionError,
  importBackup,
  type BackupRestoreStage,
  type BackupRestoreTarget,
  type BackupRestoreTransaction,
  type RestoreTargetDescription,
} from "../../../src/data/backup/import-backup";

const SENTINEL = "VISION_BACKUP_SENTINEL_31C2";
const CREATED_AT = "2026-07-25T18:00:00.000Z";

type MutableBackupSnapshot = {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  tables: Record<BackupTableName, BackupRow[]>;
};

function emptyTables(): Record<BackupTableName, BackupRow[]> {
  return Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, []]),
  ) as unknown as Record<BackupTableName, BackupRow[]>;
}

function auditSnapshot(actions: readonly string[]): MutableBackupSnapshot {
  const tables = emptyTables();
  actions.forEach((action, index) => {
    tables.audit_events.push({
      id: `audit-${index.toString().padStart(8, "0")}`,
      owner_id: "owner-1",
      node_id: null,
      actor_type: "system",
      action,
      outcome: "success",
      provider: null,
      error_category: null,
      occurred_at: new Date("2026-07-25T18:00:00.000Z"),
    });
  });
  return { schemaVersion: BACKUP_SCHEMA_VERSION, tables };
}

function projectionSnapshot(planningJson: BackupValue): MutableBackupSnapshot {
  const tables = emptyTables();
  tables.projection_rebuild_generations.push({
    id: "generation-1",
    owner_id: "owner-1",
    provider: "google-calendar",
    provider_calendar_id: "calendar-1",
    job_id: "job-1",
    queue_claim_id: "claim-1",
    base_checkpoint_version: 1,
    status: "staging",
    page_count: null,
    created_at: new Date("2026-07-25T16:00:00.000Z"),
    updated_at: new Date("2026-07-25T16:00:00.000Z"),
    activated_at: null,
  });
  tables.projection_rebuild_changes.push({
    generation_id: "generation-1",
    identity_hash: "A".repeat(43),
    ordinal: 0,
    planning_json: planningJson,
    protected_payload_envelope: null,
    protected_key_version: null,
  });
  return { schemaVersion: BACKUP_SCHEMA_VERSION, tables };
}

function usageMonthSnapshot(reservedCents: BackupValue = 0): MutableBackupSnapshot {
  const tables = emptyTables();
  tables.ai_usage_months.push({
    owner_id: "owner-1",
    budget_month: "2026-07",
    settled_cents: 0,
    reserved_cents: reservedCents,
    created_at: new Date("2026-07-25T16:00:00.000Z"),
    updated_at: new Date("2026-07-25T16:00:00.000Z"),
  });
  return { schemaVersion: BACKUP_SCHEMA_VERSION, tables };
}

function calendarCandidateSnapshot(
  googleSubject: string,
  providerEtag: string,
): MutableBackupSnapshot {
  const tables = emptyTables();
  tables.calendar_setup_states.push({
    owner_id: "owner-1",
    google_subject: "subject-1",
    setup_version: 1,
    status: "awaiting_choice",
    action_required: false,
    updated_at: new Date("2026-07-25T16:00:00.000Z"),
  });
  tables.calendar_setup_candidates.push({
    owner_id: "owner-1",
    provider_calendar_id: "calendar-1",
    google_subject: googleSubject,
    summary: "Vision",
    ownership_access_role: "owner",
    time_zone: "America/Chicago",
    provider_etag: providerEtag,
    verified_at: new Date("2026-07-25T16:00:00.000Z"),
  });
  return { schemaVersion: BACKUP_SCHEMA_VERSION, tables };
}

async function representativeSnapshot(): Promise<MutableBackupSnapshot> {
  const tables = emptyTables();
  const applicationKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const encryptedBytes = new TextEncoder().encode(
    serializeCipherEnvelope(
      await encryptText(applicationKey, SENTINEL, {
        ownerId: "owner-1",
        nodeId: "event-node",
        domain: "work",
        fieldName: "title",
        keyVersion: 7,
      }),
    ),
  );
  const createdAt = new Date("2026-07-25T16:00:00.000Z");
  const updatedAt = new Date("2026-07-25T17:00:00.000Z");

  tables.nodes.push(
    {
      id: "calendar-node",
      owner_id: "owner-1",
      identity_kind: "provider",
      node_type: "calendar",
      provider: "google-calendar",
      provider_node_id: "calendar-1",
      domain: "unresolved",
      domain_state: "unresolved",
      privacy: "private",
      provenance: "provider",
      lifecycle: "active",
      created_at: createdAt,
      updated_at: updatedAt,
      valid_from: createdAt,
      valid_to: null,
      version: 1,
      model_confidence: null,
    },
    {
      id: "event-node",
      owner_id: "owner-1",
      identity_kind: "provider",
      node_type: "event",
      provider: "google-calendar",
      provider_node_id: "calendar-1:event-1",
      domain: "work",
      domain_state: "confirmed",
      privacy: "private",
      provenance: "provider",
      lifecycle: "deleted",
      created_at: createdAt,
      updated_at: updatedAt,
      valid_from: createdAt,
      valid_to: null,
      version: 2,
      model_confidence: null,
    },
  );
  tables.events.push({
    node_id: "event-node",
    owner_id: "owner-1",
    node_type: "event",
    provider: "google-calendar",
    provider_calendar_id: "calendar-1",
    provider_event_id: "event-1",
    provider_version: "00000000000000000001",
    starts_at: new Date("2026-07-25T18:00:00.000Z"),
    ends_at: new Date("2026-07-25T19:00:00.000Z"),
    time_zone: "America/Chicago",
    busy: true,
    status: "cancelled",
    recurrence_id: null,
    title_envelope: encryptedBytes,
    description_envelope: null,
    attendees_envelope: null,
    location_envelope: null,
    meeting_link_envelope: null,
    protected_key_version: 7,
  });
  tables.edges.push({
    id: "edge-1",
    owner_id: "owner-1",
    source_node_id: "event-node",
    source_node_type: "event",
    destination_node_id: "calendar-node",
    destination_node_type: "calendar",
    relation: "event_in_calendar",
    origin: "provider",
    evidence: null,
    confidence: null,
    lifecycle: "confirmed",
    privacy: "private",
    valid_from: createdAt,
    valid_to: null,
    version: 1,
  });
  tables.node_category_assignments.push({
    node_id: "event-node",
    owner_id: "owner-1",
    domain: "work",
    domain_state: "confirmed",
    provenance: "user",
    assigned_at: updatedAt,
    version: 1,
  });
  tables.sync_checkpoints.push({
    id: "checkpoint-1",
    owner_id: "owner-1",
    provider: "google-calendar",
    provider_calendar_id: "calendar-1",
    sync_token_envelope: encryptedBytes,
    key_version: 7,
    committed_at: updatedAt,
    version: 1,
    status: "connected",
    last_error_category: null,
    updated_at: updatedAt,
  });
  tables.audit_events.push({
    id: "audit-1",
    owner_id: "owner-1",
    node_id: "event-node",
    actor_type: "user",
    action: "event.category.confirmed",
    outcome: "success",
    provider: null,
    error_category: null,
    occurred_at: updatedAt,
  });
  tables.recoverable_deletions.push({
    node_id: "event-node",
    owner_id: "owner-1",
    deleted_at: updatedAt,
    purge_after: new Date("2026-08-24T17:00:00.000Z"),
    recovery_envelope: encryptedBytes,
  });
  tables.operation_ledger.push({
    operation_id: "operation-1",
    owner_id: "owner-1",
    provider: "google-calendar",
    provider_operation_id: "provider-operation-1",
    operation_kind: "vision_calendar_create",
    status: "completed",
    requested_at: createdAt,
    completed_at: updatedAt,
    response_envelope: encryptedBytes,
    setup_version: 1,
    result_calendar_id: "calendar-1",
  });
  tables.ai_usage_months.push({
    owner_id: "owner-1",
    budget_month: "2026-07",
    settled_cents: 4,
    reserved_cents: 0,
    created_at: createdAt,
    updated_at: updatedAt,
  });
  tables.ai_usage_reservations.push({
    id: "reservation-1",
    owner_id: "owner-1",
    budget_month: "2026-07",
    idempotency_key: "category:event-node",
    request_class: "routine",
    status: "settled",
    estimated_cents: 5,
    actual_cents: 4,
    provider_request_id: "response-1",
    model_id: "gpt-5.6-luna",
    input_tokens: 100,
    output_tokens: 20,
    total_tokens: 120,
    created_at: createdAt,
    expires_at: new Date("2026-07-25T16:01:00.000Z"),
    dispatched_at: new Date("2026-07-25T16:00:10.000Z"),
    completed_at: updatedAt,
  });
  tables.ai_usage_ledger.push({
    id: "usage-1",
    reservation_id: "reservation-1",
    owner_id: "owner-1",
    budget_month: "2026-07",
    event_type: "settled",
    estimated_cents: 5,
    actual_cents: 4,
    provider_request_id: "response-1",
    model_id: "gpt-5.6-luna",
    input_tokens: 100,
    output_tokens: 20,
    total_tokens: 120,
    occurred_at: updatedAt,
  });

  return { schemaVersion: BACKUP_SCHEMA_VERSION, tables };
}

async function backupKey(keyVersion = 3) {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return createBackupEncryptionKey(key, keyVersion);
}

function cloneSnapshot(snapshot: BackupSnapshotV1): MutableBackupSnapshot {
  return {
    schemaVersion: snapshot.schemaVersion,
    tables: Object.fromEntries(
      BACKUP_TABLES.map((table) => [
        table,
        snapshot.tables[table].map((row) => ({ ...row })),
      ]),
    ) as unknown as Record<BackupTableName, BackupRow[]>,
  };
}

class MemoryRestoreTarget implements BackupRestoreTarget {
  description: RestoreTargetDescription;
  snapshot: MutableBackupSnapshot;
  stageCalls = 0;
  promoteCalls = 0;
  stagedCountDelta = 0;
  stagedReferencesValid = true;
  failPromotion = false;
  beforeTransaction?: () => void;

  constructor(options?: {
    snapshot?: BackupSnapshotV1;
    disposable?: boolean;
    environment?: string;
    schemaVersion?: number;
    targetId?: string;
  }) {
    this.snapshot = cloneSnapshot(
      options?.snapshot ?? {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        tables: emptyTables(),
      },
    );
    this.description = {
      targetId: options?.targetId ?? "disposable-preview-branch",
      environment: options?.environment ?? "preview",
      disposable: options?.disposable ?? true,
      schemaVersion: options?.schemaVersion ?? BACKUP_SCHEMA_VERSION,
      revision: "revision-1",
      rowCounts: Object.fromEntries(
        BACKUP_TABLES.map((table) => [table, this.snapshot.tables[table].length]),
      ) as Record<BackupTableName, number>,
    };
  }

  async describe(): Promise<RestoreTargetDescription> {
    return this.description;
  }

  async transaction<T>(
    operation: (transaction: BackupRestoreTransaction) => Promise<T>,
  ): Promise<T> {
    this.beforeTransaction?.();
    let pending: MutableBackupSnapshot | undefined;
    const currentDescription = (): RestoreTargetDescription => ({
      ...this.description,
      rowCounts: Object.fromEntries(
        BACKUP_TABLES.map((table) => [table, this.snapshot.tables[table].length]),
      ) as Record<BackupTableName, number>,
    });
    const transaction: BackupRestoreTransaction = {
      lockTargetForRestore: async () => currentDescription(),
      stage: async (snapshot) => {
        this.stageCalls += 1;
        pending = cloneSnapshot(snapshot);
        return { opaqueId: "stage-1" };
      },
      inspectStage: async (_stage: BackupRestoreStage) => ({
        rowCounts: Object.fromEntries(
          BACKUP_TABLES.map((table) => [
            table,
            (pending?.tables[table].length ?? 0) +
              (table === "nodes" ? this.stagedCountDelta : 0),
          ]),
        ) as Record<BackupTableName, number>,
        referencesValid: this.stagedReferencesValid,
      }),
      assertTargetUnchanged: async (expected) => {
        if (
          JSON.stringify(currentDescription()) !== JSON.stringify(expected)
        ) {
          throw new Error("Backup restore target changed.");
        }
      },
      promote: async (_stage, _options) => {
        this.promoteCalls += 1;
        if (!pending) throw new Error("Missing staged snapshot.");
        if (this.failPromotion) throw new Error("synthetic promotion failure");
      },
    };

    const result = await operation(transaction);
    if (pending) this.snapshot = pending;
    return result;
  }
}

class DatabaseBackedRacyTarget implements BackupRestoreTarget {
  promoteCalls = 0;

  private constructor(
    readonly database: PGlite,
    private readonly drift: "occupy" | "replacement-policy",
  ) {}

  static async create(
    drift: "occupy" | "replacement-policy",
  ): Promise<DatabaseBackedRacyTarget> {
    const database = new PGlite();
    await database.exec(`
      create table restore_target_state (
        target_id text not null,
        environment text not null,
        disposable boolean not null,
        schema_version integer not null,
        revision text not null
      );
      create table restore_target_counts (
        table_name text primary key,
        row_count integer not null
      );
      insert into restore_target_state
        (target_id, environment, disposable, schema_version, revision)
      values
        ('disposable-preview-branch', 'preview', true, 9, 'revision-1');
    `);
    for (const table of BACKUP_TABLES) {
      await database.query(
        `insert into restore_target_counts (table_name, row_count)
         values ($1, $2)`,
        [table, drift === "replacement-policy" && table === "audit_events" ? 1 : 0],
      );
    }
    return new DatabaseBackedRacyTarget(database, drift);
  }

  async transaction<T>(
    operation: (transaction: BackupRestoreTransaction) => Promise<T>,
  ): Promise<T> {
    let pending: MutableBackupSnapshot | undefined;
    let driftApplied = false;
    const describe = async (): Promise<RestoreTargetDescription> => {
      const state = await this.database.query<{
        target_id: string;
        environment: string;
        disposable: boolean;
        schema_version: number;
        revision: string;
      }>(`select * from restore_target_state`);
      const counts = await this.database.query<{
        table_name: BackupTableName;
        row_count: number;
      }>(`select table_name, row_count from restore_target_counts`);
      const row = state.rows[0]!;
      return {
        targetId: row.target_id,
        environment: row.environment,
        disposable: row.disposable,
        schemaVersion: row.schema_version,
        revision: row.revision,
        rowCounts: Object.fromEntries(
          counts.rows.map((count) => [count.table_name, count.row_count]),
        ) as Record<BackupTableName, number>,
      };
    };
    const applyDrift = async () => {
      if (driftApplied) return;
      driftApplied = true;
      if (this.drift === "occupy") {
        await this.database.exec(`
          update restore_target_counts
          set row_count = 1
          where table_name = 'audit_events';
          update restore_target_state set revision = 'revision-2';
        `);
      } else {
        await this.database.exec(`
          update restore_target_state
          set environment = 'production', revision = 'revision-2';
        `);
      }
    };
    const transaction: BackupRestoreTransaction = {
      lockTargetForRestore: describe,
      stage: async (snapshot) => {
        pending = cloneSnapshot(snapshot);
        await applyDrift();
        return { opaqueId: "database-stage" };
      },
      inspectStage: async () => ({
        rowCounts: Object.fromEntries(
          BACKUP_TABLES.map((table) => [
            table,
            pending?.tables[table].length ?? 0,
          ]),
        ) as Record<BackupTableName, number>,
        referencesValid: true,
      }),
      assertTargetUnchanged: async (expected) => {
        if (JSON.stringify(await describe()) !== JSON.stringify(expected)) {
          throw new Error("Backup restore target changed during transaction.");
        }
      },
      promote: async () => {
        this.promoteCalls += 1;
      },
    };
    return operation(transaction);
  }
}

async function reencryptPayload(
  encrypted: EncryptedBackup,
  key: Awaited<ReturnType<typeof backupKey>>,
  mutate: (payload: Record<string, unknown>) => void,
  options: { rehashArchive?: boolean } = {},
): Promise<EncryptedBackup> {
  const plaintext = await decryptBackupEnvelope(encrypted, key);
  const payload = JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, unknown>;
  mutate(payload);
  if (options.rehashArchive) {
    (payload.manifest as Record<string, unknown>).plaintextSha256 =
      await sha256Base64Url(
        decodeBase64Url(payload.archive, "Test backup archive", 100_000),
      );
  }
  return encryptBackupEnvelope(new TextEncoder().encode(JSON.stringify(payload)), key);
}

interface PostgreSqlInvalidBackupValue {
  readonly label: string;
  readonly table: BackupTableName;
  readonly rowIndex: number;
  readonly column: string;
  readonly invalidValue: BackupValue;
  readonly validSnapshot: () => MutableBackupSnapshot;
}

function postgresInvalidBackupValues(): readonly PostgreSqlInvalidBackupValue[] {
  return [
    {
      label: "impossible Gregorian day",
      table: "audit_events",
      rowIndex: 0,
      column: "occurred_at",
      invalidValue: "2026-02-30T00:00:00.000Z",
      validSnapshot: () => auditSnapshot(["timestamp"]),
    },
    {
      label: "non-leap February 29",
      table: "audit_events",
      rowIndex: 0,
      column: "occurred_at",
      invalidValue: "2025-02-29T00:00:00Z",
      validSnapshot: () => auditSnapshot(["timestamp"]),
    },
    {
      label: "Date before the supported PostgreSQL year range",
      table: "audit_events",
      rowIndex: 0,
      column: "occurred_at",
      invalidValue: new Date("0000-01-01T00:00:00.000Z"),
      validSnapshot: () => auditSnapshot(["timestamp"]),
    },
    {
      label: "Date after the supported PostgreSQL year range",
      table: "audit_events",
      rowIndex: 0,
      column: "occurred_at",
      invalidValue: new Date("+010000-01-01T00:00:00.000Z"),
      validSnapshot: () => auditSnapshot(["timestamp"]),
    },
    {
      label: "normalized 24-hour clock",
      table: "audit_events",
      rowIndex: 0,
      column: "occurred_at",
      invalidValue: "2026-01-01T24:00:00Z",
      validSnapshot: () => auditSnapshot(["timestamp"]),
    },
    {
      label: "normalized leap second",
      table: "audit_events",
      rowIndex: 0,
      column: "occurred_at",
      invalidValue: "2026-01-01T23:59:60Z",
      validSnapshot: () => auditSnapshot(["timestamp"]),
    },
    {
      label: "oversized time-zone offset",
      table: "audit_events",
      rowIndex: 0,
      column: "occurred_at",
      invalidValue: "2026-01-01T00:00:00+16:00",
      validSnapshot: () => auditSnapshot(["timestamp"]),
    },
    {
      label: "invalid time-zone offset minute",
      table: "audit_events",
      rowIndex: 0,
      column: "occurred_at",
      invalidValue: "2026-01-01T00:00:00+12:60",
      validSnapshot: () => auditSnapshot(["timestamp"]),
    },
    {
      label: "lower offset-adjusted instant before supported year range",
      table: "audit_events",
      rowIndex: 0,
      column: "occurred_at",
      invalidValue: "0001-01-01T00:00:00+15:59",
      validSnapshot: () => auditSnapshot(["timestamp"]),
    },
    {
      label: "upper offset-adjusted instant after supported year range",
      table: "audit_events",
      rowIndex: 0,
      column: "occurred_at",
      invalidValue: "9999-12-31T23:59:59.999999-15:59",
      validSnapshot: () => auditSnapshot(["timestamp"]),
    },
    {
      label: "NUL in PostgreSQL text",
      table: "audit_events",
      rowIndex: 0,
      column: "action",
      invalidValue: "event\u0000action",
      validSnapshot: () => auditSnapshot(["safe-action"]),
    },
    ...[
      ["high", "\uD800"],
      ["low", "\uDC00"],
    ].flatMap(([kind, surrogate]) => [
      {
        label: `lone ${kind} surrogate in PostgreSQL text`,
        table: "audit_events" as const,
        rowIndex: 0,
        column: "action",
        invalidValue: `event-${surrogate}-action`,
        validSnapshot: () => auditSnapshot(["safe-action"]),
      },
      {
        label: `lone ${kind} surrogate in nested JSONB string`,
        table: "projection_rebuild_changes" as const,
        rowIndex: 0,
        column: "planning_json",
        invalidValue: ["safe", { nested: `bad-${surrogate}-value` }],
        validSnapshot: () => projectionSnapshot({ safe: true }),
      },
      {
        label: `lone ${kind} surrogate in JSONB object key`,
        table: "projection_rebuild_changes" as const,
        rowIndex: 0,
        column: "planning_json",
        invalidValue: { [`bad-${surrogate}-key`]: "value" },
        validSnapshot: () => projectionSnapshot({ safe: true }),
      },
    ]),
    {
      label: "NUL in nested JSONB string",
      table: "projection_rebuild_changes",
      rowIndex: 0,
      column: "planning_json",
      invalidValue: ["safe", { nested: "bad\u0000value" }],
      validSnapshot: () => projectionSnapshot({ safe: true }),
    },
    {
      label: "NUL in JSONB object key",
      table: "projection_rebuild_changes",
      rowIndex: 0,
      column: "planning_json",
      invalidValue: { ["bad\u0000key"]: "value" },
      validSnapshot: () => projectionSnapshot({ safe: true }),
    },
    ...[
      "-0",
      "01",
      "+1",
      "1.0",
      "1e0",
      " 1",
      "1 ",
      "000",
      "-00",
      "2147483648",
    ].map(
      (invalidValue) => ({
        label: `noncanonical or out-of-range integer ${JSON.stringify(invalidValue)}`,
        table: "ai_usage_months" as const,
        rowIndex: 0,
        column: "reserved_cents",
        invalidValue,
        validSnapshot: () => usageMonthSnapshot(),
      }),
    ),
  ];
}

function withInvalidBackupValue(
  testCase: PostgreSqlInvalidBackupValue,
): MutableBackupSnapshot {
  const snapshot = testCase.validSnapshot();
  snapshot.tables[testCase.table][testCase.rowIndex] = {
    ...snapshot.tables[testCase.table][testCase.rowIndex]!,
    [testCase.column]: testCase.invalidValue,
  };
  return snapshot;
}

function encodeTestBackupValue(value: BackupValue): unknown {
  if (value === null) return ["null"];
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "number") return ["number", value];
  if (typeof value === "string") return ["string", value];
  if (typeof value === "bigint") return ["bigint", value.toString()];
  if (value instanceof Date) return ["date", value.toISOString()];
  if (value instanceof Uint8Array) return ["bytes", encodeBase64Url(value)];
  if (Array.isArray(value)) {
    return ["array", value.map((entry) => encodeTestBackupValue(entry))];
  }
  const record = value as Readonly<Record<string, BackupValue>>;
  return [
    "object",
    Object.keys(record)
      .sort()
      .map((key) => [key, encodeTestBackupValue(record[key]!)]),
  ];
}

function replaceArchiveColumn(
  archive: Uint8Array,
  testCase: PostgreSqlInvalidBackupValue,
): Uint8Array {
  const lines = new TextDecoder().decode(archive).split("\n").filter(Boolean);
  const lineIndex = lines.findIndex((line) =>
    line.includes(`"table":"${testCase.table}"`),
  );
  const record = JSON.parse(lines[lineIndex]!) as {
    row: [string, Array<[string, unknown]>];
  };
  const field = record.row[1].find(([name]) => name === testCase.column);
  if (!field) throw new Error(`Missing test field ${testCase.column}.`);
  field[1] = encodeTestBackupValue(testCase.invalidValue);
  lines[lineIndex] = JSON.stringify(record);
  return new TextEncoder().encode(`${lines.join("\n")}\n`);
}

describe("encrypted backup round trip", () => {
  it("matches every table and column produced by migrations 0001 through 0009", async () => {
    const database = new PGlite();
    try {
      for (const migration of [
        "0001_phase_b_foundation.sql",
        "0002_google_auth_sessions.sql",
        "0003_calendar_setup.sql",
        "0004_incremental_event_sync.sql",
        "0005_google_notification_jobs.sql",
        "0006_google_channel_lifecycle.sql",
        "0007_calendar_maintenance_state.sql",
        "0008_google_projection_rebuild.sql",
        "0009_ai_usage_budget.sql",
      ]) {
        await database.exec(
          await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
        );
      }
      const columns = await database.query<{
        table_name: string;
        column_name: string;
      }>(
        `select table_name, column_name
         from information_schema.columns
         where table_schema = 'public'
         order by table_name, ordinal_position`,
      );
      const migratedColumns = Object.fromEntries(
        BACKUP_TABLES.map((table) => [
          table,
          columns.rows
            .filter((column) => column.table_name === table)
            .map((column) => column.column_name),
        ]),
      );

      expect(Object.keys(migratedColumns).sort()).toEqual([...BACKUP_TABLES].sort());
      expect(migratedColumns).toEqual(BACKUP_TABLE_COLUMNS);
    } finally {
      await database.close();
    }
  }, 15_000);

  it("uses stable canonical table/key order and preserves application ciphertext exactly", async () => {
    const first = await representativeSnapshot();
    const second = cloneSnapshot(first);
    second.tables.nodes.reverse();
    second.tables.events[0] = Object.fromEntries(
      Object.entries(second.tables.events[0]!).reverse(),
    );

    const firstArchive = encodeCanonicalBackupArchive(first);
    const secondArchive = encodeCanonicalBackupArchive(second);

    expect(secondArchive).toEqual(firstArchive);
    expect(new TextDecoder().decode(firstArchive).split("\n").filter(Boolean)).toHaveLength(12);
  });

  it("encrypts the manifest and archive with a fresh IV and restores stable identities", async () => {
    const source = await representativeSnapshot();
    const key = await backupKey();
    const first = await exportBackup(source, key, { createdAt: CREATED_AT });
    const second = await exportBackup(source, key, { createdAt: CREATED_AT });
    const target = new MemoryRestoreTarget();

    expect(first.iv).not.toBe(second.iv);
    const serialized = serializeEncryptedBackup(first);
    expect(serialized).not.toContain(SENTINEL);
    expect(serialized).not.toContain(BACKUP_FORMAT_V1);
    expect(serialized).not.toContain(CREATED_AT);
    expect(serialized).not.toContain('"nodes"');

    const report = await importBackup(first, key, target);
    expect(report).toMatchObject({
      schemaVersion: BACKUP_SCHEMA_VERSION,
      plaintextSha256: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    expect(report.rowCounts).toEqual(
      Object.fromEntries(
        BACKUP_TABLES.map((table) => [table, source.tables[table].length]),
      ),
    );
    expect(target.snapshot.tables.nodes.map((row) => row.id)).toEqual([
      "calendar-node",
      "event-node",
    ]);
    expect(target.snapshot.tables.events[0]!.title_envelope).toEqual(
      source.tables.events[0]!.title_envelope,
    );
    expect(target.stageCalls).toBe(1);
    expect(target.promoteCalls).toBe(1);
  });

  it("round-trips the canonical completely empty snapshot and rejects malformed empty encodings", async () => {
    const source: MutableBackupSnapshot = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      tables: emptyTables(),
    };
    const key = await backupKey();
    const encrypted = await exportBackup(source, key, { createdAt: CREATED_AT });
    const target = new MemoryRestoreTarget();

    await expect(importBackup(encrypted, key, target)).resolves.toMatchObject({
      rowCounts: Object.fromEntries(BACKUP_TABLES.map((table) => [table, 0])),
    });
    expect(target.stageCalls).toBe(1);

    for (const malformed of ["=", " ", "A", null]) {
      const candidate = await reencryptPayload(encrypted, key, (payload) => {
        payload.archive = malformed;
      });
      const malformedTarget = new MemoryRestoreTarget();
      await expect(importBackup(candidate, key, malformedTarget)).rejects.toThrow(
        /archive|payload/i,
      );
      expect(malformedTarget.stageCalls).toBe(0);
    }
  });

  it("fails closed before target writes for a wrong key or tampered ciphertext", async () => {
    const source = await representativeSnapshot();
    const key = await backupKey();
    const wrongKey = await backupKey();
    const encrypted = await exportBackup(source, key, { createdAt: CREATED_AT });

    for (const candidate of [
      encrypted,
      {
        ...encrypted,
        ciphertext: `${encrypted.ciphertext.slice(0, -1)}${
          encrypted.ciphertext.endsWith("A") ? "B" : "A"
        }`,
      },
    ]) {
      const target = new MemoryRestoreTarget();
      await expect(importBackup(candidate, candidate === encrypted ? wrongKey : key, target)).rejects.toThrow();
      expect(target.stageCalls).toBe(0);
      expect(target.promoteCalls).toBe(0);
    }
  });

  it("rejects an unsupported outer envelope before target writes", async () => {
    const key = await backupKey();
    const encrypted = await exportBackup(await representativeSnapshot(), key, {
      createdAt: CREATED_AT,
    });
    const target = new MemoryRestoreTarget();

    await expect(
      importBackup({ ...encrypted, version: 2 } as unknown as EncryptedBackup, key, target),
    ).rejects.toThrow(/version/i);
    expect(target.stageCalls).toBe(0);
  });

  it("admits only a non-extractable two-direction AES-256 backup key", async () => {
    const extractable = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const encryptOnly = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );

    expect(() => createBackupEncryptionKey(extractable, 1)).toThrow(/non-extractable/i);
    expect(() => createBackupEncryptionKey(encryptOnly, 1)).toThrow(/AES-256-GCM/i);
    expect(() =>
      createBackupEncryptionKey(
        ({} as { key: CryptoKey }).key,
        1,
      ),
    ).toThrow(/AES-256-GCM/i);
  });

  it("rejects checksum mismatch and unsupported manifest versions before target writes", async () => {
    const key = await backupKey();
    const encrypted = await exportBackup(await representativeSnapshot(), key, {
      createdAt: CREATED_AT,
    });
    const candidates = [
      await reencryptPayload(encrypted, key, (payload) => {
        (payload.manifest as Record<string, unknown>).plaintextSha256 = "A".repeat(43);
      }),
      await reencryptPayload(encrypted, key, (payload) => {
        (payload.manifest as Record<string, unknown>).format = "vision-backup/v2";
      }),
      await reencryptPayload(encrypted, key, (payload) => {
        (payload.manifest as Record<string, unknown>).schemaVersion = 10;
      }),
    ];

    for (const candidate of candidates) {
      const target = new MemoryRestoreTarget();
      await expect(importBackup(candidate, key, target)).rejects.toThrow();
      expect(target.stageCalls).toBe(0);
      expect(target.promoteCalls).toBe(0);
    }
  });

  it("rejects broken references and manifest count disagreement before target writes", async () => {
    const key = await backupKey();
    const encrypted = await exportBackup(await representativeSnapshot(), key, {
      createdAt: CREATED_AT,
    });
    const brokenReference = await reencryptPayload(encrypted, key, (payload) => {
      const archive = new TextDecoder().decode(
        decodeBase64Url(payload.archive, "Test backup archive", 100_000),
      );
      const lines = archive.split("\n").filter(Boolean);
      const edgeIndex = lines.findIndex((line) => line.includes('"edges"'));
      const record = JSON.parse(lines[edgeIndex]!) as {
        row: [string, Array<[string, unknown]>];
      };
      const source = record.row[1].find(([name]) => name === "source_node_id");
      if (source) source[1] = ["string", "missing-node"];
      lines[edgeIndex] = JSON.stringify(record);
      payload.archive = encodeBase64Url(
        new TextEncoder().encode(`${lines.join("\n")}\n`),
      );
    }, { rehashArchive: true });
    const badCount = await reencryptPayload(encrypted, key, (payload) => {
      const manifest = payload.manifest as {
        rowCounts: Record<string, number>;
      };
      manifest.rowCounts.nodes += 1;
    });

    for (const [candidate, expectedError] of [
      [brokenReference, /reference/i],
      [badCount, /row counts/i],
    ] as const) {
      const target = new MemoryRestoreTarget();
      await expect(importBackup(candidate, key, target)).rejects.toThrow(expectedError);
      expect(target.stageCalls).toBe(0);
    }
  });

  it("rejects missing or injected schema columns before target writes", async () => {
    const key = await backupKey();
    const incomplete = await representativeSnapshot();
    delete (incomplete.tables.events[0] as Record<string, unknown>).provider;
    await expect(
      exportBackup(incomplete, key, { createdAt: CREATED_AT }),
    ).rejects.toThrow(/fields/i);

    const encrypted = await exportBackup(await representativeSnapshot(), key, {
      createdAt: CREATED_AT,
    });
    const injectedColumn = await reencryptPayload(
      encrypted,
      key,
      (payload) => {
        const archive = new TextDecoder().decode(
          decodeBase64Url(payload.archive, "Test backup archive", 100_000),
        );
        const lines = archive.split("\n").filter(Boolean);
        const nodeIndex = lines.findIndex((line) => line.includes('"nodes"'));
        const record = JSON.parse(lines[nodeIndex]!) as {
          row: [string, Array<[string, unknown]>];
        };
        record.row[1].push(["zz_unknown", ["string", "injected"]]);
        lines[nodeIndex] = JSON.stringify(record);
        payload.archive = encodeBase64Url(
          new TextEncoder().encode(`${lines.join("\n")}\n`),
        );
      },
      { rehashArchive: true },
    );
    const target = new MemoryRestoreTarget();

    await expect(importBackup(injectedColumn, key, target)).rejects.toThrow(
      /fields/i,
    );
    expect(target.stageCalls).toBe(0);
  });

  it("rejects wrong SQL representations, nullability violations, checks, and alternate identities before hashing or writes", async () => {
    const key = await backupKey();
    const invalidSnapshots: MutableBackupSnapshot[] = [];

    const wrongTimestamp = await representativeSnapshot();
    wrongTimestamp.tables.nodes[0] = {
      ...wrongTimestamp.tables.nodes[0]!,
      created_at: "not-a-timestamp",
    };
    invalidSnapshots.push(wrongTimestamp);

    const wrongBytea = await representativeSnapshot();
    wrongBytea.tables.events[0] = {
      ...wrongBytea.tables.events[0]!,
      title_envelope: "not-postgresql-bytea",
    };
    invalidSnapshots.push(wrongBytea);

    const wrongInteger: MutableBackupSnapshot = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      tables: emptyTables(),
    };
    wrongInteger.tables.data_key_state.push({
      id: "primary",
      active_key_version: "not-an-integer",
    });
    invalidSnapshots.push(wrongInteger);

    const wrongJson: MutableBackupSnapshot = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      tables: emptyTables(),
    };
    wrongJson.tables.projection_rebuild_generations.push({
      id: "generation-1",
      owner_id: "owner-1",
      provider: "google-calendar",
      provider_calendar_id: "calendar-1",
      job_id: "job-1",
      queue_claim_id: "claim-1",
      base_checkpoint_version: 1,
      status: "staging",
      page_count: null,
      created_at: new Date("2026-07-25T16:00:00.000Z"),
      updated_at: new Date("2026-07-25T16:00:00.000Z"),
      activated_at: null,
    });
    wrongJson.tables.projection_rebuild_changes.push({
      generation_id: "generation-1",
      identity_hash: "A".repeat(43),
      ordinal: 0,
      planning_json: new Date("2026-07-25T16:00:00.000Z"),
      protected_payload_envelope: null,
      protected_key_version: null,
    });
    invalidSnapshots.push(wrongJson);

    const nullViolation = await representativeSnapshot();
    nullViolation.tables.nodes[0] = {
      ...nullViolation.tables.nodes[0]!,
      owner_id: null,
    };
    invalidSnapshots.push(nullViolation);

    const checkViolation: MutableBackupSnapshot = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      tables: emptyTables(),
    };
    checkViolation.tables.data_key_state.push({
      id: "secondary",
      active_key_version: 1,
    });
    invalidSnapshots.push(checkViolation);

    const duplicateAlternateIdentity = await representativeSnapshot();
    duplicateAlternateIdentity.tables.nodes.push({
      ...duplicateAlternateIdentity.tables.nodes[0]!,
      id: "calendar-node-duplicate",
    });
    invalidSnapshots.push(duplicateAlternateIdentity);

    for (const snapshot of invalidSnapshots) {
      const digest = vi.spyOn(crypto.subtle, "digest");
      await expect(
        exportBackup(snapshot, key, { createdAt: CREATED_AT }),
      ).rejects.toThrow(/backup/i);
      expect(digest).not.toHaveBeenCalled();
      digest.mockRestore();
    }
  });

  it("rejects PostgreSQL-invalid and normalization-ambiguous values before hashing or encryption", async () => {
    const key = await backupKey();

    for (const testCase of postgresInvalidBackupValues()) {
      const digest = vi.spyOn(crypto.subtle, "digest");
      const encrypt = vi.spyOn(crypto.subtle, "encrypt");
      try {
        await expect(
          exportBackup(withInvalidBackupValue(testCase), key, {
            createdAt: CREATED_AT,
          }),
          testCase.label,
        ).rejects.toThrow(/backup/i);
        expect(digest, testCase.label).not.toHaveBeenCalled();
        expect(encrypt, testCase.label).not.toHaveBeenCalled();
      } finally {
        digest.mockRestore();
        encrypt.mockRestore();
      }
    }
  });

  it("rejects PostgreSQL-invalid canonical records on decode and before import staging", async () => {
    const key = await backupKey();

    for (const testCase of postgresInvalidBackupValues()) {
      const validSnapshot = testCase.validSnapshot();
      const archive = replaceArchiveColumn(
        encodeCanonicalBackupArchive(validSnapshot),
        testCase,
      );
      expect(
        () => decodeCanonicalBackupArchive(archive),
        testCase.label,
      ).toThrow(/backup/i);

      const validEncrypted = await exportBackup(validSnapshot, key, {
        createdAt: CREATED_AT,
      });
      const invalidEncrypted = await reencryptPayload(
        validEncrypted,
        key,
        (payload) => {
          payload.archive = encodeBase64Url(
            replaceArchiveColumn(
              decodeBase64Url(
                payload.archive,
                "Test backup archive",
                BACKUP_ARCHIVE_LIMITS.maximumArchiveBytes * 2,
              ),
              testCase,
            ),
          );
        },
        { rehashArchive: true },
      );
      const target = new MemoryRestoreTarget();
      await expect(
        importBackup(invalidEncrypted, key, target),
        testCase.label,
      ).rejects.toThrow(/backup/i);
      expect(target.stageCalls, testCase.label).toBe(0);
      expect(target.promoteCalls, testCase.label).toBe(0);
    }
  });

  it("enforces PostgreSQL microsecond ordering before hashing, decode, or staging", async () => {
    const createdMutation: PostgreSqlInvalidBackupValue = {
      label: "later microsecond creation instant",
      table: "ai_usage_months",
      rowIndex: 0,
      column: "created_at",
      invalidValue: "2026-07-25T18:00:00.000999Z",
      validSnapshot: () => usageMonthSnapshot(),
    };
    const updatedMutation: PostgreSqlInvalidBackupValue = {
      label: "earlier microsecond update instant",
      table: "ai_usage_months",
      rowIndex: 0,
      column: "updated_at",
      invalidValue: "2026-07-25T18:00:00.000001Z",
      validSnapshot: () => usageMonthSnapshot(),
    };
    const invalidSource = usageMonthSnapshot();
    invalidSource.tables.ai_usage_months[0] = {
      ...invalidSource.tables.ai_usage_months[0]!,
      created_at: createdMutation.invalidValue,
      updated_at: updatedMutation.invalidValue,
    };
    const key = await backupKey();
    const digest = vi.spyOn(crypto.subtle, "digest");
    const encrypt = vi.spyOn(crypto.subtle, "encrypt");
    try {
      await expect(
        exportBackup(invalidSource, key, { createdAt: CREATED_AT }),
      ).rejects.toThrow(/backup/i);
      expect(digest).not.toHaveBeenCalled();
      expect(encrypt).not.toHaveBeenCalled();
    } finally {
      digest.mockRestore();
      encrypt.mockRestore();
    }

    const validSource = usageMonthSnapshot();
    const invalidArchive = replaceArchiveColumn(
      replaceArchiveColumn(
        encodeCanonicalBackupArchive(validSource),
        createdMutation,
      ),
      updatedMutation,
    );
    expect(() => decodeCanonicalBackupArchive(invalidArchive)).toThrow(
      /backup/i,
    );

    const validEncrypted = await exportBackup(validSource, key, {
      createdAt: CREATED_AT,
    });
    const invalidEncrypted = await reencryptPayload(
      validEncrypted,
      key,
      (payload) => {
        const archive = decodeBase64Url(
          payload.archive,
          "Test backup archive",
          BACKUP_ARCHIVE_LIMITS.maximumArchiveBytes * 2,
        );
        payload.archive = encodeBase64Url(
          replaceArchiveColumn(
            replaceArchiveColumn(archive, createdMutation),
            updatedMutation,
          ),
        );
      },
      { rehashArchive: true },
    );
    const target = new MemoryRestoreTarget();
    await expect(importBackup(invalidEncrypted, key, target)).rejects.toThrow(
      /backup/i,
    );
    expect(target.stageCalls).toBe(0);
    expect(target.promoteCalls).toBe(0);
  });

  it("preserves valid PostgreSQL boundary values across export and import", async () => {
    const source = projectionSnapshot({
      scalar: "Vision \u{1F4C5}",
      object: { "école": true },
      array: [null, false, 42, "仕事"],
    });
    const validTimestamps = [
      "0001-01-01T00:00:00.000Z",
      "0001-01-01T15:59:00+15:59",
      "0001-01-01T15:59:00.000001+15:59",
      "9999-12-31T23:59:59.999999Z",
      "9999-12-31T08:00:59.999998-15:59",
      "9999-12-31T08:00:59.999999-15:59",
      "2024-02-29T23:59:59Z",
      "2026-01-01T00:00:00+15:59",
      "2026-01-01 00:00:00-15:59",
    ] as const;
    const validDateObjects = [
      new Date("0001-01-01T00:00:00.000Z"),
      new Date("9999-12-31T23:59:59.999Z"),
    ] as const;
    [...validTimestamps, ...validDateObjects].forEach((occurredAt, index) => {
      source.tables.audit_events.push({
        id: `boundary-${index}`,
        owner_id: "owner-\u{1F30E}",
        node_id: null,
        actor_type: "system",
        action: `Unicode café ${index}`,
        outcome: "success",
        provider: null,
        error_category: null,
        occurred_at: occurredAt,
      });
    });
    source.tables.ai_usage_months.push(
      ...usageMonthSnapshot("2147483647").tables.ai_usage_months,
    );
    const key = await backupKey();
    const encrypted = await exportBackup(source, key, {
      createdAt: CREATED_AT,
    });
    const target = new MemoryRestoreTarget();

    await expect(importBackup(encrypted, key, target)).resolves.toMatchObject({
      rowCounts: {
        audit_events: validTimestamps.length + validDateObjects.length,
        projection_rebuild_changes: 1,
        ai_usage_months: 1,
      },
    });
    expect(target.stageCalls).toBe(1);
    expect(target.promoteCalls).toBe(1);
    expect(
      target.snapshot.tables.projection_rebuild_changes[0]!.planning_json,
    ).toEqual(source.tables.projection_rebuild_changes[0]!.planning_json);
    expect(target.snapshot.tables.audit_events[0]!.owner_id).toBe(
      source.tables.audit_events[0]!.owner_id,
    );
  });

  it("rejects semantically equivalent but noncanonical NDJSON bytes", async () => {
    const source = await representativeSnapshot();
    source.tables.edges[0] = {
      ...source.tables.edges[0]!,
      confidence: 0,
    };
    const archive = new TextDecoder().decode(
      encodeCanonicalBackupArchive(source),
    );
    const lines = archive.split("\n").filter(Boolean);
    const first = JSON.parse(lines[0]!) as Record<string, unknown>;
    const firstWithReorderedProperties = JSON.stringify({
      table: first.table,
      recordVersion: first.recordVersion,
      row: first.row,
      key: first.key,
    });
    const mutations = [
      `${[`  ${lines[0]}`, ...lines.slice(1)].join("\n")}\n`,
      `${[firstWithReorderedProperties, ...lines.slice(1)].join("\n")}\n`,
      `${[
        lines[0]!.replace(
          '{"recordVersion":1,',
          '{"recordVersion":1,"recordVersion":1,',
        ),
        ...lines.slice(1),
      ].join("\n")}\n`,
      archive.replace(
        '["confidence",["number",0]]',
        '["confidence",["number",-0]]',
      ),
      archive.replace('["number",1]', '["number",1e0]'),
    ];

    for (const mutatedArchive of mutations) {
      expect(mutatedArchive).not.toBe(archive);
      const mutated = new TextEncoder().encode(mutatedArchive);
      expect(() => decodeCanonicalBackupArchive(mutated)).toThrow(
        /canonical|record|encoded|unsupported/i,
      );
    }
  });

  it("owns archive rows and counts before the first asynchronous boundary", async () => {
    const source = await representativeSnapshot();
    const key = await backupKey();
    const exportPromise = exportBackup(source, key, { createdAt: CREATED_AT });
    source.tables.audit_events.push({
      ...source.tables.audit_events[0]!,
      id: "audit-late-mutation",
    });

    const encrypted = await exportPromise;
    const target = new MemoryRestoreTarget();
    await expect(importBackup(encrypted, key, target)).resolves.toBeDefined();
    expect(target.snapshot.tables.audit_events.map((row) => row.id)).toEqual([
      "audit-1",
    ]);
  });

  it("rolls back when staged counts disagree", async () => {
    const key = await backupKey();
    const encrypted = await exportBackup(await representativeSnapshot(), key, {
      createdAt: CREATED_AT,
    });
    const target = new MemoryRestoreTarget();
    target.stagedCountDelta = 1;

    await expect(importBackup(encrypted, key, target)).rejects.toThrow(/staging/i);
    expect(target.promoteCalls).toBe(0);
    expect(target.snapshot.tables.nodes).toHaveLength(0);
  });

  it("rolls back invalid staging references and promotion failures", async () => {
    const key = await backupKey();
    const encrypted = await exportBackup(await representativeSnapshot(), key, {
      createdAt: CREATED_AT,
    });

    const invalidReferences = new MemoryRestoreTarget();
    invalidReferences.stagedReferencesValid = false;
    await expect(importBackup(encrypted, key, invalidReferences)).rejects.toThrow(
      /staging reference/i,
    );
    expect(invalidReferences.promoteCalls).toBe(0);
    expect(invalidReferences.snapshot.tables.nodes).toHaveLength(0);

    const failedPromotion = new MemoryRestoreTarget();
    failedPromotion.failPromotion = true;
    await expect(importBackup(encrypted, key, failedPromotion)).rejects.toThrow(
      BackupRestorePromotionError,
    );
    expect(failedPromotion.promoteCalls).toBe(1);
    expect(failedPromotion.snapshot.tables.nodes).toHaveLength(0);
  });

  it("requires an empty disposable target or an exact explicit replacement assertion", async () => {
    const key = await backupKey();
    const encrypted = await exportBackup(await representativeSnapshot(), key, {
      createdAt: CREATED_AT,
    });
    const occupied = await representativeSnapshot();

    const noReplace = new MemoryRestoreTarget({ snapshot: occupied });
    await expect(importBackup(encrypted, key, noReplace)).rejects.toThrow(/non-empty/i);
    expect(noReplace.stageCalls).toBe(0);

    const wrongAssertion = new MemoryRestoreTarget({ snapshot: occupied });
    await expect(
      importBackup(encrypted, key, wrongAssertion, {
        replaceDisposableTarget: true,
        assertedEnvironment: "test",
        assertedTargetId: "disposable-preview-branch",
      }),
    ).rejects.toThrow(/assertion/i);
    expect(wrongAssertion.stageCalls).toBe(0);

    const replace = new MemoryRestoreTarget({ snapshot: occupied });
    await expect(
      importBackup(encrypted, key, replace, {
        replaceDisposableTarget: true,
        assertedEnvironment: "preview",
        assertedTargetId: "disposable-preview-branch",
      }),
    ).resolves.toBeDefined();
    expect(replace.promoteCalls).toBe(1);
  });

  it("fails closed when an empty target becomes occupied before the restore transaction", async () => {
    const key = await backupKey();
    const encrypted = await exportBackup(await representativeSnapshot(), key, {
      createdAt: CREATED_AT,
    });
    const target = new MemoryRestoreTarget();
    target.beforeTransaction = () => {
      target.snapshot.tables.audit_events.push({
        id: "concurrent-audit",
        owner_id: "owner-1",
        node_id: null,
        actor_type: "system",
        action: "concurrent.write",
        outcome: "success",
        provider: null,
        error_category: null,
        occurred_at: new Date("2026-07-25T18:00:00.000Z"),
      });
    };

    await expect(importBackup(encrypted, key, target)).rejects.toThrow(
      /target|changed|non-empty/i,
    );
    expect(target.promoteCalls).toBe(0);
  });

  it("fails closed when an authorized replacement target drifts before the transaction", async () => {
    const key = await backupKey();
    const encrypted = await exportBackup(await representativeSnapshot(), key, {
      createdAt: CREATED_AT,
    });
    const target = new MemoryRestoreTarget({
      snapshot: await representativeSnapshot(),
    });
    target.beforeTransaction = () => {
      target.description = {
        ...target.description,
        environment: "production",
      };
    };

    await expect(
      importBackup(encrypted, key, target, {
        replaceDisposableTarget: true,
        assertedEnvironment: "preview",
        assertedTargetId: "disposable-preview-branch",
      }),
    ).rejects.toThrow(/target|assertion|changed/i);
    expect(target.promoteCalls).toBe(0);
  });

  it("detects a database-backed empty-to-non-empty interleaving after the target lock", async () => {
    const key = await backupKey();
    const encrypted = await exportBackup(await representativeSnapshot(), key, {
      createdAt: CREATED_AT,
    });
    const target = await DatabaseBackedRacyTarget.create("occupy");
    try {
      await expect(importBackup(encrypted, key, target)).rejects.toThrow(
        /target changed/i,
      );
      expect(target.promoteCalls).toBe(0);
    } finally {
      await target.database.close();
    }
  });

  it("detects database-backed replacement-policy drift after authorization", async () => {
    const key = await backupKey();
    const encrypted = await exportBackup(await representativeSnapshot(), key, {
      createdAt: CREATED_AT,
    });
    const target = await DatabaseBackedRacyTarget.create("replacement-policy");
    try {
      await expect(
        importBackup(encrypted, key, target, {
          replaceDisposableTarget: true,
          assertedEnvironment: "preview",
          assertedTargetId: "disposable-preview-branch",
        }),
      ).rejects.toThrow(/target changed/i);
      expect(target.promoteCalls).toBe(0);
    } finally {
      await target.database.close();
    }
  });

  it("rejects oversized and deeply nested sources before hashing or encryption", async () => {
    const key = await backupKey();
    const oversizedString = await representativeSnapshot();
    oversizedString.tables.audit_events[0] = {
      ...oversizedString.tables.audit_events[0]!,
      action: "x".repeat(7 * 1024 * 1024),
    };
    const oversizedBytes = await representativeSnapshot();
    oversizedBytes.tables.events[0] = {
      ...oversizedBytes.tables.events[0]!,
      title_envelope: new Uint8Array(
        BACKUP_ARCHIVE_LIMITS.maximumByteValueBytes + 1,
      ),
    };
    const deeplyNested = await representativeSnapshot();
    let nested: BackupRow | readonly unknown[] = Object.create(null);
    for (
      let depth = 0;
      depth <= BACKUP_ARCHIVE_LIMITS.maximumValueDepth;
      depth += 1
    ) {
      nested = [nested];
    }
    deeplyNested.tables.events[0] = {
      ...deeplyNested.tables.events[0]!,
      attendees_envelope: nested as unknown as Uint8Array,
    };

    for (const snapshot of [oversizedString, oversizedBytes, deeplyNested]) {
      const digest = vi.spyOn(crypto.subtle, "digest");
      const encrypt = vi.spyOn(crypto.subtle, "encrypt");
      await expect(
        exportBackup(snapshot, key, { createdAt: CREATED_AT }),
      ).rejects.toThrow(/limit|size|depth|backup/i);
      expect(digest).not.toHaveBeenCalled();
      expect(encrypt).not.toHaveBeenCalled();
      digest.mockRestore();
      encrypt.mockRestore();
    }
  });

  it("enforces the immediate string, byte, collection, and nesting boundaries", async () => {
    const maximumString = auditSnapshot([
      "x".repeat(BACKUP_ARCHIVE_LIMITS.maximumStringBytes),
    ]);
    expect(() => encodeCanonicalBackupArchive(maximumString)).not.toThrow();
    maximumString.tables.audit_events[0] = {
      ...maximumString.tables.audit_events[0]!,
      action: "x".repeat(BACKUP_ARCHIVE_LIMITS.maximumStringBytes + 1),
    };
    expect(() => encodeCanonicalBackupArchive(maximumString)).toThrow(
      /string.*limit|size limit/i,
    );

    const maximumBytes = await representativeSnapshot();
    maximumBytes.tables.events[0] = {
      ...maximumBytes.tables.events[0]!,
      title_envelope: new Uint8Array(
        BACKUP_ARCHIVE_LIMITS.maximumByteValueBytes,
      ),
    };
    expect(() => encodeCanonicalBackupArchive(maximumBytes)).not.toThrow();
    maximumBytes.tables.events[0] = {
      ...maximumBytes.tables.events[0]!,
      title_envelope: new Uint8Array(
        BACKUP_ARCHIVE_LIMITS.maximumByteValueBytes + 1,
      ),
    };
    expect(() => encodeCanonicalBackupArchive(maximumBytes)).toThrow(
      /byte value.*limit|size limit/i,
    );

    const maximumArray = projectionSnapshot(
      Array.from(
        { length: BACKUP_ARCHIVE_LIMITS.maximumArrayItems },
        () => null,
      ),
    );
    expect(() => encodeCanonicalBackupArchive(maximumArray)).not.toThrow();
    maximumArray.tables.projection_rebuild_changes[0] = {
      ...maximumArray.tables.projection_rebuild_changes[0]!,
      planning_json: Array.from(
        { length: BACKUP_ARCHIVE_LIMITS.maximumArrayItems + 1 },
        () => null,
      ),
    };
    expect(() => encodeCanonicalBackupArchive(maximumArray)).toThrow(
      /array.*limit/i,
    );

    const maximumObject = Object.fromEntries(
      Array.from(
        { length: BACKUP_ARCHIVE_LIMITS.maximumObjectProperties },
        (_, index) => [`property-${index.toString().padStart(4, "0")}`, null],
      ),
    );
    expect(() =>
      encodeCanonicalBackupArchive(projectionSnapshot(maximumObject)),
    ).not.toThrow();
    maximumObject.extra = null;
    expect(() =>
      encodeCanonicalBackupArchive(projectionSnapshot(maximumObject)),
    ).toThrow(/object.*limit/i);

    const nestedValue = (levels: number): BackupValue => {
      let value: BackupValue = null;
      for (let index = 0; index < levels; index += 1) value = [value];
      return value;
    };
    expect(() =>
      encodeCanonicalBackupArchive(
        projectionSnapshot(
          nestedValue(BACKUP_ARCHIVE_LIMITS.maximumValueDepth - 1),
        ),
      ),
    ).not.toThrow();
    expect(() =>
      encodeCanonicalBackupArchive(
        projectionSnapshot(
          nestedValue(BACKUP_ARCHIVE_LIMITS.maximumValueDepth),
        ),
      ),
    ).toThrow(/depth.*limit/i);
  });

  it("enforces immediate record and complete-archive byte boundaries", () => {
    const baseCandidate = calendarCandidateSnapshot("g", "e");
    const baseCandidateArchive = new TextDecoder().decode(
      encodeCanonicalBackupArchive(baseCandidate),
    );
    const baseCandidateLine = baseCandidateArchive
      .split("\n")
      .find((line) => line.includes('"calendar_setup_candidates"'))!;
    const candidateAdditional =
      BACKUP_ARCHIVE_LIMITS.maximumRecordBytes -
      new TextEncoder().encode(baseCandidateLine).byteLength;
    const subjectAdditional = Math.floor(candidateAdditional / 2);
    const etagAdditional = candidateAdditional - subjectAdditional;
    const maximumRecord = calendarCandidateSnapshot(
      `g${"x".repeat(subjectAdditional)}`,
      `e${"x".repeat(etagAdditional)}`,
    );
    const maximumRecordArchive = new TextDecoder().decode(
      encodeCanonicalBackupArchive(maximumRecord),
    );
    const maximumRecordLine = maximumRecordArchive
      .split("\n")
      .find((line) => line.includes('"calendar_setup_candidates"'))!;
    expect(new TextEncoder().encode(maximumRecordLine)).toHaveLength(
      BACKUP_ARCHIVE_LIMITS.maximumRecordBytes,
    );
    maximumRecord.tables.calendar_setup_candidates[0] = {
      ...maximumRecord.tables.calendar_setup_candidates[0]!,
      provider_etag: `${maximumRecord.tables.calendar_setup_candidates[0]!.provider_etag}x`,
    };
    expect(() => encodeCanonicalBackupArchive(maximumRecord)).toThrow(
      /record.*size limit/i,
    );

    const baseActions = Array.from({ length: 16 }, () => "");
    const baseArchiveBytes = encodeCanonicalBackupArchive(
      auditSnapshot(baseActions),
    ).byteLength;
    const archiveAdditional =
      BACKUP_ARCHIVE_LIMITS.maximumArchiveBytes - baseArchiveBytes - 1;
    const actionAdditional = Math.floor(archiveAdditional / baseActions.length);
    let remainder = archiveAdditional % baseActions.length;
    const boundedActions = baseActions.map(() => {
      const extra = actionAdditional + (remainder > 0 ? 1 : 0);
      remainder -= remainder > 0 ? 1 : 0;
      return "x".repeat(extra);
    });
    const maximumArchive = auditSnapshot(boundedActions);
    expect(encodeCanonicalBackupArchive(maximumArchive)).toHaveLength(
      BACKUP_ARCHIVE_LIMITS.maximumArchiveBytes - 1,
    );
    maximumArchive.tables.audit_events[0] = {
      ...maximumArchive.tables.audit_events[0]!,
      action: `${maximumArchive.tables.audit_events[0]!.action}xx`,
    };
    expect(() => encodeCanonicalBackupArchive(maximumArchive)).toThrow(
      /archive.*size limit/i,
    );
  });

  it("enforces immediate per-table and total-record boundaries before traversal", () => {
    const maximumRows = auditSnapshot(
      Array.from(
        { length: BACKUP_ARCHIVE_LIMITS.maximumRowsPerTable },
        () => "",
      ),
    );
    expect(() => encodeCanonicalBackupArchive(maximumRows)).not.toThrow();

    maximumRows.tables.audit_events.push({
      ...maximumRows.tables.audit_events[0]!,
      id: "audit-over-table-limit",
    });
    expect(() => encodeCanonicalBackupArchive(maximumRows)).toThrow(
      /row count.*limit/i,
    );

    const totalOverflow = auditSnapshot(
      Array.from(
        { length: BACKUP_ARCHIVE_LIMITS.maximumRecords },
        () => "",
      ),
    );
    totalOverflow.tables.oauth_admission_windows.push({
      admission_key_hash: "window-1",
      window_started_at: new Date("2026-07-25T18:00:00.000Z"),
      request_count: 1,
    });
    expect(() => encodeCanonicalBackupArchive(totalOverflow)).toThrow(
      /record-count limit/i,
    );
  });

  it("rejects decoded archives and plaintext envelopes immediately above their limits", async () => {
    expect(() =>
      decodeCanonicalBackupArchive(
        new Uint8Array(BACKUP_ARCHIVE_LIMITS.maximumArchiveBytes + 1),
      ),
    ).toThrow(/size|limit|exceeds/i);

    const key = await backupKey();
    await expect(
      encryptBackupEnvelope(
        new Uint8Array(MAX_BACKUP_PLAINTEXT_BYTES + 1),
        key,
      ),
    ).rejects.toThrow(/size|exceeds/i);

    const maximumPlaintext = new Uint8Array(MAX_BACKUP_PLAINTEXT_BYTES);
    const maximumEnvelope = await encryptBackupEnvelope(maximumPlaintext, key);
    await expect(
      decryptBackupEnvelope(maximumEnvelope, key),
    ).resolves.toHaveLength(MAX_BACKUP_PLAINTEXT_BYTES);
  });

  it("rejects a non-disposable or schema-mismatched target before staging", async () => {
    const key = await backupKey();
    const encrypted = await exportBackup(await representativeSnapshot(), key, {
      createdAt: CREATED_AT,
    });

    for (const target of [
      new MemoryRestoreTarget({ disposable: false }),
      new MemoryRestoreTarget({ schemaVersion: 10 }),
    ]) {
      await expect(importBackup(encrypted, key, target)).rejects.toThrow();
      expect(target.stageCalls).toBe(0);
    }
  });
});

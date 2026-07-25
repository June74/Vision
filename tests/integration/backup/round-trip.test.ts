import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  createBackupEncryptionKey,
  decryptBackupEnvelope,
  encryptBackupEnvelope,
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
} from "../../../src/domain/backup/manifest";
import {
  encodeCanonicalBackupArchive,
  BACKUP_TABLE_COLUMNS,
  exportBackup,
  sha256Base64Url,
} from "../../../src/data/backup/export-backup";
import {
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
  readonly description: RestoreTargetDescription;
  snapshot: BackupSnapshotV1;
  stageCalls = 0;
  promoteCalls = 0;
  stagedCountDelta = 0;
  stagedReferencesValid = true;
  failPromotion = false;

  constructor(options?: {
    snapshot?: BackupSnapshotV1;
    disposable?: boolean;
    environment?: string;
    schemaVersion?: number;
    targetId?: string;
  }) {
    this.snapshot =
      options?.snapshot ?? {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        tables: emptyTables(),
      };
    this.description = {
      targetId: options?.targetId ?? "disposable-preview-branch",
      environment: options?.environment ?? "preview",
      disposable: options?.disposable ?? true,
      schemaVersion: options?.schemaVersion ?? BACKUP_SCHEMA_VERSION,
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
    let pending: BackupSnapshotV1 | undefined;
    const transaction: BackupRestoreTransaction = {
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
  });

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
      /promotion failure/i,
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

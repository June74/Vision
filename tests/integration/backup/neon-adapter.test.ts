import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { types } from "@neondatabase/serverless";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBackupEncryptionKey } from "../../../src/crypto/backup-envelope";
import {
  createBackupSnapshotSource,
  createNeonBackupSnapshotSource,
  createPostgresBackupRestoreTarget,
  type BackupReadTransactionPort,
  type PostgresClientPoolPort,
} from "../../../src/data/backup/neon-adapter";
import { exportBackup } from "../../../src/data/backup/export-backup";
import { importBackup } from "../../../src/data/backup/import-backup";
import { BACKUP_SCHEMA_MIGRATION_SHA256 } from "../../../src/domain/backup/schema-contract";
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  type BackupRow,
  type BackupSnapshotV1,
} from "../../../src/domain/backup/manifest";

const MIGRATIONS = [
  "0001_phase_b_foundation.sql",
  "0002_google_auth_sessions.sql",
  "0003_calendar_setup.sql",
  "0004_incremental_event_sync.sql",
  "0005_google_notification_jobs.sql",
  "0006_google_channel_lifecycle.sql",
  "0007_calendar_maintenance_state.sql",
  "0008_google_projection_rebuild.sql",
  "0009_ai_usage_budget.sql",
] as const;
const NOW = "2026-07-25T06:05:00.000Z";
let databases: PGlite[] = [];

function emptySnapshot(): BackupSnapshotV1 {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    tables: Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])),
  } as unknown as BackupSnapshotV1;
}

function auditRow(action = "backup.snapshot"): BackupRow {
  return {
    id: "audit-1",
    owner_id: "owner-1",
    node_id: null,
    actor_type: "system",
    action,
    outcome: "succeeded",
    provider: null,
    error_category: null,
    occurred_at: NOW,
  };
}

async function migratedDatabase(): Promise<PGlite> {
  const database = new PGlite();
  databases.push(database);
  for (const migration of MIGRATIONS) {
    await database.exec(
      await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
    );
  }
  return database;
}

async function installRestoreAttestation(
  database: PGlite,
  targetId = "neon_branch_preview_1",
): Promise<void> {
  await database.exec(
    `create table vision_restore_target_attestation (
       environment text not null,
       target_id text not null,
       disposable boolean not null,
       schema_version integer not null,
       migration_sha256 text not null,
       attestation_revision text not null
     )`,
  );
  await database.query(
    `insert into vision_restore_target_attestation
       (environment, target_id, disposable, schema_version,
        migration_sha256, attestation_revision)
     values ('preview', $1, true, $2, $3, 'revision-from-database')`,
    [targetId, BACKUP_SCHEMA_VERSION, BACKUP_SCHEMA_MIGRATION_SHA256],
  );
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()));
});

describe("concrete PostgreSQL backup adapters", () => {
  it("preserves raw bytea and timestamp text at the production snapshot boundary", () => {
    createNeonBackupSnapshotSource(
      "postgresql://vision_app:synthetic@preview.invalid/vision",
    );
    const timestamp = "2026-07-25 06:05:00.123456+00";
    const ciphertext = "\\x564953494f4e";
    expect(
      types.getTypeParser(types.builtins.TIMESTAMPTZ, "text")(timestamp),
    ).toBe(timestamp);
    expect(types.getTypeParser(types.builtins.BYTEA, "text")(ciphertext)).toBe(
      ciphertext,
    );
  });

  it("requires database-owned disposable-preview identity and schema attestation", async () => {
    const counts = Object.fromEntries(
      BACKUP_TABLES.map((table) => [table, 0]),
    ) as Record<(typeof BACKUP_TABLES)[number], number>;
    const poolWithAttestation = (
      attestation?: Readonly<Record<string, unknown>>,
    ): PostgresClientPoolPort => ({
      async connect() {
        return {
          async query<Row extends Record<string, unknown>>(sql: string) {
            if (/vision_restore_target_attestation/iu.test(sql)) {
              return {
                rows: (attestation ? [attestation] : []) as readonly Row[],
              };
            }
            if (/\bselect\b[\s\S]*\bcount\(\*\)/iu.test(sql)) {
              return { rows: [counts as Row] };
            }
            return { rows: [] };
          },
          release() {},
        };
      },
    });
    const identity = {
      environment: "preview" as const,
      targetId: "neon_branch_preview_1",
      disposable: true as const,
    };

    const missing = createPostgresBackupRestoreTarget(
      poolWithAttestation(),
      identity,
    );
    await expect(
      missing.transaction((transaction) =>
        transaction.lockTargetForRestore(),
      ),
    ).rejects.toThrow(/attestation/i);

    const production = createPostgresBackupRestoreTarget(
      poolWithAttestation({
        environment: "production",
        target_id: identity.targetId,
        disposable: true,
        schema_version: BACKUP_SCHEMA_VERSION,
        migration_sha256: BACKUP_SCHEMA_MIGRATION_SHA256,
        attestation_revision: "revision-1",
      }),
      identity,
    );
    await expect(
      production.transaction((transaction) =>
        transaction.lockTargetForRestore(),
      ),
    ).rejects.toThrow(/attestation/i);

    const wrongSchema = createPostgresBackupRestoreTarget(
      poolWithAttestation({
        environment: "preview",
        target_id: identity.targetId,
        disposable: true,
        schema_version: BACKUP_SCHEMA_VERSION - 1,
        migration_sha256: BACKUP_SCHEMA_MIGRATION_SHA256,
        attestation_revision: "revision-1",
      }),
      identity,
    );
    await expect(
      wrongSchema.transaction((transaction) =>
        transaction.lockTargetForRestore(),
      ),
    ).rejects.toThrow(/attestation/i);

    const valid = createPostgresBackupRestoreTarget(
      poolWithAttestation({
        environment: "preview",
        target_id: identity.targetId,
        disposable: true,
        schema_version: BACKUP_SCHEMA_VERSION,
        migration_sha256: BACKUP_SCHEMA_MIGRATION_SHA256,
        attestation_revision: "revision-from-database",
      }),
      identity,
    );
    await expect(
      valid.transaction((transaction) =>
        transaction.lockTargetForRestore(),
      ),
    ).resolves.toMatchObject({
      environment: "preview",
      targetId: identity.targetId,
      disposable: true,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      revision: "revision-from-database",
    });
  });

  it("requests all 29 authoritative projections in one repeatable-read read-only transaction", async () => {
    const capturedVersion = 1;
    let liveVersion = capturedVersion;
    const reader: BackupReadTransactionPort = {
      readOnlyRepeatableRead: vi.fn(async (queries) => {
        expect(liveVersion).toBe(1);
        const results = queries.map(() => [] as BackupRow[]);
        results[BACKUP_TABLES.indexOf("audit_events")] = [
          auditRow(`captured-v${capturedVersion}`),
        ];
        liveVersion = 2;
        return results;
      }),
    };
    const source = createBackupSnapshotSource(reader);

    const snapshot = await source.readConsistentSnapshot();

    expect(reader.readOnlyRepeatableRead).toHaveBeenCalledOnce();
    const queries = vi.mocked(reader.readOnlyRepeatableRead).mock.calls[0]![0];
    expect(queries).toHaveLength(29);
    expect(queries.every((query) => !/\bselect\s+\*/iu.test(query.sql))).toBe(true);
    expect(queries.map((query) => query.table)).toEqual(BACKUP_TABLES);
    expect(snapshot.tables.audit_events).toEqual([auditRow("captured-v1")]);
    expect(liveVersion).toBe(2);
  });

  it("executes the generated projections against the migration-9 schema without opening ciphertext", async () => {
    const database = await migratedDatabase();
    const ciphertext = "wrapped-VISION-CIPHERTEXT-sentinel";
    await database.query(
      `insert into audit_events
       (id, owner_id, node_id, actor_type, action, outcome, provider, error_category, occurred_at)
       values ('audit-1', 'owner-1', null, 'system', 'backup.snapshot', 'succeeded', null, null, $1)`,
      [NOW],
    );
    await database.query(
      `insert into wrapped_data_keys
       (owner_id, domain, key_version, iv, wrapped_key)
       values ('owner-1', 'personal', 1, 'opaque-iv', $1)`,
      [ciphertext],
    );
    const reader: BackupReadTransactionPort = {
      async readOnlyRepeatableRead(queries) {
        await database.exec(
          "begin transaction isolation level repeatable read read only",
        );
        try {
          const results = [];
          for (const query of queries) {
            results.push((await database.query(query.sql)).rows as BackupRow[]);
          }
          await database.exec("commit");
          return results;
        } catch (error) {
          await database.exec("rollback");
          throw error;
        }
      },
    };

    const snapshot =
      await createBackupSnapshotSource(reader).readConsistentSnapshot();

    expect(snapshot.tables.audit_events).toHaveLength(1);
    expect(snapshot.tables.wrapped_data_keys).toHaveLength(1);
    expect(snapshot.tables.wrapped_data_keys[0]!.wrapped_key).toBe(ciphertext);
  }, 20_000);

  it("stages, inspects, and atomically promotes through the concrete transaction target", async () => {
    const database = await migratedDatabase();
    await installRestoreAttestation(database);
    const sqlLog: string[] = [];
    const pool: PostgresClientPoolPort = {
      async connect() {
        return {
          async query<Row extends Record<string, unknown>>(
            sql: string,
            parameters: readonly unknown[] = [],
          ) {
            sqlLog.push(sql);
            return database.query<Row>(sql, [...parameters]);
          },
          release() {},
        };
      },
    };
    const source = emptySnapshot();
    (source.tables.audit_events as BackupRow[]).push(auditRow());
    const key = createBackupEncryptionKey(
      await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      ),
      7,
    );
    const encrypted = await exportBackup(source, key, { createdAt: NOW });
    const target = createPostgresBackupRestoreTarget(pool, {
      environment: "preview",
      targetId: "neon_branch_preview_1",
      disposable: true,
    });

    await expect(importBackup(encrypted, key, target)).resolves.toMatchObject({
      targetId: "neon_branch_preview_1",
      replacedExisting: false,
    });
    expect(
      (await database.query("select action from audit_events")).rows,
    ).toEqual([{ action: "backup.snapshot" }]);
    const rendered = sqlLog.join("\n").toLowerCase();
    expect(rendered).toContain("begin isolation level serializable");
    expect(rendered).toContain("lock table");
    expect(rendered).toContain("create temp table");
    expect(rendered).toContain("commit");
  }, 20_000);

  it("revalidates staged cross-table references before concrete promotion", async () => {
    const database = await migratedDatabase();
    await installRestoreAttestation(database);
    const pool: PostgresClientPoolPort = {
      async connect() {
        return {
          async query<Row extends Record<string, unknown>>(
            sql: string,
            parameters: readonly unknown[] = [],
          ) {
            return database.query<Row>(sql, [...parameters]);
          },
          release() {},
        };
      },
    };
    const snapshot = emptySnapshot();
    (snapshot.tables.node_category_assignments as BackupRow[]).push({
      node_id: "missing-node",
      owner_id: "owner-1",
      domain: "personal",
      domain_state: "confirmed",
      provenance: "user",
      assigned_at: NOW,
      version: 1,
    });
    const target = createPostgresBackupRestoreTarget(pool, {
      environment: "preview",
      targetId: "neon_branch_preview_1",
      disposable: true,
    });

    await target.transaction(async (transaction) => {
      await transaction.lockTargetForRestore();
      const stage = await transaction.stage(snapshot);
      await expect(transaction.inspectStage(stage)).resolves.toMatchObject({
        referencesValid: false,
      });
    });
  }, 20_000);
});

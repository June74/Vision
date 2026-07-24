import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let database: PGlite;

beforeEach(async () => {
  database = new PGlite();
  for (const migration of [
    "0001_phase_b_foundation.sql",
    "0002_google_auth_sessions.sql",
    "0003_calendar_setup.sql",
  ]) {
    await database.exec(
      await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
    );
  }
});

async function applyIncrementalSyncMigration(): Promise<void> {
  await database.exec(
    await readFile(
      resolve(process.cwd(), "migrations", "0004_incremental_event_sync.sql"),
      "utf8",
    ),
  );
}

afterEach(async () => {
  await database.close();
});

describe("incremental synchronization migration", () => {
  it("supports an empty CAS checkpoint without permitting a plaintext token", async () => {
    await applyIncrementalSyncMigration();
    await database.query(
      `insert into sync_checkpoints (
         id, owner_id, provider, provider_calendar_id, version, status, committed_at, updated_at
       ) values ($1, $2, 'google-calendar', $3, 0, 'pending', $4, $4)`,
      ["checkpoint-1", "owner-1", "calendar-1", "2026-07-24T15:00:00Z"],
    );

    const columns = await database.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `select column_name, data_type, is_nullable
       from information_schema.columns
       where table_name = 'sync_checkpoints'
         and column_name in ('sync_token_envelope', 'key_version', 'version', 'status')
       order by column_name`,
    );
    expect(columns.rows).toEqual([
      { column_name: "key_version", data_type: "integer", is_nullable: "YES" },
      { column_name: "status", data_type: "text", is_nullable: "NO" },
      { column_name: "sync_token_envelope", data_type: "bytea", is_nullable: "YES" },
      { column_name: "version", data_type: "integer", is_nullable: "NO" },
    ]);
    await expect(
      database.query(
        `update sync_checkpoints
         set version = 1, sync_token_envelope = null, key_version = null
         where id = 'checkpoint-1'`,
      ),
    ).rejects.toThrow();
  });

  it("stores synchronized provider payloads only as ciphertext and safe run metrics separately", async () => {
    await applyIncrementalSyncMigration();
    const tables = await database.query<{ tablename: string }>(
      `select tablename from pg_tables
       where schemaname = 'public'
         and tablename in ('event_sync_payloads', 'sync_runs')
       order by tablename`,
    );
    expect(tables.rows.map(({ tablename }) => tablename)).toEqual([
      "event_sync_payloads",
      "sync_runs",
    ]);

    const payloadColumns = await database.query<{
      column_name: string;
      data_type: string;
    }>(
      `select column_name, data_type
       from information_schema.columns
       where table_name = 'event_sync_payloads'
       order by column_name`,
    );
    expect(payloadColumns.rows).toEqual([
      { column_name: "node_id", data_type: "text" },
      { column_name: "owner_id", data_type: "text" },
      { column_name: "protected_key_version", data_type: "integer" },
      { column_name: "protected_payload_envelope", data_type: "bytea" },
    ]);
  });

  it("backfills an existing encrypted checkpoint to version one without changing its ciphertext", async () => {
    await database.query(
      `insert into sync_checkpoints (
         id, owner_id, provider, provider_calendar_id,
         sync_token_envelope, key_version, committed_at
       ) values ($1, $2, 'google-calendar', $3, $4, '7', $5)`,
      [
        "existing-checkpoint",
        "owner-1",
        "calendar-1",
        new Uint8Array([1, 2, 3, 4]),
        "2026-07-24T14:00:00Z",
      ],
    );

    await applyIncrementalSyncMigration();

    const row = await database.query<{
      sync_token_envelope: Uint8Array;
      key_version: number;
      version: number;
      status: string;
      committed_at: Date;
      updated_at: Date;
    }>(
      `select sync_token_envelope, key_version, version, status,
              committed_at, updated_at
       from sync_checkpoints`,
    );
    expect(row.rows[0]).toMatchObject({
      sync_token_envelope: new Uint8Array([1, 2, 3, 4]),
      key_version: 7,
      version: 1,
      status: "connected",
    });
    expect(row.rows[0]!.updated_at).toEqual(row.rows[0]!.committed_at);
  });
});

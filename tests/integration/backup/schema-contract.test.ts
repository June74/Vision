import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  BACKUP_SCHEMA_CONTRACT,
  BACKUP_SCHEMA_MIGRATION_SHA256,
  validateBackupRow,
  validateBackupTableIdentities,
} from "../../../src/domain/backup/schema-contract";
import {
  BACKUP_TABLES,
  type BackupRow,
  type BackupTableName,
  type BackupValue,
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

describe("migration-9 backup schema contract", () => {
  it("is review-pinned to the exact numbered migrations", async () => {
    const source = (
      await Promise.all(
        MIGRATIONS.map((migration) =>
          readFile(resolve(process.cwd(), "migrations", migration)),
        ),
      )
    ).reduce(
      (hash, migration) => hash.update(migration),
      createHash("sha256"),
    );

    expect(source.digest("hex")).toBe(BACKUP_SCHEMA_MIGRATION_SHA256);
  });

  it("matches PostgreSQL column types, nullability, primary keys, unique indexes, and references", async () => {
    const database = new PGlite();
    try {
      for (const migration of MIGRATIONS) {
        await database.exec(
          await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
        );
      }

      const columns = await database.query<{
        table_name: BackupTableName;
        column_name: string;
        udt_name: "text" | "int2" | "int4" | "bool" | "timestamptz" | "bytea" | "jsonb";
        is_nullable: "YES" | "NO";
      }>(
        `select table_name, column_name, udt_name, is_nullable
         from information_schema.columns
         where table_schema = 'public'
         order by table_name, ordinal_position`,
      );
      const primaryKeys = await database.query<{
        table_name: BackupTableName;
        columns: string[];
      }>(
        `select c.conrelid::regclass::text as table_name,
                array(
                  select a.attname
                  from unnest(c.conkey) with ordinality as key(attnum, position)
                  join pg_attribute a
                    on a.attrelid = c.conrelid and a.attnum = key.attnum
                  order by key.position
                ) as columns
         from pg_constraint c
         join pg_namespace n on n.oid = c.connamespace
         where n.nspname = 'public' and c.contype = 'p'
         order by table_name`,
      );
      const uniqueIndexes = await database.query<{
        tablename: BackupTableName;
        indexname: string;
      }>(
        `select tablename, indexname
         from pg_indexes
         where schemaname = 'public'
           and indexdef like '%UNIQUE%'
           and indexname not like '%_pkey'
         order by tablename, indexname`,
      );
      const references = await database.query<{
        table_name: BackupTableName;
        definition: string;
      }>(
        `select c.conrelid::regclass::text as table_name,
                pg_get_constraintdef(c.oid) as definition
         from pg_constraint c
         join pg_namespace n on n.oid = c.connamespace
         where n.nspname = 'public' and c.contype = 'f'
         order by table_name, definition`,
      );

      const typeNames = {
        text: "text",
        int2: "smallint",
        int4: "integer",
        bool: "boolean",
        timestamptz: "timestamptz",
        bytea: "bytea",
        jsonb: "jsonb",
      } as const;
      const actualColumns = Object.fromEntries(
        BACKUP_TABLES.map((table) => [
          table,
          Object.fromEntries(
            columns.rows
              .filter((column) => column.table_name === table)
              .map((column) => [
                column.column_name,
                {
                  kind: typeNames[column.udt_name],
                  nullable: column.is_nullable === "YES",
                },
              ]),
          ),
        ]),
      );
      const contractColumns = Object.fromEntries(
        BACKUP_TABLES.map((table) => [
          table,
          Object.fromEntries(
            Object.entries(BACKUP_SCHEMA_CONTRACT[table].columns).map(
              ([column, definition]) => [
                column,
                { kind: definition.kind, nullable: definition.nullable },
              ],
            ),
          ),
        ]),
      );

      expect(contractColumns).toEqual(actualColumns);
      expect(
        Object.fromEntries(
          primaryKeys.rows.map((primaryKey) => [
            primaryKey.table_name,
            primaryKey.columns,
          ]),
        ),
      ).toEqual(
        Object.fromEntries(
          BACKUP_TABLES.map((table) => [
            table,
            BACKUP_SCHEMA_CONTRACT[table].primaryKey,
          ]),
        ),
      );
      expect(
        uniqueIndexes.rows.map(({ tablename, indexname }) => [
          tablename,
          indexname,
        ]),
      ).toEqual(
        BACKUP_TABLES.flatMap((table) =>
          BACKUP_SCHEMA_CONTRACT[table].uniqueIdentities.map((identity) => [
            table,
            identity.name,
          ]),
        ).sort(([leftTable, leftName], [rightTable, rightName]) =>
          `${leftTable}:${leftName}`.localeCompare(`${rightTable}:${rightName}`),
        ),
      );
      expect(
        references.rows.map(({ table_name, definition }) => [
          table_name,
          definition.replaceAll(" ", "").toLowerCase(),
        ]).sort(([leftTable, leftDefinition], [rightTable, rightDefinition]) =>
          `${leftTable}:${leftDefinition}`.localeCompare(
            `${rightTable}:${rightDefinition}`,
          ),
        ),
      ).toEqual(
        BACKUP_TABLES.flatMap((table) =>
          BACKUP_SCHEMA_CONTRACT[table].references.map((reference) => [
            table,
            `foreignkey(${reference.fromColumns.join(",")})references${reference.toTable}(${reference.toColumns.join(",")})${reference.onDeleteCascade ? "ondeletecascade" : ""}`,
          ]),
        ).sort(([leftTable, leftDefinition], [rightTable, rightDefinition]) =>
          `${leftTable}:${leftDefinition}`.localeCompare(
            `${rightTable}:${rightDefinition}`,
          ),
        ),
      );
    } finally {
      await database.close();
    }
  }, 15_000);

  it("actively rejects a collision for every declared alternate unique identity", () => {
    for (const table of BACKUP_TABLES) {
      for (const identity of BACKUP_SCHEMA_CONTRACT[table].uniqueIdentities) {
        const first: Record<string, unknown> = {};
        const second: Record<string, unknown> = {};
        for (const column of BACKUP_SCHEMA_CONTRACT[table].primaryKey) {
          const kind = BACKUP_SCHEMA_CONTRACT[table].columns[column]!.kind;
          first[column] = kind === "integer" || kind === "smallint" ? 1 : "first";
          second[column] = kind === "integer" || kind === "smallint" ? 2 : "second";
        }
        for (const column of identity.columns) {
          const kind = BACKUP_SCHEMA_CONTRACT[table].columns[column]!.kind;
          first[column] = kind === "integer" || kind === "smallint" ? 7 : "collision";
          second[column] = first[column];
        }
        for (const condition of identity.where ?? []) {
          const value = condition.equals ?? condition.oneOf?.[0];
          first[condition.column] = value;
          second[condition.column] = value;
        }

        expect(() =>
          validateBackupTableIdentities(
            table,
            [first, second] as unknown as readonly BackupRow[],
          ),
        ).toThrow(/identity|duplicated/i);
      }
    }
  });

  it("matches PostgreSQL value admission while rejecting normalized alternate forms", async () => {
    const database = new PGlite();
    const timestampRow = (occurredAt: BackupValue): BackupRow => ({
      id: "audit-1",
      owner_id: "owner-1",
      node_id: null,
      actor_type: "system",
      action: "value-probe",
      outcome: "success",
      provider: null,
      error_category: null,
      occurred_at: occurredAt,
    });
    const textRow = (action: BackupValue): BackupRow => ({
      ...timestampRow("2026-07-25T18:00:00Z"),
      action,
    });
    const jsonRow = (planningJson: BackupValue): BackupRow => ({
      generation_id: "generation-1",
      identity_hash: "A".repeat(43),
      ordinal: 0,
      planning_json: planningJson,
      protected_payload_envelope: null,
      protected_key_version: null,
    });
    const integerRow = (reservedCents: BackupValue): BackupRow => ({
      owner_id: "owner-1",
      budget_month: "2026-07",
      settled_cents: 0,
      reserved_cents: reservedCents,
      created_at: "2026-07-25T18:00:00Z",
      updated_at: "2026-07-25T18:00:00Z",
    });

    try {
      await database.exec(`
        create table backup_value_probe (
          text_value text,
          json_value jsonb,
          integer_value integer,
          timestamp_value timestamptz
        )
      `);

      for (const value of [
        "0001-01-01T00:00:00.000Z",
        "9999-12-31T23:59:59.999999Z",
        "2024-02-29T23:59:59Z",
        "2026-01-01T00:00:00+15:59",
        "2026-01-01 00:00:00-15:59",
      ]) {
        await expect(
          database.query(
            "insert into backup_value_probe (timestamp_value) values ($1)",
            [value],
          ),
          value,
        ).resolves.toBeDefined();
        expect(
          () => validateBackupRow("audit_events", timestampRow(value)),
          value,
        ).not.toThrow();
      }
      for (const value of [
        new Date("0001-01-01T00:00:00.000Z"),
        new Date("9999-12-31T23:59:59.999Z"),
      ]) {
        expect(
          () => validateBackupRow("audit_events", timestampRow(value)),
          value.toISOString(),
        ).not.toThrow();
      }
      for (const value of [
        new Date("0000-01-01T00:00:00.000Z"),
        new Date("+010000-01-01T00:00:00.000Z"),
      ]) {
        expect(
          () => validateBackupRow("audit_events", timestampRow(value)),
          value.toISOString(),
        ).toThrow(/timestamptz/i);
      }

      for (const value of [
        "0000-01-01T00:00:00Z",
        "2025-02-29T00:00:00Z",
        "2026-02-30T00:00:00Z",
        "2026-04-31T00:00:00Z",
        "2026-01-01T23:60:00Z",
        "2026-01-01T00:00:00+16:00",
        "2026-01-01T00:00:00+12:60",
      ]) {
        await expect(
          database.query(
            "insert into backup_value_probe (timestamp_value) values ($1)",
            [value],
          ),
          value,
        ).rejects.toThrow();
        expect(
          () => validateBackupRow("audit_events", timestampRow(value)),
          value,
        ).toThrow(/timestamptz/i);
      }

      for (const value of [
        "2026-01-01T24:00:00Z",
        "2026-01-01T23:59:60Z",
      ]) {
        await expect(
          database.query(
            "insert into backup_value_probe (timestamp_value) values ($1)",
            [value],
          ),
          value,
        ).resolves.toBeDefined();
        expect(
          () => validateBackupRow("audit_events", timestampRow(value)),
          value,
        ).toThrow(/timestamptz/i);
      }

      for (const value of ["Vision", "café", "仕事", "calendar \u{1F4C5}"]) {
        await expect(
          database.query(
            "insert into backup_value_probe (text_value) values ($1)",
            [value],
          ),
          value,
        ).resolves.toBeDefined();
        expect(
          () => validateBackupRow("audit_events", textRow(value)),
          value,
        ).not.toThrow();
      }
      await expect(
        database.query(
          "insert into backup_value_probe (text_value) values ($1)",
          ["bad\u0000text"],
        ),
      ).rejects.toThrow();
      expect(() =>
        validateBackupRow("audit_events", textRow("bad\u0000text")),
      ).toThrow(/text/i);

      for (const value of [
        "scalar",
        { nested: { unicode: "école" } },
        [null, true, 42, "仕事"],
      ]) {
        await expect(
          database.query(
            "insert into backup_value_probe (json_value) values ($1::jsonb)",
            [JSON.stringify(value)],
          ),
        ).resolves.toBeDefined();
        expect(
          () => validateBackupRow("projection_rebuild_changes", jsonRow(value)),
        ).not.toThrow();
      }
      const invalidJsonValues: readonly BackupValue[] = [
        { nested: "bad\u0000value" },
        { ["bad\u0000key"]: "value" },
      ];
      for (const value of invalidJsonValues) {
        await expect(
          database.query(
            "insert into backup_value_probe (json_value) values ($1::jsonb)",
            [JSON.stringify(value)],
          ),
        ).rejects.toThrow();
        expect(() =>
          validateBackupRow("projection_rebuild_changes", jsonRow(value)),
        ).toThrow(/jsonb/i);
      }

      for (const value of ["0", "1", "2147483647"]) {
        await expect(
          database.query(
            "insert into backup_value_probe (integer_value) values ($1)",
            [value],
          ),
          value,
        ).resolves.toBeDefined();
        expect(
          () => validateBackupRow("ai_usage_months", integerRow(value)),
          value,
        ).not.toThrow();
      }
      await expect(
        database.query(
          "insert into backup_value_probe (integer_value) values ($1), ($2)",
          ["-2147483648", "2147483647"],
        ),
      ).resolves.toBeDefined();
      for (const value of ["-0", "01", "+1", " 1", "1 ", "000", "-00"]) {
        await expect(
          database.query(
            "insert into backup_value_probe (integer_value) values ($1)",
            [value],
          ),
          value,
        ).resolves.toBeDefined();
        expect(
          () => validateBackupRow("ai_usage_months", integerRow(value)),
          value,
        ).toThrow(/integer/i);
      }
      for (const value of [
        "1.0",
        "1e0",
        "-2147483649",
        "2147483648",
        "999999999999999999999999999999999999999",
      ]) {
        await expect(
          database.query(
            "insert into backup_value_probe (integer_value) values ($1)",
            [value],
          ),
          value,
        ).rejects.toThrow();
        expect(
          () => validateBackupRow("ai_usage_months", integerRow(value)),
          value,
        ).toThrow(/integer/i);
      }
    } finally {
      await database.close();
    }
  }, 15_000);

  it("matches PostgreSQL microsecond ordering and lossless Unicode", async () => {
    const database = new PGlite();
    const usageMonthRow = (
      createdAt: BackupValue,
      updatedAt: BackupValue,
    ): BackupRow => ({
      owner_id: "owner-1",
      budget_month: "2026-07",
      settled_cents: 0,
      reserved_cents: 0,
      created_at: createdAt,
      updated_at: updatedAt,
    });
    const deletionRow = (
      deletedAt: BackupValue,
      purgeAfter: BackupValue,
    ): BackupRow => ({
      node_id: "node-1",
      owner_id: "owner-1",
      deleted_at: deletedAt,
      purge_after: purgeAfter,
      recovery_envelope: new Uint8Array([1]),
    });
    const textRow = (action: string): BackupRow => ({
      id: "audit-1",
      owner_id: "owner-1",
      node_id: null,
      actor_type: "system",
      action,
      outcome: "success",
      provider: null,
      error_category: null,
      occurred_at: "2026-07-25T18:00:00Z",
    });
    const jsonRow = (planningJson: BackupValue): BackupRow => ({
      generation_id: "generation-1",
      identity_hash: "A".repeat(43),
      ordinal: 0,
      planning_json: planningJson,
      protected_payload_envelope: null,
      protected_key_version: null,
    });

    try {
      await database.exec(`
        create table backup_timestamp_at_least_probe (
          created_at timestamptz not null,
          updated_at timestamptz not null,
          check (updated_at >= created_at)
        );
        create table backup_timestamp_after_probe (
          deleted_at timestamptz not null,
          purge_after timestamptz not null,
          check (purge_after > deleted_at)
        );
        create table backup_unicode_probe (
          text_value text,
          json_value jsonb
        )
      `);

      const reverseWithinMillisecond = [
        "2026-07-25T18:00:00.000999Z",
        "2026-07-25T18:00:00.000001Z",
      ] as const;
      await expect(
        database.query(
          `insert into backup_timestamp_at_least_probe
             (created_at, updated_at) values ($1, $2)`,
          [...reverseWithinMillisecond],
        ),
      ).rejects.toThrow();
      expect(() =>
        validateBackupRow(
          "ai_usage_months",
          usageMonthRow(...reverseWithinMillisecond),
        ),
      ).toThrow(/migration check/i);

      const validAtLeastPairs = [
        [
          "2026-07-25T18:00:00.000001Z",
          "2026-07-25T18:00:00.000999Z",
        ],
        [
          "2026-07-25T18:00:00.123456Z",
          "2026-07-25T18:00:00.123456Z",
        ],
        [
          "2026-07-25T18:00:00.654321Z",
          "2026-07-25T19:00:00.654321+01:00",
        ],
        [
          "1969-12-31T23:59:59.999999Z",
          "1970-01-01T00:00:00.000001Z",
        ],
      ] as const;
      for (const pair of validAtLeastPairs) {
        await expect(
          database.query(
            `insert into backup_timestamp_at_least_probe
               (created_at, updated_at) values ($1, $2)`,
            [...pair],
          ),
        ).resolves.toBeDefined();
        expect(() =>
          validateBackupRow(
            "ai_usage_months",
            usageMonthRow(pair[0], pair[1]),
          ),
        ).not.toThrow();
      }

      const equalInstant = [
        "2026-07-25T18:00:00.123456Z",
        "2026-07-25T19:00:00.123456+01:00",
      ] as const;
      await expect(
        database.query(
          `insert into backup_timestamp_after_probe
             (deleted_at, purge_after) values ($1, $2)`,
          [...equalInstant],
        ),
      ).rejects.toThrow();
      expect(() =>
        validateBackupRow(
          "recoverable_deletions",
          deletionRow(...equalInstant),
        ),
      ).toThrow(/migration check/i);

      for (const digits of ["1", "12", "123", "1234", "12345", "123456"]) {
        const value = `2026-07-25T18:00:00.${digits}Z`;
        await expect(
          database.query(
            `insert into backup_timestamp_at_least_probe
               (created_at, updated_at) values ($1, $1)`,
            [value],
          ),
          value,
        ).resolves.toBeDefined();
        expect(
          () =>
            validateBackupRow(
              "ai_usage_months",
              usageMonthRow(value, value),
            ),
          value,
        ).not.toThrow();
      }

      const pairedAstral = "Vision \uD83D\uDCC5";
      const pairedJson: BackupValue = {
        "\uD83D\uDCC5-key": ["\uD83C\uDF0E", { nested: "\uD83D\uDE80" }],
      };
      const storedText = await database.query<{ text_value: string }>(
        `insert into backup_unicode_probe (text_value)
         values ($1) returning text_value`,
        [pairedAstral],
      );
      const storedJson = await database.query<{ json_value: BackupValue }>(
        `insert into backup_unicode_probe (json_value)
         values ($1::jsonb) returning json_value`,
        [JSON.stringify(pairedJson)],
      );
      expect(storedText.rows[0]!.text_value).toBe(pairedAstral);
      expect(storedJson.rows[0]!.json_value).toEqual(pairedJson);
      expect(() =>
        validateBackupRow("audit_events", textRow(pairedAstral)),
      ).not.toThrow();
      expect(() =>
        validateBackupRow(
          "projection_rebuild_changes",
          jsonRow(pairedJson),
        ),
      ).not.toThrow();

      for (const surrogate of ["\uD800", "\uDC00"]) {
        const normalizedText = await database.query<{ text_value: string }>(
          `insert into backup_unicode_probe (text_value)
           values ($1) returning text_value`,
          [surrogate],
        );
        expect(normalizedText.rows[0]!.text_value).not.toBe(surrogate);
        expect(() =>
          validateBackupRow("audit_events", textRow(surrogate)),
        ).toThrow(/text/i);

        for (const invalidJson of [
          { nested: surrogate },
          { [surrogate]: "value" },
        ]) {
          await expect(
            database.query(
              `insert into backup_unicode_probe (json_value)
               values ($1::jsonb)`,
              [JSON.stringify(invalidJson)],
            ),
          ).rejects.toThrow();
          expect(() =>
            validateBackupRow(
              "projection_rebuild_changes",
              jsonRow(invalidJson),
            ),
          ).toThrow(/jsonb/i);
        }
      }
    } finally {
      await database.close();
    }
  }, 15_000);
});

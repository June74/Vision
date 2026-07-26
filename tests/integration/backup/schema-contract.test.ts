import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import {
  BACKUP_SCHEMA_CONTRACT,
  BACKUP_SCHEMA_MIGRATION_SHA256,
  validateBackupTableIdentities,
} from "../../../src/domain/backup/schema-contract";
import {
  BACKUP_TABLES,
  type BackupRow,
  type BackupTableName,
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
});

import { strict as assert } from "node:assert";
import { getTableName } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import type { PgTable } from "drizzle-orm/pg-core";

export type ColumnManifest = [name: string, sqlType: string, notNull: boolean, defaultSql?: string];
export type KeyManifest = string[];
export type ForeignKeyManifest = [name: string, localColumns: string[], targetTable: string, targetColumns: string[]];
export type CheckManifest = [name: string, expression: string];

export interface TableManifest {
  columns: ColumnManifest[];
  primaryKeys: KeyManifest[];
  uniqueKeys: KeyManifest[];
  foreignKeys: ForeignKeyManifest[];
  checks: CheckManifest[];
}

export type SchemaTablesManifest = Record<string, TableManifest>;

interface DrizzleSnapshotColumn {
  name: string;
  type: string;
  primaryKey: boolean;
  notNull: boolean;
  default?: string;
}

interface DrizzleSnapshotTable {
  name: string;
  columns: Record<string, DrizzleSnapshotColumn>;
  foreignKeys: Record<string, {
    name: string;
    tableTo: string;
    columnsFrom: string[];
    columnsTo: string[];
  }>;
  compositePrimaryKeys: Record<string, { columns: string[] }>;
  uniqueConstraints: Record<string, { columns: string[] }>;
  checkConstraints: Record<string, { name: string; value: string }>;
}

interface DrizzleSnapshot {
  tables: Record<string, DrizzleSnapshotTable>;
}

const dialect = new PgDialect();

function bySerializedValue(left: unknown, right: unknown): number {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

function normalizeSqlType(sqlType: string): string {
  const normalized = sqlType.trim().toLowerCase();
  return normalized === "timestamp with time zone" ? "timestamptz" : normalized;
}

function normalizeSqlExpression(expression: string): string {
  return expression
    .replace(/"[^"]+"\./g, "")
    .replace(/"([^"]+)"/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function renderColumnDefault(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return `'${value.replaceAll("'", "''")}'`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return normalizeSqlExpression(dialect.sqlToQuery(value as SQL).sql);
}

function asColumnManifest(
  name: string,
  sqlType: string,
  notNull: boolean,
  defaultSql?: string,
): ColumnManifest {
  return defaultSql === undefined
    ? [name, normalizeSqlType(sqlType), notNull]
    : [name, normalizeSqlType(sqlType), notNull, defaultSql];
}

/**
 * Reads the live Drizzle declarations without consulting the expected fixture or generated snapshot.
 * SQL expressions are rendered through PostgreSQL's Drizzle dialect before stable normalization.
 */
export function extractDrizzleTablesManifest(tables: PgTable[]): SchemaTablesManifest {
  return Object.fromEntries(
    tables
      .map((table): [string, TableManifest] => {
        const config = getTableConfig(table);
        const inlinePrimaryKeys: KeyManifest[] = config.columns
          .filter((column) => column.primary)
          .map((column) => [column.name]);
        const inlineUniqueKeys: KeyManifest[] = config.columns
          .filter((column) => column.isUnique)
          .map((column) => [column.name]);

        return [
          config.name,
          {
            columns: config.columns.map((column) =>
              asColumnManifest(
                column.name,
                column.getSQLType(),
                column.notNull,
                column.hasDefault ? renderColumnDefault(column.default) : undefined,
              ),
            ),
            primaryKeys: [
              ...inlinePrimaryKeys,
              ...config.primaryKeys.map((key): KeyManifest => key.columns.map((column) => column.name)),
            ].sort(bySerializedValue),
            uniqueKeys: [
              ...inlineUniqueKeys,
              ...config.uniqueConstraints.map((key): KeyManifest => key.columns.map((column) => column.name)),
            ].sort(bySerializedValue),
            foreignKeys: config.foreignKeys
              .map((foreignKey): ForeignKeyManifest => {
                const reference = foreignKey.reference();
                return [
                  foreignKey.getName(),
                  reference.columns.map((column) => column.name),
                  getTableName(reference.foreignTable),
                  reference.foreignColumns.map((column) => column.name),
                ];
              })
              .sort(bySerializedValue),
            checks: config.checks
              .map((check): CheckManifest => [
                check.name,
                normalizeSqlExpression(dialect.sqlToQuery(check.value).sql),
              ])
              .sort(bySerializedValue),
          },
        ];
      })
      .sort(([leftName], [rightName]) => leftName.localeCompare(rightName)),
  );
}

/**
 * Converts Drizzle Kit's retained JSON snapshot into the same independently reviewed shape.
 * Snapshot-specific bookkeeping and implicit constraint names are intentionally excluded.
 */
export function extractSnapshotTablesManifest(snapshot: unknown): SchemaTablesManifest {
  const tables = (snapshot as DrizzleSnapshot).tables;

  return Object.fromEntries(
    Object.values(tables)
      .map((table): [string, TableManifest] => {
        const columns = Object.values(table.columns);
        return [
          table.name,
          {
            columns: columns.map((column) =>
              asColumnManifest(
                column.name,
                column.type,
                column.notNull,
                column.default === undefined ? undefined : normalizeSqlExpression(column.default),
              ),
            ),
            primaryKeys: [
              ...columns
                .filter((column) => column.primaryKey)
                .map((column): KeyManifest => [column.name]),
              ...Object.values(table.compositePrimaryKeys)
                .map((key): KeyManifest => [...key.columns]),
            ].sort(bySerializedValue),
            uniqueKeys: Object.values(table.uniqueConstraints)
              .map((key): KeyManifest => [...key.columns])
              .sort(bySerializedValue),
            foreignKeys: Object.values(table.foreignKeys)
              .map((foreignKey): ForeignKeyManifest => [
                foreignKey.name,
                [...foreignKey.columnsFrom],
                foreignKey.tableTo,
                [...foreignKey.columnsTo],
              ])
              .sort(bySerializedValue),
            checks: Object.values(table.checkConstraints)
              .map((check): CheckManifest => [
                check.name,
                normalizeSqlExpression(check.value),
              ])
              .sort(bySerializedValue),
          },
        ];
      })
      .sort(([leftName], [rightName]) => leftName.localeCompare(rightName)),
  );
}

/** Throws a field-level diff whenever normalized schema metadata differs from the reviewed manifest. */
export function assertSchemaMatchesManifest(
  actual: SchemaTablesManifest,
  expected: SchemaTablesManifest,
): void {
  assert.deepStrictEqual(actual, expected);
}

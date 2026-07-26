import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  aiUsageLedger,
  aiUsageMonths,
  aiUsageReservations,
} from "../../../src/data/schema";
import { phaseBAiUsagePrivilegeManifest } from "./phase-b-schema-manifest";

function assertAiUsagePrivileges(migration: string): void {
  const uncommented = stripSqlComments(migration);
  const normalized = uncommented.toLowerCase().replace(/\s+/gu, " ");
  const tables = Object.keys(phaseBAiUsagePrivilegeManifest);

  expect(normalized).toContain(
    `revoke all on ${tables.join(", ")} from public`,
  );

  const actual = Object.fromEntries(
    tables.map((table) => [
      table,
      { vision_app: new Set<string>(), public: new Set<string>() },
    ]),
  ) as Record<
    string,
    { vision_app: Set<string>; public: Set<string> }
  >;

  for (const statement of extractGrantStatements(uncommented)) {
    const grant = parseGrantStatement(statement, tables);
    if (grant === undefined) continue;
    if (grant.grantOption) {
      throw new Error("AI table grants cannot include grant option.");
    }
    for (const role of grant.roles) {
      if (role !== "vision_app" && role !== "public") {
        throw new Error("AI table grant has an unexpected grantee.");
      }
      for (const table of grant.tables) {
        for (const privilege of grant.privileges) {
          actual[table]![role].add(privilege);
        }
      }
    }
  }

  expect(
    Object.fromEntries(
      tables.map((table) => [
        table,
        {
          vision_app: [...actual[table]!.vision_app].sort(),
          public: [...actual[table]!.public].sort(),
        },
      ]),
    ),
  ).toEqual(
    Object.fromEntries(
      Object.entries(phaseBAiUsagePrivilegeManifest).map(
        ([table, roles]) => [
          table,
          {
            vision_app: [...roles.vision_app].sort(),
            public: [...roles.public].sort(),
          },
        ],
      ),
    ),
  );
}

type ParsedGrant = {
  readonly privileges: readonly string[];
  readonly tables: readonly string[];
  readonly roles: readonly string[];
  readonly grantOption: boolean;
};

const TABLE_PRIVILEGES = new Set([
  "select",
  "insert",
  "update",
  "delete",
  "truncate",
  "references",
  "trigger",
  "maintain",
]);
const COLUMN_PRIVILEGES = new Set([
  "select",
  "insert",
  "update",
  "references",
]);

/** Extracts GRANT statements from the bounded migration language, including DO-block bodies. */
function extractGrantStatements(sql: string): string[] {
  const statements: string[] = [];
  const grantPattern = /\bgrant\b/giu;
  let match: RegExpExecArray | null;
  while ((match = grantPattern.exec(sql)) !== null) {
    const end = findSqlStatementEnd(sql, match.index);
    const statement = sql.slice(match.index, end);
    statements.push(statement);
    grantPattern.lastIndex = end;
  }
  return statements;
}

/** Finds the next semicolon outside a quoted PostgreSQL identifier. */
function findSqlStatementEnd(sql: string, start: number): number {
  let quoted = false;
  for (let index = start; index < sql.length; index += 1) {
    const character = sql[index]!;
    if (character === '"') {
      if (quoted && sql[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ";" && !quoted) {
      return index + 1;
    }
  }
  return sql.length;
}

/** Parses only direct table GRANT forms needed by the Phase B privilege contract. */
function parseGrantStatement(
  statement: string,
  relevantTables: readonly string[],
): ParsedGrant | undefined {
  const topLevel =
    /^grant\s+([\s\S]+?)\s+on\s+([\s\S]+?)\s+to\s+([\s\S]+?)\s*;?\s*$/iu.exec(
      statement,
    );
  if (topLevel === null) {
    if (mentionsRelevantTable(statement, relevantTables)) {
      throw new Error("Unparsed GRANT touches an AI accounting table.");
    }
    return undefined;
  }

  let roleClause = topLevel[3]!.trim();
  const grantOption = /\s+with\s+grant\s+option\s*$/iu.test(roleClause);
  roleClause = roleClause.replace(
    /\s+with\s+grant\s+option\s*$/iu,
    "",
  );

  let targetClause = topLevel[2]!.trim();
  targetClause = targetClause.replace(/^table\s+/iu, "");
  const allTablesMatch =
    /^all\s+tables\s+in\s+schema\s+([\s\S]+)$/iu.exec(targetClause);
  if (allTablesMatch !== null) {
    const schemas = splitSqlList(allTablesMatch[1]!).map(decodeIdentifier);
    if (schemas.some((schema) => schema === "public")) {
      throw new Error("Schema-wide GRANT touches AI accounting tables.");
    }
    return undefined;
  }

  const tables: string[] = [];
  for (const target of splitSqlList(targetClause)) {
    const parsedTarget = parseQualifiedIdentifier(target);
    if (parsedTarget === undefined) {
      if (mentionsRelevantTable(target, relevantTables)) {
        throw new Error("Unparsed GRANT target touches an AI accounting table.");
      }
      continue;
    }
    const [schema, table] =
      parsedTarget.length === 1
        ? [undefined, parsedTarget[0]!]
        : [parsedTarget[0], parsedTarget[1]!];
    if (
      relevantTables.includes(table) &&
      (schema === undefined || schema === "public")
    ) {
      tables.push(table);
    }
  }
  if (tables.length === 0) return undefined;

  const privileges = splitSqlList(topLevel[1]!).flatMap(parsePrivilege);
  const roles = splitSqlList(roleClause).map(parseGrantee);
  return {
    privileges,
    tables: [...new Set(tables)],
    roles: [...new Set(roles)],
    grantOption,
  };
}

/** Normalizes one table or column privilege without accepting arbitrary SQL. */
function parsePrivilege(value: string): string[] {
  const normalized = value.trim();
  if (/^all(?:\s+privileges)?$/iu.test(normalized)) {
    return [...TABLE_PRIVILEGES];
  }
  const parsed = /^([a-z]+)(?:\s*\(([\s\S]+)\))?$/iu.exec(normalized);
  if (parsed === null) {
    throw new Error("AI table GRANT privilege is unsupported.");
  }
  const privilege = parsed[1]!.toLowerCase();
  const columnClause = parsed[2];
  if (columnClause === undefined) {
    if (!TABLE_PRIVILEGES.has(privilege)) {
      throw new Error("AI table GRANT privilege is unsupported.");
    }
    return [privilege];
  }
  if (!COLUMN_PRIVILEGES.has(privilege)) {
    throw new Error("AI column GRANT privilege is unsupported.");
  }
  const columns = splitSqlList(columnClause).map(decodeIdentifier);
  if (columns.some((column) => column === undefined)) {
    throw new Error("AI column GRANT identifier is unsupported.");
  }
  return [`${privilege}(${columns.join(",")})`];
}

/** Normalizes one grantee and leaves unexpected roles visible to the assertion. */
function parseGrantee(value: string): string {
  const normalized = value.trim().replace(/^group\s+/iu, "");
  if (/^public$/iu.test(normalized)) return "public";
  const role = decodeIdentifier(normalized);
  if (role === undefined) {
    throw new Error("AI table GRANT grantee is unsupported.");
  }
  return role;
}

/** Parses an unqualified or public-schema-qualified PostgreSQL identifier. */
function parseQualifiedIdentifier(value: string): string[] | undefined {
  const parts = splitSqlDots(value).map(decodeIdentifier);
  return (
    (parts.length === 1 || parts.length === 2) &&
      parts.every((part) => part !== undefined)
      ? (parts as string[])
      : undefined
  );
}

/** Decodes one ordinary or double-quoted PostgreSQL identifier. */
function decodeIdentifier(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^"(?:[^"]|"")*"$/u.test(trimmed)) {
    return trimmed.slice(1, -1).replaceAll('""', '"');
  }
  return /^[a-z_][a-z0-9_$]*$/iu.test(trimmed)
    ? trimmed.toLowerCase()
    : undefined;
}

/** Splits a comma list while preserving quoted identifiers and column lists. */
function splitSqlList(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === "(") {
      depth += 1;
    } else if (!quoted && character === ")") {
      depth -= 1;
      if (depth < 0) throw new Error("AI table GRANT list is invalid.");
    } else if (!quoted && depth === 0 && character === ",") {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  if (
    quoted ||
    depth !== 0 ||
    parts.some((part) => part.length === 0)
  ) {
    throw new Error("AI table GRANT list is invalid.");
  }
  return parts;
}

/** Splits schema qualification while preserving quoted dots. */
function splitSqlDots(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === ".") {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return quoted ? [] : parts;
}

/** Removes line and block comments before locating executable GRANT statements. */
function stripSqlComments(value: string): string {
  return value
    .replace(/--[^\r\n]*/gu, " ")
    .replace(/\/\*[\s\S]*?\*\//gu, " ");
}

/** Conservatively identifies an AI table name in an otherwise unsupported GRANT. */
function mentionsRelevantTable(
  value: string,
  relevantTables: readonly string[],
): boolean {
  const lower = value.toLowerCase();
  return relevantTables.some((table) => lower.includes(table));
}

describe("AI budget database contract", () => {
  it("keeps all three reviewed Drizzle tables in the migration shape", () => {
    const months = getTableConfig(aiUsageMonths);
    const reservations = getTableConfig(aiUsageReservations);
    const ledger = getTableConfig(aiUsageLedger);

    expect(months.name).toBe("ai_usage_months");
    expect(months.primaryKeys[0]?.columns.map((column) => column.name)).toEqual([
      "owner_id",
      "budget_month",
    ]);
    expect(reservations.name).toBe("ai_usage_reservations");
    expect(
      reservations.indexes.find(
        (index) => index.config.name === "ai_usage_reservations_one_in_flight_uq",
      )?.config,
    ).toMatchObject({ unique: true, where: expect.anything() });
    expect(
      reservations.uniqueConstraints.map((constraint) =>
        constraint.columns.map((column) => column.name),
      ),
    ).toContainEqual(["owner_id", "budget_month", "idempotency_key"]);
    expect(ledger.name).toBe("ai_usage_ledger");
    expect(ledger.foreignKeys[0]?.reference().foreignTable).toBe(
      aiUsageReservations,
    );
    expect(ledger.columns.map((column) => column.name)).not.toContain("prompt");
    expect(ledger.columns.map((column) => column.name)).not.toContain("response");
  });

  it("keeps the reviewed migration least-privileged and content-free", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0009_ai_usage_budget.sql"),
      "utf8",
    ).toLowerCase();

    expect(migration).toContain("create table ai_usage_months");
    expect(migration).toContain("create table ai_usage_reservations");
    expect(migration).toContain("create table ai_usage_ledger");
    expect(migration).toContain("ai_usage_reservations_one_in_flight_uq");
    expect(migration).toContain("where status in ('reserved', 'dispatched')");
    expect(migration).toContain(
      "unique (owner_id, budget_month, idempotency_key)",
    );
    assertAiUsagePrivileges(migration);
    expect(migration).not.toContain("prompt");
    expect(migration).not.toContain("response");
    expect(migration).not.toContain("json");
  });

  it("rejects a weakened append-only ledger privilege", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0009_ai_usage_budget.sql"),
      "utf8",
    ).replace(
      "grant select, insert on ai_usage_ledger to vision_app",
      "grant select, insert, update on ai_usage_ledger to vision_app",
    );

    expect(() => assertAiUsagePrivileges(migration)).toThrow();
  });

  it("rejects a separate later UPDATE grant on the append-only ledger", () => {
    const migration = `${readFileSync(
      resolve(process.cwd(), "migrations/0009_ai_usage_budget.sql"),
      "utf8",
    )}
grant update on ai_usage_ledger to vision_app;
`;

    expect(() => assertAiUsagePrivileges(migration)).toThrow();
  });

  it.each([
    [
      "ALL PRIVILEGES",
      "grant all privileges on ai_usage_ledger to vision_app;",
    ],
    ["ALL", "grant all on ai_usage_ledger to vision_app;"],
    [
      "column UPDATE",
      "grant update (event_type) on ai_usage_ledger to vision_app;",
    ],
    [
      "multi privilege/table/grantee",
      "grant select, update (owner_id) on ai_usage_months, public.ai_usage_ledger to vision_app, public;",
    ],
    [
      "quoted schema/table/column/role",
      'grant update ("event_type") on table "public"."ai_usage_ledger" to "vision_app";',
    ],
    [
      "schema-qualified PUBLIC",
      "grant select on public.ai_usage_ledger to public;",
    ],
    [
      "grant option",
      "grant select on ai_usage_ledger to vision_app with grant option;",
    ],
    [
      "unexpected grantee",
      "grant select on ai_usage_ledger to current_user;",
    ],
    [
      "all public-schema tables",
      "grant select on all tables in schema public to vision_app;",
    ],
  ])("rejects an appended %s grant", (_label, statement) => {
    const migration = `${readFileSync(
      resolve(process.cwd(), "migrations/0009_ai_usage_budget.sql"),
      "utf8",
    )}
${statement}
`;

    expect(() => assertAiUsagePrivileges(migration)).toThrow();
  });
});

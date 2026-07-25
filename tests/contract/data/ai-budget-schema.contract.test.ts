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
  const normalized = migration.toLowerCase().replace(/\s+/gu, " ");
  const tables = Object.keys(phaseBAiUsagePrivilegeManifest);

  expect(normalized).toContain(
    `revoke all on ${tables.join(", ")} from public`,
  );
  for (const [table, privileges] of Object.entries(
    phaseBAiUsagePrivilegeManifest,
  )) {
    expect(normalized).toContain(
      `grant ${privileges.join(", ")} on ${table} to vision_app`,
    );
    const grant = normalized.match(
      new RegExp(`grant ([a-z, ]+) on ${table} to vision_app`, "u"),
    );
    expect(grant?.[1]?.trim()).toBe(privileges.join(", "));
  }
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
});

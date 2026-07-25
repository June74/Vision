import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aiUsageLedger,
  aiUsageMonths,
  aiUsageReservations,
  auditEvents,
  calendarSyncJobs,
  calendarSyncMaintenance,
  edges,
  eventSyncPayloads,
  events,
  nodeAnnotations,
  nodeCategoryAssignments,
  nodes,
  operationLedger,
  projectionRebuildChanges,
  projectionRebuildGenerations,
  recoverableDeletions,
  syncChannels,
  syncCheckpoints,
  syncRuns,
} from "../../../src/data/schema";
import { phaseBSchemaManifest } from "./phase-b-schema-manifest";
import {
  assertSchemaMatchesManifest,
  extractDrizzleTablesManifest,
  extractSnapshotTablesManifest,
} from "./schema-manifest";

const drizzleTables = [
  aiUsageLedger,
  aiUsageMonths,
  aiUsageReservations,
  nodes,
  events,
  eventSyncPayloads,
  nodeAnnotations,
  nodeCategoryAssignments,
  edges,
  auditEvents,
  calendarSyncJobs,
  calendarSyncMaintenance,
  syncCheckpoints,
  syncChannels,
  syncRuns,
  operationLedger,
  projectionRebuildChanges,
  projectionRebuildGenerations,
  recoverableDeletions,
];

describe("Drizzle schema structure", () => {
  it("matches the complete migration-derived manifest for all nineteen tables", () => {
    const actual = extractDrizzleTablesManifest(drizzleTables);
    assertSchemaMatchesManifest(actual, phaseBSchemaManifest);
  });

  it("keeps the retained generated snapshot consistent with the reviewed manifest", () => {
    const snapshot = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "migrations/generated/meta/0007_snapshot.json"),
        "utf8",
      ),
    ) as unknown;
    const actual = extractSnapshotTablesManifest(snapshot);
    const {
      ai_usage_ledger: _ledger,
      ai_usage_months: _months,
      ai_usage_reservations: _reservations,
      ...preBudgetManifest
    } = phaseBSchemaManifest;
    assertSchemaMatchesManifest(actual, preBudgetManifest);
  });

  it("keeps generated Drizzle SQL non-deployable", () => {
    const generatedFiles = readdirSync(
      resolve(process.cwd(), "migrations/generated"),
    );
    expect(generatedFiles.filter((name) => name.endsWith(".sql"))).toEqual([]);
    expect(generatedFiles.some((name) => name.endsWith(".sql.draft"))).toBe(true);
  });

  it("rejects a same-name check whose SQL expression is weakened", () => {
    const weakened = structuredClone(
      extractDrizzleTablesManifest(drizzleTables),
    );
    const check = weakened.edges.checks.find(
      ([name]) => name === "edges_version_positive",
    );
    expect(check).toBeDefined();
    check![1] = "version >= 0";

    expect(() =>
      assertSchemaMatchesManifest(weakened, phaseBSchemaManifest),
    ).toThrow();
  });

  it("rejects a foreign key whose endpoint changes", () => {
    const weakened = structuredClone(
      extractDrizzleTablesManifest(drizzleTables),
    );
    const foreignKey = weakened.events.foreignKeys.find(
      ([name]) => name === "events_node_owner_fk",
    );
    expect(foreignKey).toBeDefined();
    foreignKey![3] = ["owner_id", "id"];

    expect(() =>
      assertSchemaMatchesManifest(weakened, phaseBSchemaManifest),
    ).toThrow();
  });

  it("rejects a foreign key whose delete action is weakened", () => {
    const weakened = structuredClone(
      extractDrizzleTablesManifest(drizzleTables),
    );
    const foreignKey = weakened.event_sync_payloads.foreignKeys.find(
      ([name]) => name === "event_sync_payloads_event_owner_fk",
    );
    expect(foreignKey).toBeDefined();
    foreignKey![5] = "no action";

    expect(() =>
      assertSchemaMatchesManifest(weakened, phaseBSchemaManifest),
    ).toThrow();
  });

  it("rejects a sync-run index whose completion ordering is weakened", () => {
    const weakened = structuredClone(
      extractDrizzleTablesManifest(drizzleTables),
    );
    const index = weakened.sync_runs.indexes.find(
      ([name]) => name === "sync_runs_owner_calendar_completed_idx",
    );
    expect(index).toBeDefined();
    index![3][3]![1] = "asc";

    expect(() =>
      assertSchemaMatchesManifest(weakened, phaseBSchemaManifest),
    ).toThrow();
  });

  it("rejects a protected envelope changed from bytea to text", () => {
    const weakened = structuredClone(
      extractDrizzleTablesManifest(drizzleTables),
    );
    const protectedColumn = weakened.events.columns.find(
      ([name]) => name === "meeting_link_envelope",
    );
    expect(protectedColumn).toBeDefined();
    protectedColumn![1] = "text";

    expect(() =>
      assertSchemaMatchesManifest(weakened, phaseBSchemaManifest),
    ).toThrow();
  });

  it("rejects a weakened AI settlement consistency check", () => {
    const weakened = structuredClone(
      extractDrizzleTablesManifest(drizzleTables),
    );
    const check = weakened.ai_usage_reservations.checks.find(
      ([name]) => name === "ai_usage_reservations_actual_consistent",
    );
    expect(check).toBeDefined();
    check![1] = "actual_cents is null or actual_cents >= 0";

    expect(() =>
      assertSchemaMatchesManifest(weakened, phaseBSchemaManifest),
    ).toThrow();
  });

  it("rejects an AI token column type or nullability change", () => {
    const weakened = structuredClone(
      extractDrizzleTablesManifest(drizzleTables),
    );
    const tokenColumn = weakened.ai_usage_ledger.columns.find(
      ([name]) => name === "total_tokens",
    );
    expect(tokenColumn).toBeDefined();
    tokenColumn![1] = "bigint";
    tokenColumn![2] = true;

    expect(() =>
      assertSchemaMatchesManifest(weakened, phaseBSchemaManifest),
    ).toThrow();
  });

  it("rejects a removed AI concurrency index", () => {
    const weakened = structuredClone(
      extractDrizzleTablesManifest(drizzleTables),
    );
    weakened.ai_usage_reservations.indexes =
      weakened.ai_usage_reservations.indexes.filter(
        ([name]) => name !== "ai_usage_reservations_one_in_flight_uq",
      );

    expect(() =>
      assertSchemaMatchesManifest(weakened, phaseBSchemaManifest),
    ).toThrow();
  });

  it("rejects a weakened AI concurrency predicate", () => {
    const weakened = structuredClone(
      extractDrizzleTablesManifest(drizzleTables),
    );
    const index = weakened.ai_usage_reservations.indexes.find(
      ([name]) => name === "ai_usage_reservations_one_in_flight_uq",
    );
    expect(index).toBeDefined();
    index![4] = "status = 'reserved'";

    expect(() =>
      assertSchemaMatchesManifest(weakened, phaseBSchemaManifest),
    ).toThrow();
  });

  it("rejects a removed AI concurrency predicate", () => {
    const weakened = structuredClone(
      extractDrizzleTablesManifest(drizzleTables),
    );
    const index = weakened.ai_usage_reservations.indexes.find(
      ([name]) => name === "ai_usage_reservations_one_in_flight_uq",
    );
    expect(index).toBeDefined();
    index!.splice(4, 1);

    expect(() =>
      assertSchemaMatchesManifest(weakened, phaseBSchemaManifest),
    ).toThrow();
  });

  it("rejects a weakened AI ledger foreign-key action", () => {
    const weakened = structuredClone(
      extractDrizzleTablesManifest(drizzleTables),
    );
    const foreignKey = weakened.ai_usage_ledger.foreignKeys.find(
      ([name]) => name === "ai_usage_ledger_reservation_fk",
    );
    expect(foreignKey).toBeDefined();
    foreignKey![5] = "cascade";

    expect(() =>
      assertSchemaMatchesManifest(weakened, phaseBSchemaManifest),
    ).toThrow();
  });
});

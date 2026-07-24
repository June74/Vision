import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditEvents,
  calendarSyncJobs,
  edges,
  eventSyncPayloads,
  events,
  nodes,
  operationLedger,
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
  nodes,
  events,
  eventSyncPayloads,
  edges,
  auditEvents,
  calendarSyncJobs,
  syncCheckpoints,
  syncChannels,
  syncRuns,
  operationLedger,
  recoverableDeletions,
];

describe("Drizzle schema structure", () => {
  it("matches the complete migration-derived manifest for all eleven tables", () => {
    const actual = extractDrizzleTablesManifest(drizzleTables);
    assertSchemaMatchesManifest(actual, phaseBSchemaManifest);
  });

  it("keeps the retained generated snapshot consistent with the reviewed manifest", () => {
    const snapshot = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "migrations/generated/meta/0002_snapshot.json"),
        "utf8",
      ),
    ) as unknown;
    const actual = extractSnapshotTablesManifest(snapshot);
    assertSchemaMatchesManifest(actual, phaseBSchemaManifest);
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
});

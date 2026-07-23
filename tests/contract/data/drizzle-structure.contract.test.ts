import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditEvents,
  edges,
  events,
  nodes,
  operationLedger,
  recoverableDeletions,
  syncChannels,
  syncCheckpoints,
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
  edges,
  auditEvents,
  syncCheckpoints,
  syncChannels,
  operationLedger,
  recoverableDeletions,
];

describe("Drizzle schema structure", () => {
  it("matches the complete migration-derived manifest for all eight tables", () => {
    const actual = extractDrizzleTablesManifest(drizzleTables);
    assertSchemaMatchesManifest(actual, phaseBSchemaManifest);
  });

  it("keeps the retained generated snapshot consistent with the reviewed manifest", () => {
    const snapshot = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "migrations/generated/meta/0000_snapshot.json"),
        "utf8",
      ),
    ) as unknown;
    const actual = extractSnapshotTablesManifest(snapshot);
    assertSchemaMatchesManifest(actual, phaseBSchemaManifest);
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

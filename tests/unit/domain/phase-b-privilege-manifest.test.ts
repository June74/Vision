import { describe, expect, it } from "vitest";
import { BACKUP_TABLES } from "../../../src/domain/backup/schema-contract";
import {
  PHASE_B_PRIVILEGE_MANIFEST,
  comparePhaseBPrivilegeFacts,
  isCompletePhaseBPrivilegeManifest,
  type PhaseBPrivilegeManifest,
} from "../../../src/domain/operations/phase-b-privilege-manifest";

const EXPECTED_LIVE_MANIFEST = {
  role: "vision_app",
  schema: "public",
  schemaOwner: "pg_database_owner",
  schemaPrivileges: ["USAGE"],
  schemaGrantOptions: [],
  tables: [
    {
      table: "data_key_state",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "wrapped_data_keys",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "oauth_admission_windows",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "oauth_transactions",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "auth_sessions",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "google_oauth_tokens",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "calendar_setup_states",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "calendar_setup_candidates",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "vision_calendar_connections",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "nodes",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "events",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "event_sync_payloads",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "node_annotations",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "node_category_assignments",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "edges",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "audit_events",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "operation_ledger",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "calendar_create_snapshots",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "recoverable_deletions",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "sync_checkpoints",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "sync_channels",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "calendar_sync_maintenance",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "calendar_sync_jobs",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "sync_runs",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "projection_rebuild_generations",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "projection_rebuild_changes",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "ai_usage_months",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "ai_usage_reservations",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
    {
      table: "ai_usage_ledger",
      owner: "neondb_owner",
      privileges: ["DELETE", "INSERT", "SELECT", "UPDATE"],
      grantOptions: [],
    },
  ],
} as const satisfies PhaseBPrivilegeManifest;

function syntheticManifestForComparatorOnly(): PhaseBPrivilegeManifest {
  return {
    role: "vision_app",
    schema: "public",
    schemaOwner: "synthetic_owner",
    schemaPrivileges: ["USAGE"],
    schemaGrantOptions: [],
    tables: BACKUP_TABLES.map((table) => ({
      table,
      owner: "synthetic_owner",
      privileges: [],
      grantOptions: [],
    })),
  };
}

describe("Phase B privilege manifest", () => {
  it("equals the exact structurally validated live-attested manifest", () => {
    expect(BACKUP_TABLES).toHaveLength(29);
    expect(
      isCompletePhaseBPrivilegeManifest(PHASE_B_PRIVILEGE_MANIFEST),
    ).toBe(true);
    expect(
      comparePhaseBPrivilegeFacts(
        EXPECTED_LIVE_MANIFEST,
        PHASE_B_PRIVILEGE_MANIFEST,
      ),
    ).toBe(true);
    expect(PHASE_B_PRIVILEGE_MANIFEST).toEqual(
      EXPECTED_LIVE_MANIFEST,
    );
  });

  it("is deeply immutable", () => {
    expect(Object.isFrozen(PHASE_B_PRIVILEGE_MANIFEST)).toBe(true);
    expect(
      Object.isFrozen(PHASE_B_PRIVILEGE_MANIFEST.schemaPrivileges),
    ).toBe(true);
    expect(
      Object.isFrozen(PHASE_B_PRIVILEGE_MANIFEST.schemaGrantOptions),
    ).toBe(true);
    expect(Object.isFrozen(PHASE_B_PRIVILEGE_MANIFEST.tables)).toBe(true);
    for (const table of PHASE_B_PRIVILEGE_MANIFEST.tables) {
      expect(Object.isFrozen(table)).toBe(true);
      expect(Object.isFrozen(table.privileges)).toBe(true);
      expect(Object.isFrozen(table.grantOptions)).toBe(true);
    }
  });

  it("accepts a complete internally coherent synthetic shape without making it production data", () => {
    const synthetic = syntheticManifestForComparatorOnly();

    expect(isCompletePhaseBPrivilegeManifest(synthetic)).toBe(true);
    expect(comparePhaseBPrivilegeFacts(synthetic, synthetic)).toBe(true);
  });

  it.each([
    ["wrong role", { role: "other_role" }],
    ["wrong schema", { schema: "other_schema" }],
    ["wrong schema owner", { schemaOwner: "other_owner" }],
    ["extra schema grant", { schemaPrivileges: ["CREATE", "USAGE"] }],
    ["schema grant option drift", { schemaGrantOptions: ["USAGE"] }],
  ])("detects %s", (_, override) => {
    const expected = syntheticManifestForComparatorOnly();
    const observed = { ...expected, ...override } as PhaseBPrivilegeManifest;

    expect(comparePhaseBPrivilegeFacts(expected, observed)).toBe(false);
  });

  it("detects table owner, effective privilege, grant-option, order, and cardinality drift", () => {
    const expected = syntheticManifestForComparatorOnly();
    const changedOwner = {
      ...expected,
      tables: expected.tables.map((entry, index) =>
        index === 0 ? { ...entry, owner: "other_owner" } : entry,
      ),
    };
    const changedPrivilege = {
      ...expected,
      tables: expected.tables.map((entry, index) =>
        index === 0 ? { ...entry, privileges: ["SELECT" as const] } : entry,
      ),
    };
    const changedGrantOption = {
      ...changedPrivilege,
      tables: changedPrivilege.tables.map((entry, index) =>
        index === 0
          ? { ...entry, grantOptions: ["SELECT" as const] }
          : entry,
      ),
    };
    const reordered = {
      ...expected,
      tables: [...expected.tables].reverse(),
    };
    const missing = {
      ...expected,
      tables: expected.tables.slice(1),
    };

    expect(comparePhaseBPrivilegeFacts(expected, changedOwner)).toBe(false);
    expect(comparePhaseBPrivilegeFacts(expected, changedPrivilege)).toBe(false);
    expect(
      comparePhaseBPrivilegeFacts(changedPrivilege, changedGrantOption),
    ).toBe(false);
    expect(comparePhaseBPrivilegeFacts(expected, reordered)).toBe(false);
    expect(isCompletePhaseBPrivilegeManifest(missing)).toBe(false);
  });

  it("rejects duplicate privileges and grant options that are not effective privileges", () => {
    const duplicatePrivilege = syntheticManifestForComparatorOnly();
    const invalidGrantOption = syntheticManifestForComparatorOnly();
    const first = duplicatePrivilege.tables[0]!;

    expect(
      isCompletePhaseBPrivilegeManifest({
        ...duplicatePrivilege,
        tables: [
          {
            ...first,
            privileges: ["SELECT", "SELECT"],
          },
          ...duplicatePrivilege.tables.slice(1),
        ],
      }),
    ).toBe(false);
    expect(
      isCompletePhaseBPrivilegeManifest({
        ...invalidGrantOption,
        tables: [
          {
            ...invalidGrantOption.tables[0]!,
            grantOptions: ["SELECT"],
          },
          ...invalidGrantOption.tables.slice(1),
        ],
      }),
    ).toBe(false);
  });
});

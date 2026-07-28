import { describe, expect, it } from "vitest";
import { BACKUP_TABLES } from "../../../src/domain/backup/schema-contract";
import {
  PHASE_B_PRIVILEGE_MANIFEST,
  comparePhaseBPrivilegeFacts,
  isCompletePhaseBPrivilegeManifest,
  type PhaseBPrivilegeManifest,
} from "../../../src/domain/operations/phase-b-privilege-manifest";

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
  it("keeps the exact 29-table values unattested until the controller supplies them", () => {
    expect(BACKUP_TABLES).toHaveLength(29);
    expect(PHASE_B_PRIVILEGE_MANIFEST).toBeUndefined();
    expect(
      isCompletePhaseBPrivilegeManifest(PHASE_B_PRIVILEGE_MANIFEST),
    ).toBe(false);
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

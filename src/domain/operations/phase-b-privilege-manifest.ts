/** Holds only controller-attested application-role privilege expectations. */
import {
  BACKUP_TABLES,
  type BackupTableName,
} from "../backup/schema-contract";

/** Exact supported PostgreSQL schema privilege names. */
export type PhaseBSchemaPrivilegeName = "CREATE" | "USAGE";

/** Exact supported PostgreSQL table privilege names in canonical order. */
export type PhaseBPrivilegeName =
  | "DELETE"
  | "INSERT"
  | "REFERENCES"
  | "SELECT"
  | "TRIGGER"
  | "TRUNCATE"
  | "UPDATE";

/** One reviewed table privilege expectation for the application role. */
export interface PhaseBTablePrivilegeExpectation {
  readonly table: BackupTableName;
  readonly owner: string;
  readonly privileges: readonly PhaseBPrivilegeName[];
  readonly grantOptions: readonly PhaseBPrivilegeName[];
}

/** A complete reviewed migration-9 schema and table privilege contract. */
export interface PhaseBPrivilegeManifest {
  readonly role: "vision_app";
  readonly schema: string;
  readonly schemaOwner: string;
  readonly schemaPrivileges: readonly PhaseBSchemaPrivilegeName[];
  readonly schemaGrantOptions: readonly PhaseBSchemaPrivilegeName[];
  readonly tables: readonly PhaseBTablePrivilegeExpectation[];
}

/**
 * Live-attested values are intentionally absent until supplied by the
 * controller. Do not infer them from repository call sites.
 */
export const PHASE_B_PRIVILEGE_MANIFEST:
  | PhaseBPrivilegeManifest
  | undefined = undefined;

const SCHEMA_PRIVILEGE_ORDER = ["CREATE", "USAGE"] as const;
const TABLE_PRIVILEGE_ORDER = [
  "DELETE",
  "INSERT",
  "REFERENCES",
  "SELECT",
  "TRIGGER",
  "TRUNCATE",
  "UPDATE",
] as const;
const MANIFEST_KEYS = [
  "role",
  "schema",
  "schemaGrantOptions",
  "schemaOwner",
  "schemaPrivileges",
  "tables",
] as const;
const TABLE_KEYS = [
  "grantOptions",
  "owner",
  "privileges",
  "table",
] as const;

/** Admits only an exact, closed 29-table migration-9 privilege manifest. */
export function isCompletePhaseBPrivilegeManifest(
  candidate: unknown,
): candidate is PhaseBPrivilegeManifest {
  const manifest = snapshotPlainRecord(candidate);
  if (
    !manifest ||
    !hasExactKeys(manifest, MANIFEST_KEYS) ||
    manifest.role !== "vision_app" ||
    !isNonemptyText(manifest.schema) ||
    !isNonemptyText(manifest.schemaOwner) ||
    !isPrivilegeList(manifest.schemaPrivileges, SCHEMA_PRIVILEGE_ORDER) ||
    !isPrivilegeList(manifest.schemaGrantOptions, SCHEMA_PRIVILEGE_ORDER) ||
    !isSubset(manifest.schemaGrantOptions, manifest.schemaPrivileges) ||
    !Array.isArray(manifest.tables) ||
    manifest.tables.length !== BACKUP_TABLES.length
  ) {
    return false;
  }

  return manifest.tables.every((candidateEntry, index) => {
    const entry = snapshotPlainRecord(candidateEntry);
    return (
      entry !== null &&
      hasExactKeys(entry, TABLE_KEYS) &&
      entry.table === BACKUP_TABLES[index] &&
      isNonemptyText(entry.owner) &&
      isPrivilegeList(entry.privileges, TABLE_PRIVILEGE_ORDER) &&
      isPrivilegeList(entry.grantOptions, TABLE_PRIVILEGE_ORDER) &&
      isSubset(entry.grantOptions, entry.privileges)
    );
  });
}

/** Compares two complete manifests without normalizing away any attested drift. */
export function comparePhaseBPrivilegeFacts(
  expected: unknown,
  observed: unknown,
): boolean {
  if (
    !isCompletePhaseBPrivilegeManifest(expected) ||
    !isCompletePhaseBPrivilegeManifest(observed)
  ) {
    return false;
  }
  if (
    expected.role !== observed.role ||
    expected.schema !== observed.schema ||
    expected.schemaOwner !== observed.schemaOwner ||
    !sameStrings(expected.schemaPrivileges, observed.schemaPrivileges) ||
    !sameStrings(expected.schemaGrantOptions, observed.schemaGrantOptions)
  ) {
    return false;
  }
  return expected.tables.every((expectedTable, index) => {
    const observedTable = observed.tables[index];
    return (
      observedTable !== undefined &&
      expectedTable.table === observedTable.table &&
      expectedTable.owner === observedTable.owner &&
      sameStrings(expectedTable.privileges, observedTable.privileges) &&
      sameStrings(expectedTable.grantOptions, observedTable.grantOptions)
    );
  });
}

/** Requires one canonical, duplicate-free subset of the declared vocabulary. */
function isPrivilegeList(
  candidate: unknown,
  order: readonly string[],
): candidate is readonly string[] {
  if (!Array.isArray(candidate)) return false;
  let previousIndex = -1;
  for (const privilege of candidate) {
    const index = order.indexOf(privilege);
    if (index <= previousIndex) return false;
    previousIndex = index;
  }
  return true;
}

/** Checks exact subset membership without accepting duplicate values. */
function isSubset(candidate: unknown, superset: unknown): boolean {
  return (
    Array.isArray(candidate) &&
    Array.isArray(superset) &&
    candidate.every((value) => superset.includes(value))
  );
}

/** Compares two already validated canonical string arrays. */
function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

/** Rejects prototypes, symbols, accessors, and hidden manifest properties. */
function snapshotPlainRecord(
  candidate: unknown,
): Record<string, unknown> | null {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    return null;
  }
  const prototype = Object.getPrototypeOf(candidate);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(candidate);
  if (
    Reflect.ownKeys(candidate).some(
      (key) =>
        typeof key !== "string" ||
        descriptors[key]?.enumerable !== true ||
        !("value" in descriptors[key]!),
    )
  ) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(descriptors).map(([key, descriptor]) => [
      key,
      descriptor.value,
    ]),
  );
}

/** Requires an exact own-enumerable key set. */
function hasExactKeys(
  candidate: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(candidate).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

/** Admits one bounded nonempty PostgreSQL identifier-like value. */
function isNonemptyText(candidate: unknown): candidate is string {
  return (
    typeof candidate === "string" &&
    candidate.length > 0 &&
    candidate.length <= 128 &&
    !candidate.includes("\u0000")
  );
}

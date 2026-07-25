/** Validates encrypted backups completely before staging and atomic disposable-target promotion. */
import {
  decryptBackupEnvelope,
  type BackupEncryptionKey,
  type EncryptedBackup,
} from "../../crypto/backup-envelope";
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  validateBackupManifest,
  type BackupManifestV1,
  type BackupRow,
  type BackupRowCounts,
  type BackupSnapshotV1,
  type BackupTableName,
  type BackupValue,
} from "../../domain/backup/manifest";
import {
  countSnapshotRows,
  decodeCanonicalBackupArchive,
  parseBackupPayload,
  sha256Base64Url,
} from "./export-backup";

/** Read-only target facts required before a restore may stage data. */
export interface RestoreTargetDescription {
  readonly targetId: string;
  readonly environment: string;
  readonly disposable: boolean;
  readonly schemaVersion: number;
  readonly rowCounts: BackupRowCounts;
}

/** Opaque staging identity owned by a target adapter. */
export interface BackupRestoreStage {
  readonly opaqueId: string;
}

/** Post-stage database facts checked before promotion. */
export interface BackupRestoreStageInspection {
  readonly rowCounts: BackupRowCounts;
  readonly referencesValid: boolean;
}

/** Operations that a target adapter must execute inside one database transaction. */
export interface BackupRestoreTransaction {
  stage(snapshot: BackupSnapshotV1): Promise<BackupRestoreStage>;
  inspectStage(
    stage: BackupRestoreStage,
  ): Promise<BackupRestoreStageInspection>;
  promote(
    stage: BackupRestoreStage,
    options: { readonly replaceExisting: boolean },
  ): Promise<void>;
}

/** Disposable database boundary capable of transactional staging and promotion. */
export interface BackupRestoreTarget {
  describe(): Promise<RestoreTargetDescription>;
  transaction<T>(
    operation: (transaction: BackupRestoreTransaction) => Promise<T>,
  ): Promise<T>;
}

/** Explicit operator assertions required to replace a non-empty disposable target. */
export interface ImportBackupOptions {
  readonly replaceDisposableTarget?: boolean;
  readonly assertedEnvironment?: string;
  readonly assertedTargetId?: string;
}

/** Safe restore evidence returned after successful promotion. */
export interface RestoreReport {
  readonly format: BackupManifestV1["format"];
  readonly createdAt: string;
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  readonly rowCounts: BackupRowCounts;
  readonly plaintextSha256: string;
  readonly targetId: string;
  readonly replacedExisting: boolean;
}

interface ReferenceRule {
  readonly fromTable: BackupTableName;
  readonly fromColumns: readonly string[];
  readonly toTable: BackupTableName;
  readonly toColumns: readonly string[];
  readonly optional?: boolean;
}

const REFERENCE_RULES: readonly ReferenceRule[] = [
  {
    fromTable: "calendar_setup_candidates",
    fromColumns: ["owner_id"],
    toTable: "calendar_setup_states",
    toColumns: ["owner_id"],
  },
  {
    fromTable: "vision_calendar_connections",
    fromColumns: ["owner_id"],
    toTable: "calendar_setup_states",
    toColumns: ["owner_id"],
  },
  {
    fromTable: "events",
    fromColumns: ["node_id", "owner_id"],
    toTable: "nodes",
    toColumns: ["id", "owner_id"],
  },
  {
    fromTable: "events",
    fromColumns: ["node_id", "owner_id", "node_type"],
    toTable: "nodes",
    toColumns: ["id", "owner_id", "node_type"],
  },
  {
    fromTable: "event_sync_payloads",
    fromColumns: ["node_id", "owner_id"],
    toTable: "events",
    toColumns: ["node_id", "owner_id"],
  },
  {
    fromTable: "node_annotations",
    fromColumns: ["node_id", "owner_id"],
    toTable: "nodes",
    toColumns: ["id", "owner_id"],
  },
  {
    fromTable: "node_category_assignments",
    fromColumns: ["node_id", "owner_id"],
    toTable: "nodes",
    toColumns: ["id", "owner_id"],
  },
  {
    fromTable: "edges",
    fromColumns: ["source_node_id", "owner_id"],
    toTable: "nodes",
    toColumns: ["id", "owner_id"],
  },
  {
    fromTable: "edges",
    fromColumns: ["source_node_id", "owner_id", "source_node_type"],
    toTable: "nodes",
    toColumns: ["id", "owner_id", "node_type"],
  },
  {
    fromTable: "edges",
    fromColumns: ["destination_node_id", "owner_id"],
    toTable: "nodes",
    toColumns: ["id", "owner_id"],
  },
  {
    fromTable: "edges",
    fromColumns: [
      "destination_node_id",
      "owner_id",
      "destination_node_type",
    ],
    toTable: "nodes",
    toColumns: ["id", "owner_id", "node_type"],
  },
  {
    fromTable: "audit_events",
    fromColumns: ["node_id", "owner_id"],
    toTable: "nodes",
    toColumns: ["id", "owner_id"],
    optional: true,
  },
  {
    fromTable: "calendar_create_snapshots",
    fromColumns: ["operation_id"],
    toTable: "operation_ledger",
    toColumns: ["operation_id"],
  },
  {
    fromTable: "recoverable_deletions",
    fromColumns: ["node_id", "owner_id"],
    toTable: "nodes",
    toColumns: ["id", "owner_id"],
  },
  {
    fromTable: "projection_rebuild_changes",
    fromColumns: ["generation_id"],
    toTable: "projection_rebuild_generations",
    toColumns: ["id"],
  },
  {
    fromTable: "ai_usage_ledger",
    fromColumns: ["reservation_id"],
    toTable: "ai_usage_reservations",
    toColumns: ["id"],
  },
] as const;

/** Restores only after envelope, manifest, archive, references, counts, and target policy pass. */
export async function importBackup(
  encrypted: EncryptedBackup,
  backupKey: BackupEncryptionKey,
  target: BackupRestoreTarget,
  options: ImportBackupOptions = {},
): Promise<RestoreReport> {
  const plaintext = await decryptBackupEnvelope(encrypted, backupKey);
  const payload = parseBackupPayload(plaintext);
  const manifest = validateBackupManifest(payload.manifest);
  if (manifest.keyVersion !== encrypted.keyVersion) {
    throw new Error("Backup manifest and envelope key versions disagree.");
  }
  const plaintextSha256 = await sha256Base64Url(payload.archive);
  if (plaintextSha256 !== manifest.plaintextSha256) {
    throw new Error("Backup plaintext checksum does not match the manifest.");
  }

  const snapshot = decodeCanonicalBackupArchive(payload.archive);
  const actualCounts = countSnapshotRows(snapshot);
  requireMatchingCounts(
    actualCounts,
    manifest.rowCounts,
    "Backup archive row counts",
  );
  validateSnapshotReferences(snapshot);

  const description = await target.describe();
  validateTargetDescription(description);
  if (!description.disposable) {
    throw new Error("Backup restore target must be disposable.");
  }
  if (description.schemaVersion !== manifest.schemaVersion) {
    throw new Error("Backup restore target schema version does not match.");
  }
  const targetIsEmpty = BACKUP_TABLES.every(
    (table) => description.rowCounts[table] === 0,
  );
  const replaceExisting = !targetIsEmpty;
  if (
    replaceExisting &&
    (!options.replaceDisposableTarget ||
      options.assertedEnvironment !== description.environment ||
      options.assertedTargetId !== description.targetId)
  ) {
    throw new Error(
      "Backup restore target is non-empty and requires an exact disposable-target assertion.",
    );
  }

  await target.transaction(async (transaction) => {
    const stage = await transaction.stage(snapshot);
    const inspection = await transaction.inspectStage(stage);
    if (inspection.referencesValid !== true) {
      throw new Error("Backup staging reference validation failed.");
    }
    requireMatchingCounts(
      inspection.rowCounts,
      manifest.rowCounts,
      "Backup staging row counts",
    );
    await transaction.promote(stage, { replaceExisting });
  });

  return Object.freeze({
    format: manifest.format,
    createdAt: manifest.createdAt,
    schemaVersion: manifest.schemaVersion,
    rowCounts: manifest.rowCounts,
    plaintextSha256: manifest.plaintextSha256,
    targetId: description.targetId,
    replacedExisting: replaceExisting,
  });
}

/** Verifies every declared database reference before the target receives staged rows. */
export function validateSnapshotReferences(
  snapshot: BackupSnapshotV1,
): void {
  for (const rule of REFERENCE_RULES) {
    const targetKeys = new Set(
      snapshot.tables[rule.toTable].map((row) =>
        referenceKey(row, rule.toColumns, false),
      ),
    );
    for (const row of snapshot.tables[rule.fromTable]) {
      const key = referenceKey(row, rule.fromColumns, rule.optional ?? false);
      if (key === undefined) continue;
      if (!targetKeys.has(key)) {
        throw new Error(
          `Backup reference from ${rule.fromTable} to ${rule.toTable} is invalid.`,
        );
      }
    }
  }
}

/** Encodes a scalar reference tuple without conflating null, number, and string values. */
function referenceKey(
  row: BackupRow,
  columns: readonly string[],
  optional: boolean,
): string | undefined {
  const values = columns.map((column) => {
    if (!Object.hasOwn(row, column)) {
      throw new Error(`Backup row is missing reference column ${column}.`);
    }
    return row[column];
  });
  if (optional && values[0] === null) return undefined;
  if (values.some((value) => value === null)) {
    throw new Error("Backup reference contains an unexpected null.");
  }
  if (
    values.some(
      (value) =>
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "bigint",
    )
  ) {
    throw new Error("Backup reference contains a non-scalar value.");
  }
  return JSON.stringify(
    values.map((value) => [
      typeof value,
      typeof value === "bigint" ? value.toString() : (value as BackupValue),
    ]),
  );
}

/** Validates trusted adapter metadata before using it for destructive policy decisions. */
function validateTargetDescription(
  description: RestoreTargetDescription,
): void {
  if (
    typeof description !== "object" ||
    description === null ||
    typeof description.targetId !== "string" ||
    description.targetId.length === 0 ||
    typeof description.environment !== "string" ||
    description.environment.length === 0 ||
    typeof description.disposable !== "boolean" ||
    !Number.isSafeInteger(description.schemaVersion)
  ) {
    throw new Error("Backup restore target description is invalid.");
  }
  requireMatchingCounts(
    description.rowCounts,
    description.rowCounts,
    "Backup restore target row counts",
  );
}

/** Requires exact complete row-count agreement for all authoritative tables. */
function requireMatchingCounts(
  actual: BackupRowCounts,
  expected: BackupRowCounts,
  label: string,
): void {
  if (
    typeof actual !== "object" ||
    actual === null ||
    typeof expected !== "object" ||
    expected === null
  ) {
    throw new Error(`${label} are invalid.`);
  }
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = [...BACKUP_TABLES].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error(`${label} are incomplete.`);
  }
  for (const table of BACKUP_TABLES) {
    if (
      !Number.isSafeInteger(actual[table]) ||
      actual[table] < 0 ||
      actual[table] !== expected[table]
    ) {
      throw new Error(`${label} do not match.`);
    }
  }
}

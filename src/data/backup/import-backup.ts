/** Validates backups completely before transaction-locked disposable-target promotion. */
import {
  decryptBackupEnvelope,
  type BackupEncryptionKey,
  type EncryptedBackup,
} from "../../crypto/backup-envelope";
import {
  validateBackupReferences,
} from "../../domain/backup/schema-contract";
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  validateBackupManifest,
  type BackupManifestV1,
  type BackupRowCounts,
  type BackupSnapshotV1,
} from "../../domain/backup/manifest";
import {
  countSnapshotRows,
  decodeCanonicalBackupArchive,
  parseBackupPayload,
  sha256Base64Url,
} from "./export-backup";

/** Locked target facts used for restore policy and a final drift assertion. */
export interface RestoreTargetDescription {
  readonly targetId: string;
  readonly environment: string;
  readonly disposable: boolean;
  readonly schemaVersion: number;
  readonly revision: string;
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

/** Operations executed under one database transaction and target-state lock. */
export interface BackupRestoreTransaction {
  /**
   * Inspects and locks authoritative target identity, schema, policy, revision,
   * and row counts until the transaction completes.
   */
  lockTargetForRestore(): Promise<RestoreTargetDescription>;
  stage(snapshot: BackupSnapshotV1): Promise<BackupRestoreStage>;
  inspectStage(
    stage: BackupRestoreStage,
  ): Promise<BackupRestoreStageInspection>;
  /** Fails unless every locked target fact still equals the supplied snapshot. */
  assertTargetUnchanged(
    expected: RestoreTargetDescription,
  ): Promise<void>;
  /** Atomically promotes only while the same locked target revision is current. */
  promote(
    stage: BackupRestoreStage,
    options: {
      readonly replaceExisting: boolean;
      readonly expectedTarget: RestoreTargetDescription;
    },
  ): Promise<void>;
}

/** Disposable database boundary capable of one lock/stage/inspect/promote transaction. */
export interface BackupRestoreTarget {
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

/** Restores only after cryptographic, logical, and transaction-locked policy validation. */
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

  const targetResult = await target.transaction(async (transaction) => {
    const description = snapshotTargetDescription(
      await transaction.lockTargetForRestore(),
    );
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
    await transaction.assertTargetUnchanged(description);
    await transaction.promote(stage, {
      replaceExisting,
      expectedTarget: description,
    });
    return { description, replaceExisting };
  });

  return Object.freeze({
    format: manifest.format,
    createdAt: manifest.createdAt,
    schemaVersion: manifest.schemaVersion,
    rowCounts: manifest.rowCounts,
    plaintextSha256: manifest.plaintextSha256,
    targetId: targetResult.description.targetId,
    replacedExisting: targetResult.replaceExisting,
  });
}

/** Verifies every migration-9 database reference before target staging. */
export function validateSnapshotReferences(
  snapshot: BackupSnapshotV1,
): void {
  validateBackupReferences(snapshot.tables);
}

/** Validates and owns target metadata before destructive policy decisions. */
function snapshotTargetDescription(
  description: RestoreTargetDescription,
): RestoreTargetDescription {
  if (
    typeof description !== "object" ||
    description === null ||
    typeof description.targetId !== "string" ||
    description.targetId.length === 0 ||
    typeof description.environment !== "string" ||
    description.environment.length === 0 ||
    typeof description.disposable !== "boolean" ||
    !Number.isSafeInteger(description.schemaVersion) ||
    typeof description.revision !== "string" ||
    description.revision.length === 0
  ) {
    throw new Error("Backup restore target description is invalid.");
  }
  requireMatchingCounts(
    description.rowCounts,
    description.rowCounts,
    "Backup restore target row counts",
  );
  return Object.freeze({
    targetId: description.targetId,
    environment: description.environment,
    disposable: description.disposable,
    schemaVersion: description.schemaVersion,
    revision: description.revision,
    rowCounts: Object.freeze({ ...description.rowCounts }),
  });
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

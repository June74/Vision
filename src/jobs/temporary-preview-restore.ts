/** Restores one verified backup into an attested empty preview target and verifies it independently. */
import type { BackupEncryptionKey } from "../crypto/backup-envelope";
import {
  encodeCanonicalBackupArchive,
  countSnapshotRows,
  sha256Base64Url,
} from "../data/backup/export-backup";
import {
  BackupRestorePromotionError,
  importBackup,
  type RestoreReport,
} from "../data/backup/import-backup";
import type { ManagedBackupRestoreTarget } from "../data/backup/neon-adapter";
import { validateBackupReferences } from "../domain/backup/schema-contract";
import {
  BACKUP_TABLES,
  type BackupRowCounts,
  type BackupSnapshotV1,
} from "../domain/backup/manifest";
import { TemporaryRestoreEnvSchema } from "../server/env";
import {
  BACKUP_OBJECT_PREFIX,
  readVerifiedStoredBackup,
  type BackupObjectHead,
  type BackupObjectStore,
} from "./create-daily-backup";
import { validatedBackupObjectDate } from "./purge-expired-backups";

/** Temporary every-minute schedule used only by the preview restore Worker. */
export const TEMPORARY_PREVIEW_RESTORE_CRON = "* * * * *" as const;

/** Closed failure categories safe to retain without provider or protected values. */
export type TemporaryRestoreFailureCategory =
  | "restore_configuration_invalid"
  | "restore_candidate_invalid"
  | "restore_object_verification_failed"
  | "restore_backup_validation_failed"
  | "restore_target_attestation_failed"
  | "restore_target_not_empty"
  | "restore_promotion_failed"
  | "restore_readback_verification_failed"
  | "restore_unknown_failure";

/** Privacy-safe result containing only closed facts, counts, and booleans. */
export interface TemporaryRestoreEvidence {
  readonly evidenceType: "vision.preview-restore/v1";
  readonly outcome: "succeeded" | "failed";
  readonly category: "none" | TemporaryRestoreFailureCategory;
  readonly format?: "vision-backup/v1";
  readonly schemaVersion?: 9;
  readonly keyVersion?: number;
  readonly authoritativeTableCount?: 29;
  readonly rowCounts?: BackupRowCounts;
  readonly checksumMatches?: boolean;
  readonly referencesValid?: boolean;
  readonly targetWasEmpty?: boolean;
  readonly eventListReadable?: boolean;
  readonly eventCount?: number;
  readonly replacedExisting?: false;
}

/** Injected storage and database boundaries for the temporary preview-only engine. */
export interface TemporaryPreviewRestoreDependencies {
  readonly store: BackupObjectStore;
  readonly backupKey: BackupEncryptionKey;
  readonly createTarget: (
    databaseUrl: string,
    targetId: string,
  ) => Promise<ManagedBackupRestoreTarget>;
  readonly readTargetSnapshot: (
    databaseUrl: string,
  ) => Promise<BackupSnapshotV1>;
  readonly countReadableEvents: (
    databaseUrl: string,
  ) => Promise<number>;
}

interface SelectedBackupCandidate {
  readonly object: BackupObjectHead;
  readonly createdDate: string;
}

/** Runs one fail-closed preview restore and returns only privacy-safe evidence. */
export async function runTemporaryPreviewRestore(
  environment: unknown,
  dependencies: TemporaryPreviewRestoreDependencies,
): Promise<TemporaryRestoreEvidence> {
  let parsed: ReturnType<typeof TemporaryRestoreEnvSchema.parse>;
  try {
    parsed = TemporaryRestoreEnvSchema.parse(environment);
  } catch {
    return failedEvidence("restore_configuration_invalid");
  }

  let candidate: SelectedBackupCandidate;
  try {
    candidate = await selectBackupCandidate(
      dependencies.store,
      dependencies.backupKey.keyVersion,
    );
  } catch {
    return failedEvidence("restore_candidate_invalid");
  }

  let verifiedBackup: Awaited<ReturnType<typeof readVerifiedStoredBackup>>;
  try {
    verifiedBackup = await readVerifiedStoredBackup(
      dependencies.store,
      candidate.object.key,
      candidate.createdDate,
      dependencies.backupKey,
    );
  } catch {
    return failedEvidence("restore_object_verification_failed");
  }

  let managedTarget: ManagedBackupRestoreTarget;
  try {
    managedTarget = await dependencies.createTarget(
      parsed.PREVIEW_RESTORE_DATABASE_URL,
      parsed.PREVIEW_RESTORE_TARGET_ID,
    );
  } catch {
    return failedEvidence("restore_target_attestation_failed");
  }

  let report: RestoreReport | undefined;
  let importFailure: TemporaryRestoreFailureCategory | undefined;
  let closeFailed = false;
  try {
    report = await importBackup(
      verifiedBackup.encrypted,
      dependencies.backupKey,
      managedTarget.target,
      {
        replaceDisposableTarget: false,
        assertedEnvironment: "preview",
      },
    );
  } catch (error) {
    importFailure = classifyImportFailure(error);
  } finally {
    try {
      await managedTarget.close();
    } catch {
      closeFailed = true;
    }
  }
  if (closeFailed) return failedEvidence("restore_unknown_failure");
  if (importFailure) return failedEvidence(importFailure);
  if (!report) return failedEvidence("restore_unknown_failure");

  try {
    const snapshot = await dependencies.readTargetSnapshot(
      parsed.PREVIEW_RESTORE_DATABASE_URL,
    );
    const counts = countSnapshotRows(snapshot);
    if (!rowCountsMatch(counts, report.rowCounts)) {
      throw new Error("Restore read-back row counts do not match.");
    }
    validateBackupReferences(snapshot.tables);
    const archiveSha256 = await sha256Base64Url(
      encodeCanonicalBackupArchive(snapshot),
    );
    if (
      archiveSha256 !== report.plaintextSha256 ||
      report.replacedExisting !== false
    ) {
      throw new Error("Restore read-back checksum or replacement state failed.");
    }
    const eventCount = await dependencies.countReadableEvents(
      parsed.PREVIEW_RESTORE_DATABASE_URL,
    );
    if (!Number.isSafeInteger(eventCount) || eventCount < 0) {
      throw new Error("Restore read-back event count is invalid.");
    }
    return Object.freeze({
      evidenceType: "vision.preview-restore/v1" as const,
      outcome: "succeeded" as const,
      category: "none" as const,
      format: report.format,
      schemaVersion: report.schemaVersion,
      keyVersion: verifiedBackup.encrypted.keyVersion,
      authoritativeTableCount: BACKUP_TABLES.length,
      rowCounts: counts,
      checksumMatches: true,
      referencesValid: true,
      targetWasEmpty: true,
      eventListReadable: true,
      eventCount,
      replacedExisting: false,
    });
  } catch {
    return failedEvidence("restore_readback_verification_failed");
  }
}

/** Lists every fixed-prefix page and selects the sole validated newest UTC-date object. */
async function selectBackupCandidate(
  store: BackupObjectStore,
  expectedKeyVersion: number,
): Promise<SelectedBackupCandidate> {
  let cursor: string | undefined;
  const seenCursors = new Set<string>();
  const candidates: Array<{
    readonly object: BackupObjectHead;
    readonly date: number;
  }> = [];

  do {
    const page = await store.list(BACKUP_OBJECT_PREFIX, cursor);
    for (const object of page.objects) {
      const date = validatedBackupObjectDate(object);
      if (date === undefined) {
        throw new Error("Restore backup candidate is invalid.");
      }
      candidates.push({ object, date });
    }
    cursor = page.cursor;
    if (cursor !== undefined) {
      if (cursor.length === 0 || seenCursors.has(cursor)) {
        throw new Error("Restore backup candidate listing is invalid.");
      }
      seenCursors.add(cursor);
    }
  } while (cursor !== undefined);

  if (candidates.length === 0) {
    throw new Error("Restore backup candidate is unavailable.");
  }
  const newestDate = Math.max(...candidates.map((candidate) => candidate.date));
  const newest = candidates.filter(
    (candidate) => candidate.date === newestDate,
  );
  if (
    newest.length !== 1 ||
    Number(newest[0]!.object.customMetadata.keyVersion) !==
      expectedKeyVersion
  ) {
    throw new Error("Restore backup candidate is ambiguous or incompatible.");
  }
  return Object.freeze({
    object: newest[0]!.object,
    createdDate: new Date(newestDate).toISOString().slice(0, 10),
  });
}

/** Maps only stable value-free importer messages into the closed evidence categories. */
function classifyImportFailure(error: unknown): TemporaryRestoreFailureCategory {
  if (!(error instanceof Error)) return "restore_unknown_failure";
  if (error instanceof BackupRestorePromotionError) {
    return "restore_promotion_failed";
  }
  const message = error.message.toLowerCase();
  if (message.includes("non-empty")) return "restore_target_not_empty";
  if (
    message.includes("attestation") ||
    message.includes("must be disposable") ||
    message.includes("target schema version") ||
    message.includes("target description") ||
    message.includes("target identity")
  ) {
    return "restore_target_attestation_failed";
  }
  if (
    message.includes("manifest") ||
    message.includes("archive") ||
    message.includes("authentication") ||
    message.includes("payload") ||
    message.includes("snapshot reference")
  ) {
    return "restore_backup_validation_failed";
  }
  return "restore_unknown_failure";
}

/** Requires exact complete authoritative-table count agreement. */
function rowCountsMatch(
  actual: BackupRowCounts,
  expected: BackupRowCounts,
): boolean {
  return BACKUP_TABLES.every((table) => actual[table] === expected[table]);
}

/** Creates the sole closed failure-evidence shape without retaining inputs or errors. */
function failedEvidence(
  category: TemporaryRestoreFailureCategory,
): TemporaryRestoreEvidence {
  return Object.freeze({
    evidenceType: "vision.preview-restore/v1" as const,
    outcome: "failed" as const,
    category,
  });
}

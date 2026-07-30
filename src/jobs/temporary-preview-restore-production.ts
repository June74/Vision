/** Composes restore from explicit scalars and narrow capabilities. */
import type { BackupEncryptionKey } from "../crypto/backup-envelope";
import type { RestoreAttemptStore } from "../data/backup/r2-restore-attempt-store";
import type { BackupObjectCatalogReader } from "./create-daily-backup";
import {
  runTemporaryPreviewRestore,
  type TemporaryPreviewRestoreDependencies,
  type TemporaryRestoreEvidence,
} from "./temporary-preview-restore";

export interface TemporaryPreviewRestoreProductionInput {
  readonly VISION_ENV: "preview";
  readonly PREVIEW_RESTORE_DATABASE_URL: string;
  readonly PREVIEW_RESTORE_TARGET_ID: string;
  readonly BACKUP_ENCRYPTION_KEY: BackupEncryptionKey;
  readonly catalogReader: BackupObjectCatalogReader;
  readonly attemptFence: Pick<RestoreAttemptStore, "claimOnce">;
  readonly ports: Omit<
    TemporaryPreviewRestoreDependencies,
    "store" | "backupKey" | "attemptStore"
  >;
}

/** Runs the fenced restore without a broad Worker environment. */
export function runProductionTemporaryPreviewRestore(
  input: TemporaryPreviewRestoreProductionInput,
): Promise<TemporaryRestoreEvidence | null> {
  return runTemporaryPreviewRestore(
    {
      VISION_ENV: input.VISION_ENV,
      PREVIEW_RESTORE_DATABASE_URL: input.PREVIEW_RESTORE_DATABASE_URL,
      PREVIEW_RESTORE_TARGET_ID: input.PREVIEW_RESTORE_TARGET_ID,
    },
    {
      ...input.ports,
      store: input.catalogReader,
      backupKey: input.BACKUP_ENCRYPTION_KEY,
      attemptStore: input.attemptFence,
    },
  );
}

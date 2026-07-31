/** Composes restore from explicit scalars and narrow capabilities. */
import { importBackupEncryptionKey } from "../crypto/backup-key";
import {
  createNeonBackupRestoreTarget,
  createNeonBackupSnapshotSource,
} from "../data/backup/neon-adapter";
import type { RestoreAttemptStore } from "../data/backup/r2-restore-attempt-store";
import { createTemporaryPreviewClearAdapter } from "../data/backup/temporary-preview-clear-adapter";
import type { BackupSnapshotV1 } from "../domain/backup/manifest";
import type { BackupObjectCatalogReader } from "./create-daily-backup";
import {
  runTemporaryPreviewRestore,
  type TemporaryRestoreEvidence,
} from "./temporary-preview-restore";

const REQUIRED_BACKUP_KEY_VERSION = "1";
const REQUIRED_BACKUP_KEY_VERSION_NUMBER = 1;

export interface TemporaryPreviewRestoreRuntimeInput {
  readonly VISION_ENV: "preview";
  readonly PREVIEW_RESTORE_DATABASE_URL: string;
  readonly PREVIEW_RESTORE_TARGET_ID: string;
  readonly BACKUP_ENCRYPTION_KEY: string;
  readonly BACKUP_KEY_VERSION: string;
  readonly catalogReader: BackupObjectCatalogReader;
  readonly attemptFence: Pick<RestoreAttemptStore, "claimOnce">;
}

/** Runs the fenced restore behind the exact preview-only runtime boundary. */
export async function runProductionTemporaryPreviewRestore(
  input: TemporaryPreviewRestoreRuntimeInput,
): Promise<TemporaryRestoreEvidence> {
  if (
    input.VISION_ENV !== "preview" ||
    input.BACKUP_KEY_VERSION !== REQUIRED_BACKUP_KEY_VERSION
  ) {
    throw new Error("Temporary preview restore adapter is unavailable.");
  }
  const backupKey = await importBackupEncryptionKey(
    input.BACKUP_ENCRYPTION_KEY,
    REQUIRED_BACKUP_KEY_VERSION_NUMBER,
  );
  let readback: BackupSnapshotV1 | undefined;
  const evidence = await runTemporaryPreviewRestore(
    {
      VISION_ENV: input.VISION_ENV,
      PREVIEW_RESTORE_DATABASE_URL: input.PREVIEW_RESTORE_DATABASE_URL,
      PREVIEW_RESTORE_TARGET_ID: input.PREVIEW_RESTORE_TARGET_ID,
    },
    {
      store: input.catalogReader,
      backupKey,
      attemptStore: input.attemptFence,
      /** Clears only the admitted disposable restore target. */
      clearTarget: async (
        databaseUrl,
        targetId,
        rowCounts,
      ) =>
        createTemporaryPreviewClearAdapter(
          databaseUrl,
          targetId,
        ).clear(rowCounts),
      /** Creates only the admitted disposable preview restore target. */
      createTarget: async (databaseUrl, targetId) =>
        createNeonBackupRestoreTarget(databaseUrl, {
          environment: "preview",
          targetId,
          disposable: true,
        }),
      /** Reads one consistent snapshot back from the restore target. */
      readTargetSnapshot: async (databaseUrl) => {
        readback =
          await createNeonBackupSnapshotSource(
            databaseUrl,
          ).readConsistentSnapshot();
        return readback;
      },
      /** Counts readable audit events from the restored snapshot. */
      countReadableEvents: async (databaseUrl) => {
        const snapshot =
          readback ??
          await createNeonBackupSnapshotSource(
            databaseUrl,
          ).readConsistentSnapshot();
        return snapshot.tables.audit_events.length;
      },
    },
  );
  if (evidence === null) {
    throw new Error("Temporary preview restore failed.");
  }
  return evidence;
}

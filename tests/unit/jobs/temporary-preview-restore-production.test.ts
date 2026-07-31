import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackupEncryptionKey } from "../../../src/crypto/backup-envelope";
import type { TemporaryPreviewRestoreDependencies } from "../../../src/jobs/temporary-preview-restore";
import type { TemporaryRestoreEvidence } from "../../../src/jobs/temporary-preview-restore";

const mocks = vi.hoisted(() => ({
  importBackupEncryptionKey: vi.fn(),
  createTemporaryPreviewClearAdapter: vi.fn(),
  createNeonBackupRestoreTarget: vi.fn(),
  createNeonBackupSnapshotSource: vi.fn(),
  runTemporaryPreviewRestore: vi.fn(),
}));

vi.mock("../../../src/crypto/backup-key", () => ({
  importBackupEncryptionKey: mocks.importBackupEncryptionKey,
}));

vi.mock("../../../src/data/backup/temporary-preview-clear-adapter", () => ({
  createTemporaryPreviewClearAdapter:
    mocks.createTemporaryPreviewClearAdapter,
}));

vi.mock("../../../src/data/backup/neon-adapter", () => ({
  createNeonBackupRestoreTarget: mocks.createNeonBackupRestoreTarget,
  createNeonBackupSnapshotSource: mocks.createNeonBackupSnapshotSource,
}));

vi.mock("../../../src/jobs/temporary-preview-restore", () => ({
  runTemporaryPreviewRestore: mocks.runTemporaryPreviewRestore,
}));

import {
  runProductionTemporaryPreviewRestore,
  type TemporaryPreviewRestoreRuntimeInput,
} from "../../../src/jobs/temporary-preview-restore-production";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Assert<Condition extends true> = Condition;

type ExpectedRuntimeInputKeys =
  | "VISION_ENV"
  | "PREVIEW_RESTORE_DATABASE_URL"
  | "PREVIEW_RESTORE_TARGET_ID"
  | "BACKUP_ENCRYPTION_KEY"
  | "BACKUP_KEY_VERSION"
  | "catalogReader"
  | "attemptFence";
type RuntimeInputKeysAreExact = Assert<
  Equal<keyof TemporaryPreviewRestoreRuntimeInput, ExpectedRuntimeInputKeys>
>;
type RuntimeFacadeIsExact = Assert<
  Equal<
    typeof runProductionTemporaryPreviewRestore,
    (
      input: TemporaryPreviewRestoreRuntimeInput,
    ) => Promise<TemporaryRestoreEvidence>
  >
>;

const CLOSED_FAILURE: TemporaryRestoreEvidence = Object.freeze({
  evidenceType: "vision.preview-restore/v1",
  outcome: "failed",
  category: "restore_unknown_failure",
});

function runtimeInput(): TemporaryPreviewRestoreRuntimeInput {
  return {
    VISION_ENV: "preview",
    PREVIEW_RESTORE_DATABASE_URL: "preview-restore-database-binding",
    PREVIEW_RESTORE_TARGET_ID: "preview-restore-target",
    BACKUP_ENCRYPTION_KEY: "synthetic-backup-key-material",
    BACKUP_KEY_VERSION: "1",
    catalogReader: Object.freeze({
      head: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
    }) as unknown as TemporaryPreviewRestoreRuntimeInput["catalogReader"],
    attemptFence: Object.freeze({
      claimOnce: vi.fn(),
    }) as unknown as TemporaryPreviewRestoreRuntimeInput["attemptFence"],
  };
}

describe("production temporary preview restore facade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports the exact frozen runtime boundary and imports only key version 1", async () => {
    const compileTimeInputKeys: RuntimeInputKeysAreExact = true;
    const compileTimeFacade: RuntimeFacadeIsExact = true;
    const input = runtimeInput();
    const opaqueKey = Object.freeze({
      opaque: true,
    }) as unknown as BackupEncryptionKey;
    mocks.importBackupEncryptionKey.mockResolvedValue(opaqueKey);
    mocks.runTemporaryPreviewRestore.mockResolvedValue(CLOSED_FAILURE);

    const result = await runProductionTemporaryPreviewRestore(input);

    expect(compileTimeInputKeys).toBe(true);
    expect(compileTimeFacade).toBe(true);
    expect(Object.keys(input).sort()).toEqual([
      "BACKUP_ENCRYPTION_KEY",
      "BACKUP_KEY_VERSION",
      "PREVIEW_RESTORE_DATABASE_URL",
      "PREVIEW_RESTORE_TARGET_ID",
      "VISION_ENV",
      "attemptFence",
      "catalogReader",
    ]);
    expect(mocks.importBackupEncryptionKey).toHaveBeenCalledWith(
      input.BACKUP_ENCRYPTION_KEY,
      1,
    );
    expect(mocks.runTemporaryPreviewRestore).toHaveBeenCalledOnce();
    const [environment, dependencies] =
      mocks.runTemporaryPreviewRestore.mock.calls[0] as unknown as [
        {
          readonly VISION_ENV: "preview";
          readonly PREVIEW_RESTORE_DATABASE_URL: string;
          readonly PREVIEW_RESTORE_TARGET_ID: string;
        },
        TemporaryPreviewRestoreDependencies,
      ];
    expect(environment).toEqual({
      VISION_ENV: "preview",
      PREVIEW_RESTORE_DATABASE_URL:
        input.PREVIEW_RESTORE_DATABASE_URL,
      PREVIEW_RESTORE_TARGET_ID: input.PREVIEW_RESTORE_TARGET_ID,
    });
    expect(dependencies.store).toBe(input.catalogReader);
    expect(dependencies.attemptStore).toBe(input.attemptFence);
    expect(dependencies.backupKey).toBe(opaqueKey);
    expect("ports" in dependencies).toBe(false);
    expect(result).toBe(CLOSED_FAILURE);
  });

  it("rejects every backup key version other than the required version", async () => {
    const input = {
      ...runtimeInput(),
      BACKUP_KEY_VERSION: "2",
    };

    await expect(
      runProductionTemporaryPreviewRestore(input),
    ).rejects.toThrow("Temporary preview restore adapter is unavailable.");
    expect(mocks.importBackupEncryptionKey).not.toHaveBeenCalled();
    expect(mocks.runTemporaryPreviewRestore).not.toHaveBeenCalled();
  });

  it("never exposes a nullable result through the production facade", async () => {
    const input = runtimeInput();
    mocks.importBackupEncryptionKey.mockResolvedValue(
      Object.freeze({ opaque: true }),
    );
    mocks.runTemporaryPreviewRestore.mockResolvedValue(null);

    await expect(
      runProductionTemporaryPreviewRestore(input),
    ).rejects.toThrow("Temporary preview restore failed.");
  });
});

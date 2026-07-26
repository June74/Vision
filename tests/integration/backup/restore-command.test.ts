import { describe, expect, it, vi } from "vitest";
import {
  createBackupEncryptionKey,
  serializeEncryptedBackup,
} from "../../../src/crypto/backup-envelope";
import { encodeBase64Url } from "../../../src/crypto/envelope";
import { exportBackup, countSnapshotRows } from "../../../src/data/backup/export-backup";
import type {
  BackupRestoreTarget,
  BackupRestoreTransaction,
  RestoreTargetDescription,
} from "../../../src/data/backup/import-backup";
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  type BackupRowCounts,
  type BackupSnapshotV1,
} from "../../../src/domain/backup/manifest";
import {
  RESTORE_DISPOSABLE_CONFIRMATION,
  runRestoreBackupCommand,
} from "../../../scripts/restore-backup";

const NOW = "2026-07-25T06:05:00.000Z";
const OBJECT_KEY =
  "backups/v1/2026/07/25/" + "A".repeat(43) + ".vision-backup";

function emptySnapshot(): BackupSnapshotV1 {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    tables: Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])),
  } as unknown as BackupSnapshotV1;
}

function memoryTarget(nonempty = false): BackupRestoreTarget {
  const emptyCounts = countSnapshotRows(emptySnapshot());
  const rowCounts: BackupRowCounts = nonempty
    ? Object.freeze({ ...emptyCounts, audit_events: 1 })
    : emptyCounts;
  const description: RestoreTargetDescription = {
    targetId: "neon_branch_preview_1",
    environment: "preview",
    disposable: true,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    revision: "revision-1",
    rowCounts,
  };
  return {
    async transaction<T>(
      operation: (transaction: BackupRestoreTransaction) => Promise<T>,
    ): Promise<T> {
      let staged = emptySnapshot();
      const transaction: BackupRestoreTransaction = {
        async lockTargetForRestore() {
          return description;
        },
        async stage(snapshot) {
          staged = snapshot;
          return { opaqueId: "stage-1" };
        },
        async inspectStage() {
          return {
            rowCounts: countSnapshotRows(staged),
            referencesValid: true,
          };
        },
        async assertTargetUnchanged() {},
        async promote() {},
      };
      return operation(transaction);
    },
  };
}

async function fixture(nonempty = false) {
  const generated = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", generated));
  const key = createBackupEncryptionKey(
    await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    ),
    7,
  );
  const encrypted = await exportBackup(emptySnapshot(), key, {
    createdAt: NOW,
  });
  const databaseUrl =
    "postgresql://vision_app:synthetic-password@preview.example.test/vision";
  const environment = {
    BACKUP_ENCRYPTION_KEY: encodeBase64Url(raw),
    BACKUP_KEY_VERSION: "7",
    PREVIEW_RESTORE_DATABASE_URL: databaseUrl,
    PREVIEW_RESTORE_TARGET_ID: "neon_branch_preview_1",
  };
  const output: string[] = [];
  const readBackupObject = vi.fn(async () =>
    serializeEncryptedBackup(encrypted),
  );
  const createTarget = vi.fn(async () => ({
    target: memoryTarget(nonempty),
    close: async () => undefined,
  }));
  return {
    raw,
    encrypted,
    databaseUrl,
    environment,
    output,
    readBackupObject,
    createTarget,
    dependencies: {
      readBackupObject,
      createTarget,
      writeOutput: (line: string) => output.push(line),
    },
  };
}

function baseArguments(): string[] {
  return [
    "--object",
    OBJECT_KEY,
    "--target",
    "preview",
    "--confirm-disposable-target",
    RESTORE_DISPOSABLE_CONFIRMATION,
  ];
}

describe("preview-only backup restore command", () => {
  it("rejects production, a missing confirmation phrase, and missing process secrets before I/O", async () => {
    const test = await fixture();
    await expect(
      runRestoreBackupCommand(
        baseArguments().map((value) =>
          value === "preview" ? "production" : value,
        ),
        test.environment,
        test.dependencies,
      ),
    ).rejects.toThrow(/preview/i);
    await expect(
      runRestoreBackupCommand(
        baseArguments().slice(0, -1).concat("wrong phrase"),
        test.environment,
        test.dependencies,
      ),
    ).rejects.toThrow(/confirmation/i);
    await expect(
      runRestoreBackupCommand(
        baseArguments(),
        { ...test.environment, BACKUP_ENCRYPTION_KEY: undefined },
        test.dependencies,
      ),
    ).rejects.toThrow(/configuration/i);
    expect(test.readBackupObject).not.toHaveBeenCalled();
    expect(test.createTarget).not.toHaveBeenCalled();
  });

  it("prints row counts and checksums without secrets, ciphertext, URLs, object keys, or target identity", async () => {
    const test = await fixture();

    await runRestoreBackupCommand(
      baseArguments(),
      test.environment,
      test.dependencies,
    );

    expect(test.output).toHaveLength(1);
    const rendered = test.output[0]!;
    expect(JSON.parse(rendered)).toEqual({
      plaintextSha256: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      rowCounts: Object.fromEntries(BACKUP_TABLES.map((table) => [table, 0])),
      replacedExisting: false,
    });
    for (const forbidden of [
      test.environment.BACKUP_ENCRYPTION_KEY,
      test.databaseUrl,
      OBJECT_KEY,
      test.encrypted.ciphertext,
      "neon_branch_preview_1",
    ]) {
      expect(rendered).not.toContain(forbidden);
    }
  });

  it("requires the explicit replace flag and exact target assertion for a nonempty disposable target", async () => {
    const test = await fixture(true);
    await expect(
      runRestoreBackupCommand(
        baseArguments(),
        test.environment,
        test.dependencies,
      ),
    ).rejects.toThrow(/non-empty|assertion/i);

    await expect(
      runRestoreBackupCommand(
        baseArguments().concat(
          "--replace-disposable-target",
          "--assert-target-id",
          "neon_branch_preview_1",
        ),
        test.environment,
        test.dependencies,
      ),
    ).resolves.toBeUndefined();
    expect(JSON.parse(test.output.at(-1)!)).toMatchObject({
      replacedExisting: true,
    });
  });
});

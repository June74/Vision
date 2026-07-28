import { describe, expect, it, vi } from "vitest";
import {
  createBackupEncryptionKey,
  serializeEncryptedBackup,
  type BackupEncryptionKey,
} from "../../../src/crypto/backup-envelope";
import {
  decodeBase64Url,
  encodeBase64Url,
} from "../../../src/crypto/envelope";
import {
  exportBackup,
  countSnapshotRows,
  sha256Base64Url,
} from "../../../src/data/backup/export-backup";
import type {
  BackupRestoreTarget,
  BackupRestoreTransaction,
  RestoreTargetDescription,
} from "../../../src/data/backup/import-backup";
import {
  importPreparedBackup,
  prepareBackupImport,
} from "../../../src/data/backup/import-backup";
import {
  BACKUP_FORMAT_V1,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  type BackupRowCounts,
  type BackupSnapshotV1,
} from "../../../src/domain/backup/manifest";
import {
  RESTORE_DISPOSABLE_CONFIRMATION,
  runRestoreBackupCommand,
} from "../../../scripts/restore-backup";
import { MemoryBackupObjectStore } from "../jobs/backup-test-helpers";

const NOW = "2026-07-25T06:05:00.000Z";
const OBJECT_KEY =
  "backups/v1/2026/07/25/CZt2zZSul9fwzdSOylRVWv2b-GMfNnuttAZjsZn4CRw.vision-backup";

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
  const serialized = serializeEncryptedBackup(encrypted);
  const body = new TextEncoder().encode(serialized);
  const backupStore = new MemoryBackupObjectStore();
  backupStore.seed(
    OBJECT_KEY,
    {
      format: BACKUP_FORMAT_V1,
      createdDate: "2026-07-25",
      ciphertextSha256: await sha256Base64Url(
        decodeBase64Url(
          encrypted.ciphertext,
          "Backup ciphertext",
          encrypted.ciphertext.length,
        ),
      ),
      keyVersion: "7",
    },
    body,
    await sha256Base64Url(body),
  );
  const databaseUrl =
    "postgresql://vision_app:synthetic-password@preview.example.test/vision";
  const environment = {
    BACKUP_ENCRYPTION_KEY: encodeBase64Url(raw),
    BACKUP_KEY_VERSION: "7",
    PREVIEW_RESTORE_DATABASE_URL: databaseUrl,
    PREVIEW_RESTORE_TARGET_ID: "neon_branch_preview_1",
  };
  const output: string[] = [];
  const createTarget = vi.fn(async () => ({
    target: memoryTarget(nonempty),
    close: async () => undefined,
  }));
  return {
    raw,
    backupKey: key,
    encrypted,
    databaseUrl,
    environment,
    output,
    backupStore,
    createTarget,
    dependencies: {
      backupStore,
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
  it("prepares and validates a backup before target access, then imports that exact immutable preparation", async () => {
    const test = await fixture();
    const transactionCalls = vi.fn();
    const target: BackupRestoreTarget = {
      async transaction<T>(
        operation: (transaction: BackupRestoreTransaction) => Promise<T>,
      ): Promise<T> {
        transactionCalls();
        const targetTransaction: BackupRestoreTransaction = {
          async lockTargetForRestore() {
            return {
              targetId: "neon_branch_preview_1",
              environment: "preview",
              disposable: true,
              schemaVersion: BACKUP_SCHEMA_VERSION,
              revision: "revision-1",
              rowCounts: countSnapshotRows(emptySnapshot()),
            };
          },
          async stage(snapshot) {
            expect(countSnapshotRows(snapshot)).toEqual(prepared.rowCounts);
            return { opaqueId: "prepared-stage" };
          },
          async inspectStage() {
            return {
              rowCounts: prepared.rowCounts,
              referencesValid: true,
            };
          },
          async assertTargetUnchanged() {},
          async promote() {},
        };
        return operation(targetTransaction);
      },
    };

    const prepared = await prepareBackupImport(
      test.encrypted,
      test.backupKey,
    );

    expect(Object.isFrozen(prepared)).toBe(true);
    expect(Object.isFrozen(prepared.rowCounts)).toBe(true);
    expect(Object.keys(prepared)).not.toContain("target");
    expect(Object.keys(prepared)).not.toContain("snapshot");
    expect(transactionCalls).not.toHaveBeenCalled();

    await expect(
      importPreparedBackup(prepared, target),
    ).resolves.toMatchObject({
      rowCounts: prepared.rowCounts,
      replacedExisting: false,
    });
    expect(transactionCalls).toHaveBeenCalledOnce();
  });

  it("rejects authentication failure during preparation without any target capability", async () => {
    const test = await fixture();
    const wrongKey: BackupEncryptionKey = createBackupEncryptionKey(
      await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      ),
      test.backupKey.keyVersion,
    );

    await expect(
      prepareBackupImport(test.encrypted, wrongKey),
    ).rejects.toThrow();
  });

  it("maps Cloudflare object metadata and native SHA-256 into the shared reader contract", async () => {
    const restoreModule = await import("../../../scripts/restore-backup");
    const createReader = Reflect.get(
      restoreModule,
      "createCloudflareR2BackupObjectReader",
    ) as
      | ((
          input: {
            accountId: string;
            apiToken: string;
            bucketName: string;
          },
          fetchImplementation: typeof fetch,
        ) => {
          head(key: string): Promise<unknown>;
          get(key: string): Promise<unknown>;
        })
      | undefined;
    expect(createReader).toBeTypeOf("function");
    if (!createReader) return;

    const body = new TextEncoder().encode("encrypted-object");
    const nativeSha256 = Buffer.from(
      await crypto.subtle.digest("SHA-256", body),
    ).toString("base64");
    const headers = {
      etag: '"etag-1"',
      "x-amz-checksum-sha256": nativeSha256,
      "x-amz-meta-format": BACKUP_FORMAT_V1,
      "x-amz-meta-createddate": "2026-07-25",
      "x-amz-meta-ciphertextsha256": "A".repeat(43),
      "x-amz-meta-keyversion": "7",
    };
    const fetchImplementation = vi.fn(async () =>
      new Response(body, { status: 200, headers }),
    );
    const reader = createReader(
      {
        accountId: "a".repeat(32),
        apiToken: "synthetic-api-token-value",
        bucketName: "vision-preview-backups",
      },
      fetchImplementation as typeof fetch,
    );

    await expect(reader.head(OBJECT_KEY)).resolves.toMatchObject({
      key: OBJECT_KEY,
      etag: "etag-1",
      customMetadata: {
        format: BACKUP_FORMAT_V1,
        createdDate: "2026-07-25",
        ciphertextSha256: "A".repeat(43),
        keyVersion: "7",
      },
      bodySha256: encodeBase64Url(
        new Uint8Array(await crypto.subtle.digest("SHA-256", body)),
      ),
    });
    await expect(reader.get(OBJECT_KEY)).resolves.toMatchObject({
      key: OBJECT_KEY,
      etag: "etag-1",
      body,
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    const firstCall = fetchImplementation.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit,
    ];
    expect(
      new Headers(firstCall[1].headers).get("authorization"),
    ).toBe("Bearer synthetic-api-token-value");
  });

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

  it("rejects mismatched stored-object metadata before opening the restore target", async () => {
    const test = await fixture();
    test.backupStore.replaceMetadata(OBJECT_KEY, {
      format: BACKUP_FORMAT_V1,
      createdDate: "2026-07-25",
      ciphertextSha256: "A".repeat(43),
      keyVersion: "7",
    });

    await expect(
      runRestoreBackupCommand(
        baseArguments(),
        test.environment,
        test.dependencies,
      ),
    ).rejects.toThrow(/verification/i);
    expect(test.createTarget).not.toHaveBeenCalled();
  });
});

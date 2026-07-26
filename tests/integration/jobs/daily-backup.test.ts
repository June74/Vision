import { describe, expect, it, vi } from "vitest";
import {
  createBackupEncryptionKey,
  parseEncryptedBackup,
  serializeEncryptedBackup,
} from "../../../src/crypto/backup-envelope";
import {
  decodeBase64Url,
  encodeBase64Url,
} from "../../../src/crypto/envelope";
import { sha256Base64Url } from "../../../src/data/backup/export-backup";
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  type BackupRow,
  type BackupSnapshotV1,
} from "../../../src/domain/backup/manifest";
import { createR2BackupObjectStore } from "../../../src/data/backup/r2-object-store";
import {
  BACKUP_OBJECT_PREFIX,
  createDailyBackup,
} from "../../../src/jobs/create-daily-backup";
import {
  CALENDAR_MAINTENANCE_CRON,
  DAILY_BACKUP_CRON,
  runScheduledJob,
  runScheduledRecovery,
} from "../../../src/jobs/scheduled";
import { parseBackupEnvironment } from "../../../src/server/env";
import { MemoryBackupObjectStore } from "./backup-test-helpers";

const NOW = new Date("2026-07-25T06:05:00.000Z");
const SENTINEL = "VISION_BACKUP_SENTINEL_TASK2";

function emptySnapshot(): BackupSnapshotV1 {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    tables: Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])),
  } as unknown as BackupSnapshotV1;
}

async function backupKey() {
  return createBackupEncryptionKey(
    await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    ),
    7,
  );
}

function dependencies(store = new MemoryBackupObjectStore()) {
  const snapshot = emptySnapshot();
  (snapshot.tables.audit_events as BackupRow[]).push({
    id: "audit-1",
    owner_id: "owner-1",
    node_id: null,
    actor_type: "system",
    action: SENTINEL,
    outcome: "succeeded",
    provider: null,
    error_category: null,
    occurred_at: NOW,
  });
  const readConsistentSnapshot = vi.fn(async () => snapshot);
  const key = backupKey();
  return {
    store,
    readConsistentSnapshot,
    create: async () =>
      createDailyBackup(NOW, {
        store,
        snapshotSource: { readConsistentSnapshot },
        backupKey: await key,
      }),
  };
}

describe("daily encrypted backup job", () => {
  it("creates one opaque daily object with only safe metadata and verifies it before success", async () => {
    const fixture = dependencies();
    const result = await fixture.create();

    expect(result).toMatchObject({
      status: "created",
      createdDate: "2026-07-25",
      keyVersion: 7,
    });
    expect(result.objectKey).toMatch(
      /^backups\/v1\/2026\/07\/25\/[A-Za-z0-9_-]{43}\.vision-backup$/,
    );
    expect(fixture.store.objects).toHaveLength(1);
    const stored = fixture.store.objects.get(result.objectKey)!;
    expect(Object.keys(stored.customMetadata).sort()).toEqual([
      "ciphertextSha256",
      "createdDate",
      "format",
      "keyVersion",
    ]);
    expect(stored.customMetadata).toEqual({
      format: "vision-backup/v1",
      createdDate: "2026-07-25",
      ciphertextSha256: result.ciphertextSha256,
      keyVersion: "7",
    });
    expect(new TextDecoder().decode(stored.body)).not.toContain(SENTINEL);
    expect(parseEncryptedBackup(new TextDecoder().decode(stored.body))).toEqual(
      expect.objectContaining({ keyVersion: 7 }),
    );
  });

  it("reuses one verified object on sequential and concurrent same-date invocations", async () => {
    const sequential = dependencies();
    const first = await sequential.create();
    const second = await sequential.create();
    expect(second).toEqual({ ...first, status: "existing" });
    expect(sequential.readConsistentSnapshot).toHaveBeenCalledOnce();
    expect(sequential.store.objects).toHaveLength(1);

    const racing = dependencies();
    const [left, right] = await Promise.all([racing.create(), racing.create()]);
    expect(left.objectKey).toBe(right.objectKey);
    expect([left.status, right.status].sort()).toEqual([
      "created",
      "existing",
    ]);
    expect(racing.store.objects).toHaveLength(1);
    expect(await racing.store.get(left.objectKey)).not.toBeNull();
  });

  it("reports no success for upload or post-write verification failure", async () => {
    const failedUpload = dependencies();
    failedUpload.store.putFailure = new Error("synthetic upload failure");
    await expect(failedUpload.create()).rejects.toThrow(/backup storage/i);
    expect(failedUpload.store.objects).toHaveLength(0);

    const failedVerification = dependencies();
    failedVerification.store.corruptReads = true;
    await expect(failedVerification.create()).rejects.toThrow(
      /backup verification/i,
    );
    expect(failedVerification.store.objects).toHaveLength(0);
  });

  it("does not expose a database snapshot failure through the scheduled error", async () => {
    const fixture = dependencies();
    fixture.readConsistentSnapshot.mockRejectedValueOnce(
      new Error(`private-${SENTINEL}`),
    );

    let failure: unknown;
    try {
      await fixture.create();
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/backup creation failed/i);
    expect((failure as Error).message).not.toContain(SENTINEL);
    expect(fixture.store.objects).toHaveLength(0);
  });

  it("fails closed on an existing same-date object's metadata mismatch", async () => {
    const fixture = dependencies();
    const created = await fixture.create();
    fixture.store.replaceMetadata(created.objectKey, {
      ...fixture.store.objects.get(created.objectKey)!.customMetadata,
      createdDate: "2026-07-24",
    });

    await expect(fixture.create()).rejects.toThrow(/backup verification/i);
    expect(fixture.readConsistentSnapshot).toHaveBeenCalledOnce();
  });

  it("rejects an existing canonical object whose ciphertext is not authenticated", async () => {
    const fixture = dependencies();
    const created = await fixture.create();
    const stored = fixture.store.objects.get(created.objectKey)!;
    const parsed = parseEncryptedBackup(new TextDecoder().decode(stored.body));
    const randomCiphertext = crypto.getRandomValues(
      new Uint8Array(
        decodeBase64Url(
          parsed.ciphertext,
          "Synthetic ciphertext",
          parsed.ciphertext.length,
        ).byteLength,
      ),
    );
    const ciphertext = encodeBase64Url(randomCiphertext);
    const body = new TextEncoder().encode(
      serializeEncryptedBackup({ ...parsed, ciphertext }),
    );
    fixture.store.objects.set(created.objectKey, {
      ...stored,
      etag: "etag-unauthenticated",
      body,
      bodySha256: await sha256Base64Url(body),
      customMetadata: {
        ...stored.customMetadata,
        ciphertextSha256: await sha256Base64Url(randomCiphertext),
      },
    });

    await expect(fixture.create()).rejects.toThrow(/backup verification/i);
    expect(fixture.readConsistentSnapshot).toHaveBeenCalledOnce();
  });

  it("requires a canonical backup-only secret distinct from the application wrapping key", () => {
    const backupSecret = encodeBase64Url(new Uint8Array(32).fill(1));
    const applicationSecret = encodeBase64Url(new Uint8Array(32).fill(2));
    expect(
      parseBackupEnvironment({
        BACKUP_ENCRYPTION_KEY: backupSecret,
        BACKUP_KEY_VERSION: "7",
        KEY_ENCRYPTION_KEY: applicationSecret,
      }),
    ).toEqual({
      BACKUP_ENCRYPTION_KEY: backupSecret,
      BACKUP_KEY_VERSION: 7,
    });
    expect(() =>
      parseBackupEnvironment({
        BACKUP_ENCRYPTION_KEY: backupSecret,
        BACKUP_KEY_VERSION: "7",
        KEY_ENCRYPTION_KEY: backupSecret,
      }),
    ).toThrow(/distinct/i);
  });

  it("dispatches the daily cron separately without changing the maintenance cron", async () => {
    const maintenance = vi.fn(async () => undefined);
    const recovery = vi.fn(async () => undefined);

    await runScheduledJob(CALENDAR_MAINTENANCE_CRON, NOW, {
      maintenance,
      recovery,
    });
    expect(maintenance).toHaveBeenCalledWith(NOW);
    expect(recovery).not.toHaveBeenCalled();

    maintenance.mockClear();
    await runScheduledJob(DAILY_BACKUP_CRON, NOW, {
      maintenance,
      recovery,
    });
    expect(recovery).toHaveBeenCalledWith(NOW);
    expect(maintenance).not.toHaveBeenCalled();
  });

  it("finishes and verifies the daily backup before starting retention", async () => {
    const order: string[] = [];
    await runScheduledRecovery(NOW, {
      create: async (now) => {
        expect(now).toBe(NOW);
        order.push("create");
      },
      purge: async (now) => {
        expect(now).toBe(NOW);
        order.push("purge");
      },
    });
    expect(order).toEqual(["create", "purge"]);
  });

  it("uses only the fixed versioned object prefix", () => {
    expect(BACKUP_OBJECT_PREFIX).toBe("backups/v1/");
  });

  it("maps the storage port to conditional R2 writes and checksum-bearing reads", async () => {
    const body = new TextEncoder().encode("encrypted-object");
    const bodySha256 = encodeBase64Url(
      new Uint8Array(await crypto.subtle.digest("SHA-256", body)),
    );
    const customMetadata = {
      format: "vision-backup/v1" as const,
      createdDate: "2026-07-25",
      ciphertextSha256: "A".repeat(43),
      keyVersion: "7",
    };
    const r2Object = {
      key: "backups/v1/test",
      etag: "etag-1",
      customMetadata,
      checksums: {
        sha256: (await crypto.subtle.digest("SHA-256", body)) as ArrayBuffer,
      },
    };
    const checksumlessObject = {
      ...r2Object,
      key: "backups/v1/foreign",
      checksums: {},
    };
    const put = vi.fn(async () => r2Object);
    const head = vi.fn(async () => r2Object);
    const get = vi.fn(async () => ({
      ...r2Object,
      bytes: async () => body,
    }));
    const list = vi.fn(async () => ({
      objects: [r2Object, checksumlessObject],
      truncated: false,
    }));
    const delete_ = vi.fn(async () => undefined);
    const store = createR2BackupObjectStore({
      put,
      head,
      get,
      list,
      delete: delete_,
    } as unknown as R2Bucket);

    await expect(
      store.putIfAbsent(
        r2Object.key,
        body,
        customMetadata,
        bodySha256,
      ),
    ).resolves.toBe(true);
    expect(put).toHaveBeenCalledWith(
      r2Object.key,
      body,
      expect.objectContaining({
        onlyIf: { etagDoesNotMatch: "*" },
        customMetadata,
        sha256: expect.any(Uint8Array),
      }),
    );
    await expect(store.head(r2Object.key)).resolves.toMatchObject({
      bodySha256,
    });
    await expect(store.get(r2Object.key)).resolves.toMatchObject({
      body,
      bodySha256,
    });
    await expect(store.list(BACKUP_OBJECT_PREFIX)).resolves.toMatchObject({
      objects: [
        expect.objectContaining({ bodySha256 }),
        expect.not.objectContaining({ bodySha256: expect.anything() }),
      ],
    });
    expect(list).toHaveBeenCalledWith({
      prefix: BACKUP_OBJECT_PREFIX,
      include: ["customMetadata"],
    });
  });
});

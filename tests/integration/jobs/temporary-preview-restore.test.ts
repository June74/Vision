import { describe, expect, it, vi, type Mock } from "vitest";
import {
  createBackupEncryptionKey,
  decryptBackupEnvelope,
  encryptBackupEnvelope,
  serializeEncryptedBackup,
  type BackupEncryptionKey,
  type EncryptedBackup,
} from "../../../src/crypto/backup-envelope";
import {
  decodeBase64Url,
} from "../../../src/crypto/envelope";
import {
  encodeCanonicalBackupArchive,
  countSnapshotRows,
  exportBackup,
  sha256Base64Url,
} from "../../../src/data/backup/export-backup";
import type {
  BackupRestoreStage,
  BackupRestoreTarget,
  BackupRestoreTransaction,
  RestoreTargetDescription,
} from "../../../src/data/backup/import-backup";
import {
  importPreparedBackup,
  prepareBackupImport,
  type ImportBackupOptions,
  type PreparedBackupImport,
} from "../../../src/data/backup/import-backup";
import type { ManagedBackupRestoreTarget } from "../../../src/data/backup/neon-adapter";
import {
  BACKUP_FORMAT_V1,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  type BackupRow,
  type BackupSnapshotV1,
} from "../../../src/domain/backup/manifest";
import {
  BACKUP_OBJECT_PREFIX,
  type BackupObjectMetadata,
} from "../../../src/jobs/create-daily-backup";
import {
  runTemporaryPreviewRestore,
  type TemporaryPreviewRestoreDependencies,
} from "../../../src/jobs/temporary-preview-restore";
import { MemoryBackupObjectStore } from "./backup-test-helpers";

const CREATED_AT = "2026-07-25T06:05:00.000Z";
const CREATED_DATE = "2026-07-25";
const PRIVATE_SENTINEL = "PRIVATE_RESTORE_SENTINEL";
const DATABASE_URL =
  `postgresql://vision_app:${PRIVATE_SENTINEL}@preview.example.test/vision`;
const TARGET_ID = "synthetic_disposable_target";
const KEY_VERSION = 7;

interface MutableTargetState {
  snapshot: BackupSnapshotV1;
  attestationFailure: boolean;
  ordinaryImportFailure: boolean;
  promotionFailure: boolean;
}

interface RestoreFixture {
  readonly environment: {
    readonly VISION_ENV: "preview";
    readonly PREVIEW_RESTORE_DATABASE_URL: string;
    readonly PREVIEW_RESTORE_TARGET_ID: string;
  };
  readonly dependencies: TemporaryPreviewRestoreDependencies;
  readonly store: MemoryBackupObjectStore;
  readonly backupKey: BackupEncryptionKey;
  readonly encrypted: EncryptedBackup;
  readonly objectKey: string;
  readonly state: MutableTargetState;
  readonly createTarget: ReturnType<typeof vi.fn>;
  readonly claimOnce: ReturnType<typeof vi.fn>;
  readonly clearTarget: ReturnType<typeof vi.fn>;
  readonly close: Mock<() => Promise<void>>;
  readonly privateSentinel: string;
}

function expectPrivateValuesAbsent(
  rendered: string,
  privateValues: readonly string[],
): void {
  const valuesAreAbsent = privateValues.every(
    (privateValue) => !rendered.includes(privateValue),
  );
  expect(valuesAreAbsent).toBe(true);
}

async function snapshotDigest(snapshot: BackupSnapshotV1): Promise<string> {
  return sha256Base64Url(encodeCanonicalBackupArchive(snapshot));
}

function emptySnapshot(): BackupSnapshotV1 {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    tables: Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])),
  } as unknown as BackupSnapshotV1;
}

function auditRow(action = "backup.snapshot"): BackupRow {
  return {
    id: "audit-1",
    owner_id: "owner-1",
    node_id: null,
    actor_type: "system",
    action,
    outcome: "succeeded",
    provider: null,
    error_category: null,
    occurred_at: new Date(CREATED_AT),
  };
}

function sourceSnapshot(): BackupSnapshotV1 {
  const snapshot = emptySnapshot();
  (snapshot.tables.audit_events as BackupRow[]).push(auditRow());
  return snapshot;
}

function cloneSnapshot(snapshot: BackupSnapshotV1): BackupSnapshotV1 {
  return structuredClone(snapshot);
}

async function backupKey(): Promise<BackupEncryptionKey> {
  return createBackupEncryptionKey(
    await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    ),
    KEY_VERSION,
  );
}

async function dailyObjectKey(createdDate: string): Promise<string> {
  const opaqueId = await sha256Base64Url(
    new TextEncoder().encode(
      `vision-backup-object\u0000${createdDate}`,
    ),
  );
  const [year, month, day] = createdDate.split("-");
  return `${BACKUP_OBJECT_PREFIX}${year}/${month}/${day}/${opaqueId}.vision-backup`;
}

async function objectMetadata(
  encrypted: EncryptedBackup,
  createdDate = CREATED_DATE,
): Promise<BackupObjectMetadata> {
  return {
    format: BACKUP_FORMAT_V1,
    createdDate,
    ciphertextSha256: await sha256Base64Url(
      decodeBase64Url(
        encrypted.ciphertext,
        "Synthetic backup ciphertext",
        encrypted.ciphertext.length,
      ),
    ),
    keyVersion: String(encrypted.keyVersion),
  };
}

async function seedEncryptedObject(
  store: MemoryBackupObjectStore,
  key: string,
  createdDate: string,
  encrypted: EncryptedBackup,
): Promise<void> {
  const body = new TextEncoder().encode(serializeEncryptedBackup(encrypted));
  store.seed(
    key,
    await objectMetadata(encrypted, createdDate),
    body,
    await sha256Base64Url(body),
  );
}

function memoryManagedTarget(
  state: MutableTargetState,
  close: Mock<() => Promise<void>>,
): ManagedBackupRestoreTarget {
  const target: BackupRestoreTarget = {
    async transaction<T>(
      operation: (transaction: BackupRestoreTransaction) => Promise<T>,
    ): Promise<T> {
      const before = cloneSnapshot(state.snapshot);
      let staged = emptySnapshot();
      const description: RestoreTargetDescription = {
        targetId: TARGET_ID,
        environment: "preview",
        disposable: true,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        revision: "synthetic-revision-1",
        rowCounts: countSnapshotRows(state.snapshot),
      };
      const transaction: BackupRestoreTransaction = {
        async lockTargetForRestore() {
          if (state.attestationFailure) {
            throw new Error("Backup restore target attestation is invalid.");
          }
          return description;
        },
        async stage(snapshot) {
          if (state.ordinaryImportFailure) {
            throw new Error("Synthetic import step failed.");
          }
          staged = cloneSnapshot(snapshot);
          return { opaqueId: "synthetic-stage" } satisfies BackupRestoreStage;
        },
        async inspectStage() {
          return {
            rowCounts: countSnapshotRows(staged),
            referencesValid: true,
          };
        },
        async assertTargetUnchanged() {},
        async promote() {
          state.snapshot = cloneSnapshot(staged);
          if (state.promotionFailure) {
            throw new Error("Synthetic promotion failed.");
          }
        },
      };
      try {
        return await operation(transaction);
      } catch (error) {
        state.snapshot = before;
        throw error;
      }
    },
  };
  return { target, close };
}

async function restoreFixture(options?: {
  readonly source?: BackupSnapshotV1;
  readonly target?: BackupSnapshotV1;
  readonly readback?: (snapshot: BackupSnapshotV1) => BackupSnapshotV1;
  readonly countReadableEvents?: () => Promise<number>;
}): Promise<RestoreFixture> {
  const key = await backupKey();
  const source = options?.source ?? sourceSnapshot();
  const encrypted = await exportBackup(source, key, {
    createdAt: CREATED_AT,
  });
  const store = new MemoryBackupObjectStore();
  const objectKey = await dailyObjectKey(CREATED_DATE);
  await seedEncryptedObject(store, objectKey, CREATED_DATE, encrypted);

  for (const olderDate of ["2026-07-23", "2026-07-24"]) {
    store.seed(
      await dailyObjectKey(olderDate),
      {
        ...(await objectMetadata(encrypted, olderDate)),
        createdDate: olderDate,
      },
      new TextEncoder().encode("{}"),
      "B".repeat(43),
    );
  }

  const state: MutableTargetState = {
    snapshot: cloneSnapshot(options?.target ?? source),
    attestationFailure: false,
    ordinaryImportFailure: false,
    promotionFailure: false,
  };
  const claimOnce = vi.fn(async (targetId: string) => {
    expect(targetId).toBe(TARGET_ID);
    return true;
  });
  const clearTarget = vi.fn(
    async (
      databaseUrl: string,
      targetId: string,
      rowCounts: ReturnType<typeof countSnapshotRows>,
    ) => {
      expect(databaseUrl).toBe(DATABASE_URL);
      expect(targetId).toBe(TARGET_ID);
      if (state.attestationFailure) {
        throw new Error(
          `${PRIVATE_SENTINEL} synthetic target attestation failure`,
        );
      }
      if (
        JSON.stringify(rowCounts) !==
        JSON.stringify(countSnapshotRows(state.snapshot))
      ) {
        throw new Error(
          `${PRIVATE_SENTINEL} synthetic prepared count mismatch`,
        );
      }
      state.snapshot = emptySnapshot();
      return {
        cleared: true as const,
        authoritativeTableCount: 29 as const,
        totalRows: 0 as const,
        nonemptyTables: 0 as const,
        eventRows: 0 as const,
      };
    },
  );
  const close = vi.fn(async () => undefined);
  const createTarget = vi.fn(async (databaseUrl: string, targetId: string) => {
    const databaseBindingMatches = databaseUrl === DATABASE_URL;
    const targetIdentityMatches = targetId === TARGET_ID;
    expect(databaseBindingMatches).toBe(true);
    expect(targetIdentityMatches).toBe(true);
    return memoryManagedTarget(state, close);
  });
  const readback = options?.readback ?? cloneSnapshot;
  const catalogReader = Object.freeze({
    head: store.head.bind(store),
    get: store.get.bind(store),
    list: store.list.bind(store),
  });
  const dependencies: TemporaryPreviewRestoreDependencies = {
    store: catalogReader,
    backupKey: key,
    attemptStore: { claimOnce },
    clearTarget,
    createTarget,
    async readTargetSnapshot(databaseUrl) {
      const databaseBindingMatches = databaseUrl === DATABASE_URL;
      expect(databaseBindingMatches).toBe(true);
      return readback(cloneSnapshot(state.snapshot));
    },
    countReadableEvents:
      options?.countReadableEvents ??
      (async (databaseUrl) => {
        const databaseBindingMatches = databaseUrl === DATABASE_URL;
        expect(databaseBindingMatches).toBe(true);
        return state.snapshot.tables.audit_events.length;
      }),
  };
  expect(Object.keys(dependencies.store).sort()).toEqual([
    "get",
    "head",
    "list",
  ]);
  expect("delete" in dependencies.store).toBe(false);
  expect("putIfAbsent" in dependencies.store).toBe(false);

  return {
    environment: {
      VISION_ENV: "preview",
      PREVIEW_RESTORE_DATABASE_URL: DATABASE_URL,
      PREVIEW_RESTORE_TARGET_ID: TARGET_ID,
    },
    dependencies,
    store,
    backupKey: key,
    encrypted,
    objectKey,
    state,
    createTarget,
    claimOnce,
    clearTarget,
    close,
    privateSentinel: PRIVATE_SENTINEL,
  };
}

async function reencryptMutatedPayload(
  encrypted: EncryptedBackup,
  key: BackupEncryptionKey,
  mutate: (payload: Record<string, unknown>) => void,
): Promise<EncryptedBackup> {
  const plaintext = await decryptBackupEnvelope(encrypted, key);
  const payload = JSON.parse(
    new TextDecoder().decode(plaintext),
  ) as Record<string, unknown>;
  mutate(payload);
  return encryptBackupEnvelope(
    new TextEncoder().encode(JSON.stringify(payload)),
    key,
  );
}

describe("temporary preview restore", () => {
  it("returns no record for configuration failure before a claim can exist", async () => {
    const fixture = await restoreFixture();
    const result = await runTemporaryPreviewRestore(
      {
        ...fixture.environment,
        VISION_ENV: "production",
      },
      fixture.dependencies,
    );

    expect(result).toBeNull();
    expect(fixture.store.listCalls).toHaveLength(0);
    expect(fixture.claimOnce).not.toHaveBeenCalled();
    expect(fixture.clearTarget).not.toHaveBeenCalled();
    expect(fixture.createTarget).not.toHaveBeenCalled();
    expectPrivateValuesAbsent(JSON.stringify(result), [
      fixture.privateSentinel,
    ]);
  });

  it.each([
    "empty list",
    "malformed candidate",
    "ambiguous newest date",
    "wrong key version",
  ])("fails closed for %s", async (scenario) => {
    const fixture = await restoreFixture();
    if (scenario === "empty list") {
      fixture.store.objects.clear();
    } else if (scenario === "malformed candidate") {
      fixture.store.seed(
        `${BACKUP_OBJECT_PREFIX}private-malformed-candidate`,
        await objectMetadata(fixture.encrypted),
      );
    } else if (scenario === "ambiguous newest date") {
      fixture.store.seed(
        `${BACKUP_OBJECT_PREFIX}2026/07/25/${"Z".repeat(43)}.vision-backup`,
        await objectMetadata(fixture.encrypted),
        new TextEncoder().encode("{}"),
        "C".repeat(43),
      );
    } else {
      fixture.store.replaceMetadata(fixture.objectKey, {
        ...(await objectMetadata(fixture.encrypted)),
        keyVersion: "8",
      });
    }

    const result = await runTemporaryPreviewRestore(
      fixture.environment,
      fixture.dependencies,
    );

    expect(result).toBeNull();
    expectPrivateValuesAbsent(JSON.stringify(result), [
      fixture.privateSentinel,
    ]);
    expect(fixture.claimOnce).not.toHaveBeenCalled();
    expect(fixture.clearTarget).not.toHaveBeenCalled();
    expect(fixture.createTarget).not.toHaveBeenCalled();
  });

  it.each([
    "metadata",
    "body",
    "envelope",
    "manifest",
    "checksum",
  ])("rejects tampered %s before opening the target", async (tampering) => {
    const fixture = await restoreFixture();
    if (tampering === "metadata") {
      fixture.store.replaceMetadata(fixture.objectKey, {
        ...(await objectMetadata(fixture.encrypted)),
        ciphertextSha256: "A".repeat(43),
      });
    } else if (tampering === "body") {
      fixture.store.corruptReads = true;
    } else if (tampering === "envelope") {
      const body = new TextEncoder().encode(
        JSON.stringify({
          ...fixture.encrypted,
          algorithm: "synthetic-invalid",
        }),
      );
      fixture.store.seed(
        fixture.objectKey,
        await objectMetadata(fixture.encrypted),
        body,
        await sha256Base64Url(body),
      );
    } else {
      const mutated = await reencryptMutatedPayload(
        fixture.encrypted,
        fixture.backupKey,
        (payload) => {
          const manifest = payload.manifest as Record<string, unknown>;
          if (tampering === "manifest") {
            manifest.schemaVersion = 8;
          } else {
            manifest.plaintextSha256 = "A".repeat(43);
          }
        },
      );
      await seedEncryptedObject(
        fixture.store,
        fixture.objectKey,
        CREATED_DATE,
        mutated,
      );
    }

    const result = await runTemporaryPreviewRestore(
      fixture.environment,
      fixture.dependencies,
    );

    expect(result).toBeNull();
    expect(fixture.createTarget).not.toHaveBeenCalled();
    expect(fixture.claimOnce).not.toHaveBeenCalled();
    expect(fixture.clearTarget).not.toHaveBeenCalled();
    expectPrivateValuesAbsent(JSON.stringify(result), [
      fixture.privateSentinel,
    ]);
  });

  it("fails closed on target-clear attestation mismatch before opening the importer pool", async () => {
    const fixture = await restoreFixture();
    fixture.state.attestationFailure = true;

    await expect(
      runTemporaryPreviewRestore(
        fixture.environment,
        fixture.dependencies,
      ),
    ).resolves.toMatchObject({
      outcome: "failed",
      category: "restore_target_attestation_failed",
    });
    expect(fixture.claimOnce).toHaveBeenCalledOnce();
    expect(fixture.clearTarget).toHaveBeenCalledOnce();
    expect(fixture.createTarget).not.toHaveBeenCalled();
    expect(fixture.close).not.toHaveBeenCalled();
  });

  it("clears only a target whose counts exactly match the prepared backup before restoring", async () => {
    const nonEmpty = sourceSnapshot();
    const fixture = await restoreFixture({ target: nonEmpty });

    await expect(
      runTemporaryPreviewRestore(
        fixture.environment,
        fixture.dependencies,
      ),
    ).resolves.toMatchObject({ outcome: "succeeded", targetWasEmpty: true });
    expect(fixture.claimOnce).toHaveBeenCalledOnce();
    expect(fixture.clearTarget).toHaveBeenCalledWith(
      DATABASE_URL,
      TARGET_ID,
      countSnapshotRows(nonEmpty),
    );
    expect(fixture.createTarget).toHaveBeenCalledOnce();
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it("burns the owned attempt and returns a closed failure when prepared counts do not match the target", async () => {
    const fixture = await restoreFixture({ target: emptySnapshot() });

    const result = await runTemporaryPreviewRestore(
      fixture.environment,
      fixture.dependencies,
    );

    expect(result).toEqual({
      evidenceType: "vision.preview-restore/v1",
      outcome: "failed",
      category: "restore_target_attestation_failed",
    });
    expect(fixture.claimOnce).toHaveBeenCalledOnce();
    expect(fixture.clearTarget).toHaveBeenCalledOnce();
    expect(fixture.createTarget).not.toHaveBeenCalled();
    expect(fixture.close).not.toHaveBeenCalled();
    expectPrivateValuesAbsent(JSON.stringify(result), [
      fixture.privateSentinel,
      TARGET_ID,
      fixture.objectKey,
    ]);
  });

  it("returns promotion failure only after the target transaction rolls back", async () => {
    const fixture = await restoreFixture();
    fixture.state.promotionFailure = true;

    await expect(
      runTemporaryPreviewRestore(
        fixture.environment,
        fixture.dependencies,
      ),
    ).resolves.toMatchObject({
      outcome: "failed",
      category: "restore_promotion_failed",
    });
    expect(countSnapshotRows(fixture.state.snapshot)).toEqual(
      countSnapshotRows(emptySnapshot()),
    );
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it("maps an ordinary unexpected importer error to unknown failure", async () => {
    const fixture = await restoreFixture();
    fixture.state.ordinaryImportFailure = true;

    await expect(
      runTemporaryPreviewRestore(
        fixture.environment,
        fixture.dependencies,
      ),
    ).resolves.toMatchObject({
      outcome: "failed",
      category: "restore_unknown_failure",
    });
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it("returns closed success evidence for all 29 authoritative tables after independent read-back", async () => {
    const fixture = await restoreFixture();

    const result = await runTemporaryPreviewRestore(
      fixture.environment,
      fixture.dependencies,
    );

    expect(result).toEqual({
      evidenceType: "vision.preview-restore/v1",
      outcome: "succeeded",
      category: "none",
      format: BACKUP_FORMAT_V1,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      keyVersion: KEY_VERSION,
      authoritativeTableCount: 29,
      rowCounts: countSnapshotRows(sourceSnapshot()),
      checksumMatches: true,
      referencesValid: true,
      targetWasEmpty: true,
      eventListReadable: true,
      eventCount: 1,
      replacedExisting: false,
    });
    if (!result) throw new Error("Expected owner restore evidence.");
    expect(Object.keys(result.rowCounts ?? {})).toHaveLength(
      BACKUP_TABLES.length,
    );
    expect(fixture.store.listCalls).toHaveLength(2);
    expect(
      fixture.store.listCalls.every(
        (prefix) => prefix === BACKUP_OBJECT_PREFIX,
      ),
    ).toBe(true);
    expect(fixture.claimOnce).toHaveBeenCalledOnce();
    expect(fixture.clearTarget).toHaveBeenCalledOnce();
    expect(fixture.close).toHaveBeenCalledOnce();
    expectPrivateValuesAbsent(JSON.stringify(result), [
      fixture.privateSentinel,
      TARGET_ID,
      fixture.objectKey,
    ]);
  });

  it("restores the exact prepared object that was fully validated before the fence", async () => {
    const fixture = await restoreFixture();
    let preparedBeforeFence: PreparedBackupImport | undefined;
    const prepareImport = vi.fn(
      async (
        encrypted: EncryptedBackup,
        key: BackupEncryptionKey,
      ) => {
        preparedBeforeFence = await prepareBackupImport(encrypted, key);
        return preparedBeforeFence;
      },
    );
    const importPrepared = vi.fn(
      async (
        prepared: PreparedBackupImport,
        target: BackupRestoreTarget,
        options?: ImportBackupOptions,
      ) => {
        expect(prepared).toBe(preparedBeforeFence);
        return importPreparedBackup(prepared, target, options);
      },
    );

    await expect(
      runTemporaryPreviewRestore(fixture.environment, {
        ...fixture.dependencies,
        prepareImport,
        importPrepared,
      }),
    ).resolves.toMatchObject({ outcome: "succeeded" });

    expect(prepareImport).toHaveBeenCalledOnce();
    expect(fixture.claimOnce).toHaveBeenCalledOnce();
    expect(importPrepared).toHaveBeenCalledOnce();
  });

  it("rejects a read-back row-count mismatch", async () => {
    const fixture = await restoreFixture({
      readback(snapshot) {
        (snapshot.tables.audit_events as BackupRow[]).push({
          ...auditRow("extra"),
          id: "audit-2",
        });
        return snapshot;
      },
    });

    await expect(
      runTemporaryPreviewRestore(
        fixture.environment,
        fixture.dependencies,
      ),
    ).resolves.toMatchObject({
      outcome: "failed",
      category: "restore_readback_verification_failed",
    });
  });

  it("rejects a read-back reference failure with unchanged row counts", async () => {
    const fixture = await restoreFixture({
      readback(snapshot) {
        (snapshot.tables.audit_events as BackupRow[])[0] = {
          ...snapshot.tables.audit_events[0]!,
          node_id: "missing-node",
        };
        return snapshot;
      },
    });

    await expect(
      runTemporaryPreviewRestore(
        fixture.environment,
        fixture.dependencies,
      ),
    ).resolves.toMatchObject({
      outcome: "failed",
      category: "restore_readback_verification_failed",
    });
  });

  it("rejects a read-back archive checksum mismatch with unchanged counts and valid references", async () => {
    const fixture = await restoreFixture({
      readback(snapshot) {
        (snapshot.tables.audit_events as BackupRow[])[0] = {
          ...snapshot.tables.audit_events[0]!,
          action: "readback.changed",
        };
        return snapshot;
      },
    });

    await expect(
      runTemporaryPreviewRestore(
        fixture.environment,
        fixture.dependencies,
      ),
    ).resolves.toMatchObject({
      outcome: "failed",
      category: "restore_readback_verification_failed",
    });
  });

  it("rejects an unreadable event listing", async () => {
    const fixture = await restoreFixture({
      countReadableEvents: async () => {
        throw new Error("Synthetic event listing failure.");
      },
    });

    await expect(
      runTemporaryPreviewRestore(
        fixture.environment,
        fixture.dependencies,
      ),
    ).resolves.toMatchObject({
      outcome: "failed",
      category: "restore_readback_verification_failed",
    });
  });

  it("makes a delayed post-restore invocation a non-owner with zero additional database work", async () => {
    const fixture = await restoreFixture();
    let claimed = false;
    fixture.claimOnce.mockImplementation(async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    });

    await expect(
      runTemporaryPreviewRestore(
        fixture.environment,
        fixture.dependencies,
      ),
    ).resolves.toMatchObject({ outcome: "succeeded" });
    const afterFirstRestoreDigest = await snapshotDigest(
      fixture.state.snapshot,
    );
    await expect(
      runTemporaryPreviewRestore(
        fixture.environment,
        fixture.dependencies,
      ),
    ).resolves.toBeNull();

    const repeatedRestoreLeftTargetUnchanged =
      (await snapshotDigest(fixture.state.snapshot)) ===
      afterFirstRestoreDigest;
    expect(repeatedRestoreLeftTargetUnchanged).toBe(true);
    expect(fixture.claimOnce).toHaveBeenCalledTimes(2);
    expect(fixture.clearTarget).toHaveBeenCalledOnce();
    expect(fixture.createTarget).toHaveBeenCalledOnce();
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it("allows exactly one concurrent claimant to clear, restore, and return evidence", async () => {
    const fixture = await restoreFixture();
    let claimed = false;
    fixture.claimOnce.mockImplementation(async () => {
      await Promise.resolve();
      if (claimed) return false;
      claimed = true;
      return true;
    });

    const results = await Promise.all([
      runTemporaryPreviewRestore(
        fixture.environment,
        fixture.dependencies,
      ),
      runTemporaryPreviewRestore(
        fixture.environment,
        fixture.dependencies,
      ),
    ]);

    expect(results.filter((result) => result === null)).toHaveLength(1);
    expect(
      results.filter((result) => result?.outcome === "succeeded"),
    ).toHaveLength(1);
    expect(fixture.clearTarget).toHaveBeenCalledOnce();
    expect(fixture.createTarget).toHaveBeenCalledOnce();
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it("returns no record and performs no database work when the opaque claim cannot be resolved", async () => {
    const fixture = await restoreFixture();
    fixture.claimOnce.mockRejectedValue(
      new Error(
        `${fixture.privateSentinel} ${TARGET_ID} ${fixture.objectKey}`,
      ),
    );
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await runTemporaryPreviewRestore(
      fixture.environment,
      fixture.dependencies,
    );

    expect(result).toBeNull();
    expect(fixture.clearTarget).not.toHaveBeenCalled();
    expect(fixture.createTarget).not.toHaveBeenCalled();
    expect(fixture.close).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    info.mockRestore();
    error.mockRestore();
  });

  it("rejects negative, fractional, and unsafe event counts", async () => {
    for (const eventCount of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      const fixture = await restoreFixture({
        countReadableEvents: async () => eventCount,
      });
      await expect(
        runTemporaryPreviewRestore(
          fixture.environment,
          fixture.dependencies,
        ),
      ).resolves.toMatchObject({
        outcome: "failed",
        category: "restore_readback_verification_failed",
      });
    }
  });
});

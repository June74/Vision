import { describe, expect, it, vi } from "vitest";
import {
  createR2RestoreAttemptStore,
  RESTORE_ATTEMPT_PREFIX,
} from "../../../src/data/backup/r2-restore-attempt-store";
import { BACKUP_OBJECT_PREFIX } from "../../../src/jobs/create-daily-backup";

const PRIVATE_TARGET = "private_disposable_target_sentinel";
const PRIVATE_PROVIDER_RESULT = "private_provider_result_sentinel";

function claimedObject(key: string): R2Object {
  return {
    key,
    version: "version-1",
    size: 0,
    etag: "etag-1",
    httpEtag: '"etag-1"',
    uploaded: new Date("2026-07-27T00:00:00.000Z"),
    httpMetadata: {},
    customMetadata: {},
    range: undefined,
    checksums: {},
    storageClass: "Standard",
    writeHttpMetadata() {},
  } as unknown as R2Object;
}

describe("opaque R2 restore-attempt fence", () => {
  it("atomically grants exactly one owner across concurrent claims", async () => {
    let exists = false;
    const put = vi.fn(
      async (
        key: string,
        _body: Uint8Array,
        _options: R2PutOptions,
      ) => {
      await Promise.resolve();
      if (exists) return null;
      exists = true;
      return claimedObject(key);
      },
    );
    const store = createR2RestoreAttemptStore({
      put,
    } as unknown as R2Bucket);

    const results = await Promise.all([
      store.claimOnce(PRIVATE_TARGET),
      store.claimOnce(PRIVATE_TARGET),
    ]);

    expect(results.sort()).toEqual([false, true]);
    expect(put).toHaveBeenCalledTimes(2);
    const keys = put.mock.calls.map(([key]) => key);
    expect(new Set(keys)).toHaveLength(1);
    expect(keys[0]).toMatch(/^restore-attempts\/v1\/[A-Za-z0-9_-]{43}$/u);
    expect(keys[0]).not.toContain(PRIVATE_TARGET);
    for (const call of put.mock.calls) {
      expect(call[1]).toEqual(new Uint8Array());
      expect(call[2]).toEqual({
        onlyIf: { etagDoesNotMatch: "*" },
      });
    }
  });

  it("keeps the fixed attempt namespace disjoint from backup listing and retention", () => {
    expect(RESTORE_ATTEMPT_PREFIX).toBe("restore-attempts/v1/");
    expect(RESTORE_ATTEMPT_PREFIX).not.toBe(BACKUP_OBJECT_PREFIX);
    expect(RESTORE_ATTEMPT_PREFIX.startsWith(BACKUP_OBJECT_PREFIX)).toBe(
      false,
    );
    expect(BACKUP_OBJECT_PREFIX.startsWith(RESTORE_ATTEMPT_PREFIX)).toBe(
      false,
    );
  });

  it("closes provider failures without exposing the target, marker, result, or logs", async () => {
    const privateMarker =
      `${RESTORE_ATTEMPT_PREFIX}${"P".repeat(43)}`;
    const put = vi.fn(async () => {
      throw new Error(
        `${PRIVATE_TARGET} ${privateMarker} ${PRIVATE_PROVIDER_RESULT}`,
      );
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = createR2RestoreAttemptStore({
      put,
    } as unknown as R2Bucket);

    let rendered = "";
    try {
      await store.claimOnce(PRIVATE_TARGET);
    } catch (failure) {
      rendered = failure instanceof Error ? failure.message : String(failure);
    }

    expect(rendered).toBe("Restore attempt claim failed.");
    for (const forbidden of [
      PRIVATE_TARGET,
      privateMarker,
      PRIVATE_PROVIDER_RESULT,
    ]) {
      expect(rendered).not.toContain(forbidden);
    }
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    info.mockRestore();
    error.mockRestore();
  });
});

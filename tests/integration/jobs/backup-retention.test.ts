import { describe, expect, it } from "vitest";
import {
  BACKUP_OBJECT_PREFIX,
  type BackupObjectMetadata,
} from "../../../src/jobs/create-daily-backup";
import { purgeExpiredBackups } from "../../../src/jobs/purge-expired-backups";
import { MemoryBackupObjectStore } from "./backup-test-helpers";

const NOW = new Date("2026-08-31T23:59:59.999Z");

function metadata(createdDate: string): BackupObjectMetadata {
  return {
    format: "vision-backup/v1",
    createdDate,
    ciphertextSha256: "A".repeat(43),
    keyVersion: "7",
  };
}

function key(createdDate: string, opaque = "A".repeat(43)): string {
  const [year, month, day] = createdDate.split("-");
  return `${BACKUP_OBJECT_PREFIX}${year}/${month}/${day}/${opaque}.vision-backup`;
}

describe("encrypted backup retention", () => {
  it("keeps 29-day objects and purges the 30-day boundary and older objects", async () => {
    const store = new MemoryBackupObjectStore();
    store.seed(key("2026-08-02"), metadata("2026-08-02"));
    store.seed(key("2026-08-01"), metadata("2026-08-01"));
    store.seed(key("2026-07-31"), metadata("2026-07-31"));

    await expect(purgeExpiredBackups(NOW, { store })).resolves.toEqual({
      purged: 2,
      ignoredMalformed: 0,
    });
    expect([...store.objects.keys()]).toEqual([key("2026-08-02")]);
    expect(store.listCalls.every((prefix) => prefix === BACKUP_OBJECT_PREFIX)).toBe(
      true,
    );
  });

  it("ignores malformed names and metadata with diagnostics that do not echo object keys", async () => {
    const store = new MemoryBackupObjectStore();
    const malformedName =
      "backups/v1/private-user@example.test/not-a-valid-backup";
    const mismatchedMetadata = key("2026-07-30", "B".repeat(43));
    store.seed(malformedName, metadata("2026-07-30"));
    store.seed(mismatchedMetadata, metadata("2026-07-29"));
    store.seed(
      "outside-prefix/2026/07/30/" + "C".repeat(43) + ".vision-backup",
      metadata("2026-07-30"),
    );

    const result = await purgeExpiredBackups(NOW, { store });
    expect(result).toEqual({ purged: 0, ignoredMalformed: 2 });
    expect(JSON.stringify(result)).not.toContain("private-user");
    expect(store.objects).toHaveLength(3);
  });

  it("is retryable and idempotent when deletion fails", async () => {
    const store = new MemoryBackupObjectStore();
    const expired = key("2026-08-01");
    store.seed(expired, metadata("2026-08-01"));
    store.deleteFailuresRemaining = 1;

    await expect(purgeExpiredBackups(NOW, { store })).rejects.toThrow(
      /backup retention/i,
    );
    expect(store.objects.has(expired)).toBe(true);
    await expect(purgeExpiredBackups(NOW, { store })).resolves.toEqual({
      purged: 1,
      ignoredMalformed: 0,
    });
    await expect(purgeExpiredBackups(NOW, { store })).resolves.toEqual({
      purged: 0,
      ignoredMalformed: 0,
    });
  });
});

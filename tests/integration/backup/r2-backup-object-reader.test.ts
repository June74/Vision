import { describe, expect, it, vi } from "vitest";
import { createR2BackupObjectCatalogReader } from "../../../src/data/backup/r2-backup-object-reader";

describe("read-only R2 backup object catalog", () => {
  it("exposes only head, get, and list without any write/delete capability", async () => {
    const bucket = {
      head: vi.fn(async () => ({
        key: "opaque",
        etag: "etag",
        customMetadata: { format: "vision-backup/v1" },
      })),
      get: vi.fn(async () => ({
        key: "opaque",
        etag: "etag",
        customMetadata: { format: "vision-backup/v1" },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })),
      list: vi.fn(async () => ({
        objects: [
          {
            key: "opaque",
            etag: "etag",
            customMetadata: { format: "vision-backup/v1" },
          },
        ],
        truncated: false,
      })),
    };

    const reader = createR2BackupObjectCatalogReader(bucket as never);

    expect(Object.keys(reader).sort()).toEqual(["get", "head", "list"]);
    expect("put" in reader).toBe(false);
    expect("delete" in reader).toBe(false);
    expect("putIfAbsent" in reader).toBe(false);
    await expect(reader.head("opaque")).resolves.toMatchObject({ key: "opaque" });
    await expect(reader.get("opaque")).resolves.toMatchObject({
      key: "opaque",
      body: new Uint8Array([1, 2, 3]),
    });
    await expect(reader.list("prefix/")).resolves.toMatchObject({
      objects: [{ key: "opaque" }],
    });
  });

  it("bounds metadata and fails closed without returning provider objects", async () => {
    const bucket = {
      head: vi.fn(async () => ({
        key: "x".repeat(2_049),
        etag: "etag",
        customMetadata: {},
      })),
      get: vi.fn(),
      list: vi.fn(),
    };
    const reader = createR2BackupObjectCatalogReader(bucket as never);
    await expect(reader.head("opaque")).rejects.toThrow(
      "Backup object catalog read failed.",
    );
  });
});

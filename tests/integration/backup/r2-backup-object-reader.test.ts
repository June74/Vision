import { describe, expect, it, vi } from "vitest";
import { createR2BackupObjectCatalogReader } from "../../../src/data/backup/r2-backup-object-reader";

describe("read-only R2 backup object catalog", () => {
  const metadata = {
    format: "vision-backup/v1",
    createdDate: "2026-07-30",
    ciphertextSha256: "a".repeat(43),
    keyVersion: "1",
  };

  it("exposes only head, get, and list without any write/delete capability", async () => {
    const bucket = {
      head: vi.fn(async () => ({
        key: "opaque",
        etag: "etag",
        customMetadata: metadata,
      })),
      get: vi.fn(async () => ({
        key: "opaque",
        etag: "etag",
        customMetadata: metadata,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })),
      list: vi.fn(async () => ({
        objects: [
          {
            key: "opaque",
            etag: "etag",
            customMetadata: metadata,
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

  it("rejects unknown, accessor, symbol, inherited, and semantic-duplicate metadata", async () => {
    let getterCalls = 0;
    const hostile = [
      { format: "vision-backup/v1", unknown: "x" },
      Object.defineProperty({}, "format", {
        enumerable: true,
        get() { getterCalls += 1; return "vision-backup/v1"; },
      }),
      { format: "vision-backup/v1", [Symbol("private")]: "x" },
      Object.assign(Object.create({ inherited: "x" }), { format: "vision-backup/v1" }),
      { format: "vision-backup/v1", Format: "vision-backup/v1" },
    ];
    for (const customMetadata of hostile) {
      const reader = createR2BackupObjectCatalogReader({
        head: vi.fn(async () => ({ key: "opaque", etag: "etag", customMetadata })),
        get: vi.fn(),
        list: vi.fn(),
      } as never);
      await expect(reader.head("opaque")).rejects.toThrow(
        "Backup object catalog read failed.",
      );
    }
    expect(getterCalls).toBe(0);
  });
});

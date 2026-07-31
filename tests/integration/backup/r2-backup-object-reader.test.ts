import { describe, expect, it, vi } from "vitest";
import { createR2BackupObjectCatalogReader } from "../../../src/data/backup/r2-backup-object-reader";

const MAX_RESTORE_BACKUP_OBJECT_BYTES = 8_389_144;
const MAX_RESTORE_CATALOG_PAGE_OBJECTS = 64;

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
        size: 3,
        customMetadata: metadata,
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            controller.close();
          },
        }),
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

  it("accepts an object body at the exact fixed byte limit", async () => {
    const body = new Uint8Array(MAX_RESTORE_BACKUP_OBJECT_BYTES);
    const reader = createR2BackupObjectCatalogReader({
      head: vi.fn(),
      get: vi.fn(async () => ({
        key: "opaque",
        etag: "etag",
        size: body.byteLength,
        customMetadata: metadata,
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(body);
            controller.close();
          },
        }),
      })),
      list: vi.fn(),
    } as never);

    await expect(reader.get("opaque")).resolves.toMatchObject({
      body: expect.objectContaining({ byteLength: MAX_RESTORE_BACKUP_OBJECT_BYTES }),
    });
  });

  it("rejects max plus one from provider metadata before reading or allocating the body", async () => {
    let bodyReads = 0;
    let arrayBufferReads = 0;
    const reader = createR2BackupObjectCatalogReader({
      head: vi.fn(),
      get: vi.fn(async () => ({
        key: "opaque",
        etag: "etag",
        size: MAX_RESTORE_BACKUP_OBJECT_BYTES + 1,
        customMetadata: metadata,
        get body() {
          bodyReads += 1;
          throw new Error("body must remain unread");
        },
        async arrayBuffer() {
          arrayBufferReads += 1;
          return new ArrayBuffer(0);
        },
      })),
      list: vi.fn(),
    } as never);

    await expect(reader.get("opaque")).rejects.toThrow(
      "Backup object catalog read failed.",
    );
    expect(bodyReads).toBe(0);
    expect(arrayBufferReads).toBe(0);
  });

  it.each([
    { declared: 2, actual: new Uint8Array([1, 2, 3]) },
    { declared: 3, actual: new Uint8Array([1, 2]) },
  ])("rejects provider body metadata and stream length mismatch", async ({ declared, actual }) => {
    const reader = createR2BackupObjectCatalogReader({
      head: vi.fn(),
      get: vi.fn(async () => ({
        key: "opaque",
        etag: "etag",
        size: declared,
        customMetadata: metadata,
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(actual);
            controller.close();
          },
        }),
        arrayBuffer: async () => actual.buffer,
      })),
      list: vi.fn(),
    } as never);

    await expect(reader.get("opaque")).rejects.toThrow(
      "Backup object catalog read failed.",
    );
  });

  it("accepts exactly one bounded provider page and requests that fixed limit", async () => {
    const list = vi.fn(async () => ({
      objects: Array.from({ length: MAX_RESTORE_CATALOG_PAGE_OBJECTS }, (_, index) => ({
        key: `opaque-${index}`,
        etag: "etag",
        customMetadata: metadata,
      })),
      truncated: false,
    }));
    const reader = createR2BackupObjectCatalogReader({
      head: vi.fn(),
      get: vi.fn(),
      list,
    } as never);

    await expect(reader.list("prefix/")).resolves.toMatchObject({
      objects: { length: MAX_RESTORE_CATALOG_PAGE_OBJECTS },
    });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({
      limit: MAX_RESTORE_CATALOG_PAGE_OBJECTS,
    }));
  });

  it("rejects a provider page with more than the requested object limit", async () => {
    const reader = createR2BackupObjectCatalogReader({
      head: vi.fn(),
      get: vi.fn(),
      list: vi.fn(async () => ({
        objects: Array.from({ length: MAX_RESTORE_CATALOG_PAGE_OBJECTS + 1 }, (_, index) => ({
          key: `opaque-${index}`,
          etag: "etag",
          customMetadata: metadata,
        })),
        truncated: false,
      })),
    } as never);

    await expect(reader.list("prefix/")).rejects.toThrow(
      "Backup object catalog read failed.",
    );
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

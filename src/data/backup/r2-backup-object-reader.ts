/** Provides a bounded read-only R2 catalog for temporary restore. */
import { encodeBase64Url } from "../../crypto/envelope";
import type { BackupObjectCatalogReader, BackupObjectHead } from "../../jobs/create-daily-backup";

const FAILURE = "Backup object catalog read failed.";
type ReadOnlyBucket = Pick<R2Bucket, "head" | "get" | "list">;

/** Creates a catalog adapter without write or delete methods. */
export function createR2BackupObjectCatalogReader(bucket: ReadOnlyBucket): BackupObjectCatalogReader {
  return Object.freeze({
    /** Reads bounded metadata for one object. */
    async head(key: string) {
      try {
        bounded(key);
        const object = await bucket.head(key);
        return object === null ? null : adapt(object);
      } catch { throw new Error(FAILURE); }
    },
    /** Reads and copies one bounded object body. */
    async get(key: string) {
      try {
        bounded(key);
        const object = await bucket.get(key);
        if (object === null) return null;
        return Object.freeze({ ...adapt(object), body: new Uint8Array(await object.arrayBuffer()) });
      } catch { throw new Error(FAILURE); }
    },
    /** Lists one bounded page of object metadata. */
    async list(prefix: string, cursor?: string) {
      try {
        bounded(prefix);
        if (cursor !== undefined) bounded(cursor);
        const page = await bucket.list({
          prefix,
          ...(cursor ? { cursor } : {}),
          include: ["customMetadata"],
        });
        return Object.freeze({
          objects: Object.freeze(page.objects.map(adapt)),
          ...(page.truncated && page.cursor ? { cursor: bounded(page.cursor) } : {}),
        });
      } catch { throw new Error(FAILURE); }
    },
  });
}

/** Copies only bounded allowlisted provider metadata. */
function adapt(object: {
  readonly key: string;
  readonly etag: string;
  readonly customMetadata?: Record<string, string>;
  readonly checksums?: { readonly sha256?: ArrayBuffer };
}): BackupObjectHead {
  const metadata = exactMetadata(object.customMetadata);
  const checksum = object.checksums?.sha256;
  return Object.freeze({
    key: bounded(object.key),
    etag: bounded(object.etag, 512),
    customMetadata: metadata,
    ...(checksum instanceof ArrayBuffer
      ? {
          bodySha256: encodeBase64Url(new Uint8Array(checksum)),
        }
      : {}),
  });
}

/** Reconstructs only the exact restore metadata vocabulary without getters. */
function exactMetadata(
  value: unknown,
): Readonly<Record<string, string>> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error(FAILURE);
  }
  const record = value as Record<string, unknown>;
  const expected = [
    "ciphertextSha256",
    "createdDate",
    "format",
    "keyVersion",
  ] as const;
  const keys = Reflect.ownKeys(record);
  if (
    keys.length !== expected.length ||
    keys.some((key) => typeof key !== "string") ||
    new Set(keys.map((key) => String(key).toLowerCase())).size !== keys.length ||
    !expected.every((key) => keys.includes(key))
  ) {
    throw new Error(FAILURE);
  }
  const result: Record<string, string> = {};
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (
      descriptor?.enumerable !== true ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string"
    ) {
      throw new Error(FAILURE);
    }
    result[key] = bounded(descriptor.value, 1_024);
  }
  if (
    result.format !== "vision-backup/v1" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(result.createdDate!) ||
    !/^[A-Za-z0-9_-]{43}$/u.test(result.ciphertextSha256!) ||
    !/^[1-9][0-9]*$/u.test(result.keyVersion!) ||
    !Number.isSafeInteger(Number(result.keyVersion))
  ) {
    throw new Error(FAILURE);
  }
  return Object.freeze(result);
}

/** Rejects empty or oversized provider strings. */
function bounded(value: string, limit = 2_048): string {
  if (typeof value !== "string" || value.length === 0 || value.length > limit) throw new Error(FAILURE);
  return value;
}

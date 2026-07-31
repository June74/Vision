/** Provides a bounded read-only R2 catalog for temporary restore. */
import { MAX_BACKUP_PLAINTEXT_BYTES } from "../../crypto/backup-envelope";
import { encodeBase64Url } from "../../crypto/envelope";
import type { BackupObjectCatalogReader, BackupObjectHead } from "../../jobs/create-daily-backup";

const FAILURE = "Backup object catalog read failed.";
/** Maximum serialized encrypted object derived from the fixed v1 plaintext limit. */
export const MAX_RESTORE_BACKUP_OBJECT_BYTES =
  Math.ceil((MAX_BACKUP_PLAINTEXT_BYTES + 16) / 3) * 4 + 512;
/** Maximum provider objects admitted from one catalog page. */
export const MAX_RESTORE_CATALOG_PAGE_OBJECTS = 64;
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
        return Object.freeze({ ...adapt(object), body: await readBoundedBody(object) });
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
          limit: MAX_RESTORE_CATALOG_PAGE_OBJECTS,
        });
        if (
          !Array.isArray(page.objects) ||
          page.objects.length > MAX_RESTORE_CATALOG_PAGE_OBJECTS
        ) {
          throw new Error(FAILURE);
        }
        return Object.freeze({
          objects: Object.freeze(page.objects.map(adapt)),
          ...(page.truncated && page.cursor ? { cursor: bounded(page.cursor) } : {}),
        });
      } catch { throw new Error(FAILURE); }
    },
  });
}

/** Copies one stream only after its declared size passes the fixed allocation bound. */
async function readBoundedBody(
  object: Pick<R2ObjectBody, "body" | "size">,
): Promise<Uint8Array> {
  if (
    !Number.isSafeInteger(object.size) ||
    object.size <= 0 ||
    object.size > MAX_RESTORE_BACKUP_OBJECT_BYTES
  ) {
    throw new Error(FAILURE);
  }
  const body = new Uint8Array(object.size);
  const reader = object.body.getReader();
  let offset = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (
        !(chunk.value instanceof Uint8Array) ||
        chunk.value.byteLength > object.size - offset
      ) {
        throw new Error(FAILURE);
      }
      body.set(chunk.value, offset);
      offset += chunk.value.byteLength;
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // The closed failure returned by the caller is authoritative.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (offset !== object.size) throw new Error(FAILURE);
  return body;
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

/** Provides a bounded read-only R2 catalog for temporary restore. */
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
        const page = await bucket.list({ prefix, ...(cursor ? { cursor } : {}) });
        return Object.freeze({
          objects: Object.freeze(page.objects.map(adapt)),
          ...(page.truncated && page.cursor ? { cursor: bounded(page.cursor) } : {}),
        });
      } catch { throw new Error(FAILURE); }
    },
  });
}

/** Copies only bounded allowlisted provider metadata. */
function adapt(object: { readonly key: string; readonly etag: string; readonly customMetadata?: Record<string, string> }): BackupObjectHead {
  const entries = Object.entries(object.customMetadata ?? {});
  if (entries.length > 32) throw new Error(FAILURE);
  return Object.freeze({
    key: bounded(object.key),
    etag: bounded(object.etag, 512),
    customMetadata: Object.freeze(Object.fromEntries(entries.map(([key, value]) => [bounded(key, 128), bounded(value, 1_024)]))),
  });
}

/** Rejects empty or oversized provider strings. */
function bounded(value: string, limit = 2_048): string {
  if (typeof value !== "string" || value.length === 0 || value.length > limit) throw new Error(FAILURE);
  return value;
}

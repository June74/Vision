/** Adapts Cloudflare R2 conditional objects to the narrow backup storage port. */
import { decodeBase64Url, encodeBase64Url } from "../../crypto/envelope";
import type {
  BackupObjectHead,
  BackupObjectStore,
} from "../../jobs/create-daily-backup";

/** Creates the R2 adapter with atomic create-if-absent and SHA-256 preservation. */
export function createR2BackupObjectStore(bucket: R2Bucket): BackupObjectStore {
  return {
    /** Creates an object only when the deterministic daily key does not exist. */
    async putIfAbsent(
      key,
      body,
      customMetadata,
      bodySha256,
    ): Promise<boolean> {
      const result = await bucket.put(key, body, {
        onlyIf: { etagDoesNotMatch: "*" },
        customMetadata: { ...customMetadata },
        sha256: decodeBase64Url(bodySha256, "Backup object checksum", 43),
      });
      return result !== null;
    },
    /** Reads object identity, safe custom metadata, and the native body checksum. */
    async head(key) {
      const object = await bucket.head(key);
      return object ? toBackupHead(object) : null;
    },
    /** Reads and owns the encrypted object body together with verified head facts. */
    async get(key) {
      const object = await bucket.get(key);
      if (!object) return null;
      return {
        ...toBackupHead(object),
        body: new Uint8Array(await object.bytes()),
      };
    },
    /** Lists only the caller-supplied fixed prefix and preserves R2 pagination. */
    async list(prefix, cursor) {
      const page = await bucket.list({
        prefix,
        ...(cursor === undefined ? {} : { cursor }),
        include: ["customMetadata"],
      });
      return {
        objects: page.objects.map(toBackupHead),
        ...(page.truncated && page.cursor ? { cursor: page.cursor } : {}),
      };
    },
    /** Deletes one already-validated exact object key. */
    async delete(key) {
      await bucket.delete(key);
    },
  };
}

/** Owns safe metadata and preserves an optional checksum for malformed-object admission. */
function toBackupHead(object: R2Object): BackupObjectHead {
  const sha256 = object.checksums.sha256;
  return Object.freeze({
    key: object.key,
    etag: object.etag,
    customMetadata: Object.freeze({
      ...(object.customMetadata ?? {}),
    }),
    ...(sha256
      ? { bodySha256: encodeBase64Url(new Uint8Array(sha256)) }
      : {}),
  });
}

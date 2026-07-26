import type {
  BackupObjectHead,
  BackupObjectMetadata,
  BackupObjectStore,
} from "../../../src/jobs/create-daily-backup";

interface StoredObject extends BackupObjectHead {
  readonly body: Uint8Array;
}

/** In-memory atomic object store used to exercise the R2-facing job contract. */
export class MemoryBackupObjectStore implements BackupObjectStore {
  readonly objects = new Map<string, StoredObject>();
  putFailure: Error | undefined;
  deleteFailuresRemaining = 0;
  corruptReads = false;
  listCalls: string[] = [];
  private nextEtag = 1;

  async putIfAbsent(
    key: string,
    body: Uint8Array,
    customMetadata: BackupObjectMetadata,
    bodySha256: string,
  ): Promise<boolean> {
    if (this.putFailure) throw this.putFailure;
    if (this.objects.has(key)) return false;
    this.objects.set(key, {
      key,
      etag: `etag-${this.nextEtag++}`,
      customMetadata: Object.fromEntries(Object.entries(customMetadata)),
      bodySha256,
      body: new Uint8Array(body),
    });
    return true;
  }

  async head(key: string): Promise<BackupObjectHead | null> {
    const object = this.objects.get(key);
    return object
      ? {
          key: object.key,
          etag: object.etag,
          customMetadata: { ...object.customMetadata },
          bodySha256: object.bodySha256,
        }
      : null;
  }

  async get(
    key: string,
  ): Promise<(BackupObjectHead & { readonly body: Uint8Array }) | null> {
    const object = this.objects.get(key);
    if (!object) return null;
    const body = new Uint8Array(object.body);
    if (this.corruptReads && body.byteLength > 0) body[0] ^= 1;
    return {
      key: object.key,
      etag: object.etag,
      customMetadata: { ...object.customMetadata },
      bodySha256: object.bodySha256,
      body,
    };
  }

  async list(
    prefix: string,
    cursor?: string,
  ): Promise<{
    readonly objects: readonly BackupObjectHead[];
    readonly cursor?: string;
  }> {
    this.listCalls.push(prefix);
    const matching = [...this.objects.values()]
      .filter((object) => object.key.startsWith(prefix))
      .sort((left, right) => left.key.localeCompare(right.key));
    const start = cursor === undefined ? 0 : Number(cursor);
    const page = matching.slice(start, start + 2).map((object) => ({
      key: object.key,
      etag: object.etag,
      customMetadata: { ...object.customMetadata },
      bodySha256: object.bodySha256,
    }));
    const next = start + page.length;
    return next < matching.length
      ? { objects: page, cursor: String(next) }
      : { objects: page };
  }

  async delete(key: string): Promise<void> {
    if (this.deleteFailuresRemaining > 0) {
      this.deleteFailuresRemaining -= 1;
      throw new Error("safe synthetic deletion failure");
    }
    this.objects.delete(key);
  }

  seed(
    key: string,
    customMetadata: BackupObjectMetadata,
    body: Uint8Array = new TextEncoder().encode("{}"),
    bodySha256 = "A".repeat(43),
  ): void {
    this.objects.set(key, {
      key,
      etag: `etag-${this.nextEtag++}`,
      customMetadata: { ...customMetadata },
      bodySha256,
      body: new Uint8Array(body),
    });
  }

  replaceMetadata(
    key: string,
    customMetadata: Readonly<Record<string, string>>,
  ): void {
    const object = this.objects.get(key);
    if (!object) throw new Error("Missing synthetic object.");
    this.objects.set(key, { ...object, customMetadata });
  }
}

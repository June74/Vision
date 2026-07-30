# r2-backup-object-reader

Adapts `Pick<R2Bucket, "head" | "get" | "list">` to `BackupObjectCatalogReader`.

## `createR2BackupObjectCatalogReader`
Returns exactly `head`, `get`, and `list`.
## `head`
Copies bounded head metadata.
## `get`
Copies the body into `Uint8Array`.
## `list`
Maps provider pagination without mutation capabilities.
## `adapt`
Bounds keys, etags, and custom metadata.
## `bounded`
Enforces string limits.

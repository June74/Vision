# `src/data/backup/r2-object-store.ts`

Adapts Cloudflare R2 to `BackupObjectStore` while preserving conditional writes, native SHA-256 checksums, closed
custom metadata, and pagination.

## `createR2BackupObjectStore`

Closes over one Worker R2 binding and exposes only the operations required by scheduled backup and retention.

## `putIfAbsent`

Calls R2 with `etagDoesNotMatch: "*"` and supplies the decoded expected SHA-256 so duplicate cron attempts are
idempotent and corrupted writes are rejected.

## `head`

Maps one R2 head result without reading protected body bytes.

## `get`

Returns an owned byte copy alongside the same identity and checksum fields used for verification.

## `list`

Requests custom metadata for one supplied prefix and returns a cursor only for a genuinely truncated page. An object
without the optional native SHA-256 is returned without that field so retention can count and ignore it.

## `delete`

Delegates one exact-key deletion after the retention job has validated admission.

## `toBackupHead`

Copies custom metadata into an immutable record and converts R2's native SHA-256 to canonical base64url when present.
Head/get verification rejects its absence; paginated retention treats the object as malformed.

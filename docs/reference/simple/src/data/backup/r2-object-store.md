# `src/data/backup/r2-object-store.ts`

Connects the backup jobs to Vision's private Cloudflare R2 bucket.

## `createR2BackupObjectStore`

Builds the narrow storage interface used by daily creation and retention.

## `putIfAbsent`

Uses an atomic condition so two daily runs cannot overwrite each other.

## `head`

Reads only object identity, safe metadata, and checksum.

## `get`

Reads an owned copy of the encrypted object body.

## `list`

Lists one fixed prefix and carries the R2 cursor to the next page. A foreign object without SHA-256 remains
classifiable as malformed instead of stopping the page.

## `delete`

Deletes one exact object key already admitted by retention.

## `toBackupHead`

Converts R2 facts into the privacy-safe internal object description and preserves SHA-256 when present. Backup
verification still requires it; retention can ignore foreign objects that lack it.

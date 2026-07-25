# `src/domain/backup/manifest.ts`

`BackupManifestV1` authenticates `format`, canonical UTC creation time, schema version 9, a complete 29-table count
map, the plaintext archive SHA-256, and the backup-key version. The dependency-safe table order is also the canonical
NDJSON and restore order. Snapshot rows deliberately retain `Uint8Array` application ciphertext rather than exposing
any content-decryption dependency.

## `createBackupManifest`

Pins format and schema constants, then routes the result through the same untrusted-input validator used by restore.

## `validateBackupManifest`

Snapshots own data properties, enforces the exact six fields, requires all and only the current table names, bounds
counts to non-negative safe integers, and requires canonical 43-character base64url SHA-256.

## `requirePlainRecord`

Checks ordinary or null prototypes and rejects symbols, accessors, and non-enumerable properties before values are
read.

## `requireExactKeys`

Sorts actual and expected names only for set comparison; the returned manifest reconstructs row counts in canonical
table order.

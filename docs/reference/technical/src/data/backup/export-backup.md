# `src/data/backup/export-backup.ts`

The source adapter must supply one complete snapshot at migration 9. Export synchronously captures owned row values
before its first asynchronous operation and never calls application decryption. Rows are checked against the sole
schema contract, bounded before amplification, encoded as closed record-version-1 NDJSON, and sorted in dependency
and tagged composite-key order. The SHA-256 covers the exact plaintext archive bytes; the resulting manifest and
encoded archive are then encrypted together.

## `exportBackup`

Validates completeness, encodes once, hashes the exact archive, creates the versioned manifest, and sends the complete
payload to the backup-only AES-GCM boundary. An injected `createdAt` supports deterministic jobs and tests.

## `encodeCanonicalBackupArchive`

Snapshots row value properties, rejects missing or duplicate primary keys, emits one JSON record per line, and
terminates every non-empty archive with a newline.

## `decodeCanonicalBackupArchive`

Uses fatal UTF-8 decoding, rejects missing final newlines, blank lines, table/key disorder, duplicate keys, and key/row
disagreement, then returns every table including empty tables.

## `parseBackupPayload`

Requires exactly `manifest` and `archive`; the archive uses canonical bounded base64url before any NDJSON parsing.

## `countSnapshotRows`

Produces the complete count map used at manifest, pre-write, staging, and report boundaries.

## `sha256Base64Url`

Copies to owned bytes and uses Web Crypto SHA-256, yielding the 43-character unpadded digest.

## `captureCanonicalBackup`

Performs the synchronous ownership boundary, validates table shape, SQL types, nullability, checks, identities, and
references, and incrementally accounts for record and archive bytes before producing the immutable archive and counts.

## `createArchiveRecord`

Combines record version, table, derived key, and tagged row after a descriptor-safe row snapshot.

## `encodePrimaryKey`

Uses the reviewed primary-key map for all 29 tables and permits only scalar string, number, or bigint key components.

## `encodeBackupValue`

Distinguishes null, boolean, number, string, bigint, date, bytes, array, and object. Object properties sort
lexicographically, while array order remains semantic.

## `decodeBackupValue`

Validates tuple arity and payload type for each tag. Objects use a null prototype to prevent `__proto__` mutation.

## `parseArchiveRecord`

Requires the exact four record fields, record version 1, and a supported table name.

## `validateSnapshotShape`

Rejects schema drift and incomplete or extra table sets before row traversal.

## `snapshotPlainRow`

Uses property descriptors to reject accessors, symbols, and hidden state while preserving ciphertext byte views.

## `validateRowColumns`

Compares each row against the migration-9 column map for its table. This rejects missing or injected columns during
both export and import before a restore target receives any staged write.

## `isPlainObject`

Allows standard parsed records and deliberately constructed null-prototype maps only.

## `requireExactKeys`

Compares sorted closed field sets without making source order meaningful.

## `requireBoundedString`

Uses a cheap UTF-16 length rejection before measuring UTF-8 bytes against the per-string limit.

## `base64UrlLength`

Computes the exact unpadded base64url output length so byte values can be rejected before encoding amplification.

## `compareCanonicalKeys`

Orders primary keys using their unambiguous tagged JSON representation.

## `compareStrings`

Uses direct UTF-16 code-unit comparison so canonical order does not depend on host locale.

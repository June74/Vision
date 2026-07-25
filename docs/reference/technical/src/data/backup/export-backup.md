# `src/data/backup/export-backup.ts`

The source adapter must supply one complete snapshot at migration 9. Export never calls application decryption:
`Uint8Array` values are tagged and base64url-encoded exactly as stored. Rows become closed record-version-1 NDJSON,
tables follow dependency order, and rows sort by a tagged composite primary key. The SHA-256 covers the exact
plaintext archive bytes; the resulting manifest and encoded archive are then encrypted together.

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

## `compareCanonicalKeys`

Orders primary keys using their unambiguous tagged JSON representation.

## `compareStrings`

Uses direct UTF-16 code-unit comparison so canonical order does not depend on host locale.

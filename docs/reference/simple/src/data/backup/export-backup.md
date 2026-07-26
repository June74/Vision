# `src/data/backup/export-backup.ts`

Captures every raw database row before waiting, validates it against the current schema, writes it in stable table and
key order, hashes the bounded plaintext archive, and encrypts the archive together with its manifest.

## `exportBackup`

Creates one encrypted backup from a complete consistent snapshot.

## `encodeCanonicalBackupArchive`

Writes versioned newline-delimited records in deterministic order.

## `decodeCanonicalBackupArchive`

Reads only canonical records and reconstructs typed dates, byte arrays, and JSON values.

## `parseBackupPayload`

Separates a decrypted payload into its untrusted manifest and archive bytes.

## `countSnapshotRows`

Counts every authoritative table in canonical order.

## `sha256Base64Url`

Returns the SHA-256 of plaintext bytes as canonical base64url.

## `captureCanonicalBackup`

Owns and validates the complete source snapshot, then builds one bounded archive and its matching row counts.

## `createArchiveRecord`

Builds one record without decrypting byte-array fields.

## `encodePrimaryKey`

Extracts the declared primary key for ordering and identity verification.

## `encodeBackupValue`

Uses explicit type tags so different database and JSON values cannot collide.

## `decodeBackupValue`

Reconstructs a strictly tagged value.

## `parseArchiveRecord`

Accepts only version 1 records from known tables.

## `validateSnapshotShape`

Requires schema version 9 and all 29 table arrays.

## `snapshotPlainRow`

Copies ordinary row data without invoking getters.

## `validateRowColumns`

Requires every row to contain exactly the current migration's columns.

## `isPlainObject`

Recognizes ordinary or null-prototype records.

## `requireExactKeys`

Rejects missing, extra, or symbolic properties.

## `requireBoundedString`

Rejects a string whose encoded bytes exceed the backup format's per-value limit.

## `base64UrlLength`

Calculates how many unpadded base64url characters a byte array will require.

## `compareCanonicalKeys`

Compares serialized tagged primary keys.

## `compareStrings`

Provides locale-independent lexical ordering.

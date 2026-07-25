# `src/data/backup/export-backup.ts`

Encodes every raw database row in stable table and primary-key order, hashes that plaintext archive, and encrypts the
archive together with its manifest.

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

## `compareCanonicalKeys`

Compares serialized tagged primary keys.

## `compareStrings`

Provides locale-independent lexical ordering.

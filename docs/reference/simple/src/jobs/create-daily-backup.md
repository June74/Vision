# `src/jobs/create-daily-backup.ts`

Creates at most one encrypted Vision backup for each UTC date under a fixed private R2 prefix.

## `createDailyBackup`

Captures all 29 tables, encrypts them, creates the daily object only if absent, and verifies it before reporting
success.

## `verifyStoredBackup`

Checks the path, safe metadata, R2 checksum, canonical envelope, and ciphertext checksum using fresh head and body
reads. It then authenticates and decrypts the object, validates its manifest, parses all records, and verifies every
table count before accepting it.

## `dailyObjectKey`

Builds a deterministic opaque object name from the UTC date without putting user data in the name.

## `utcDate`

Converts a valid scheduler time to `YYYY-MM-DD` in UTC.

## `validateMetadata`

Accepts exactly the four privacy-safe metadata fields for the matching daily object.

# `src/data/phase-b-foundation-probe.ts`

Implements the preview-only, read-only Phase B source over one max-one Neon
client and a bounded R2 list/get port. Only aggregate measurements cross the
adapter boundary.

## `createNeonPhaseBFoundationProbePool`

Constructs `Pool({ max: 1 })` and exposes only connect, parameterized query,
release, and close operations.

## `connect`

Acquires the sole client retained across both database queries.

## `query`

Copies parameters into the Neon call and projects only the returned row array.

## `release`

Returns the retained client through the source's mandatory cleanup path.

## `end`

Awaits pool shutdown after success, database failure, or acquisition failure.

## `createR2PhaseBFoundationProbeBucket`

Narrows `R2Bucket` to metadata listing and object reads; put and delete
capability cannot enter the source.

## `list`

Requests custom metadata with the fixed prefix and page size and returns no
provider response object.

## `get`

Copies the encrypted body into a byte array for closed local validation.

## `createPhaseBFoundationProbeSource`

Requires a complete attested manifest, owner, pool, bucket, and controlled
title decryptor before constructing the frozen source.

## `read`

Uses one client for the aggregate and sentinel queries, cleans up in `finally`,
then performs bounded encrypted-backup validation and returns only admitted
measurements.

## `schemaColumnExpectations`

Flattens `BACKUP_SCHEMA_CONTRACT` for all authoritative tables into
parameterized information-schema expectations.

## `informationSchemaType`

Maps `timestamptz` to PostgreSQL's reported type and preserves other contract
types.

## `privilegeQueryParameter`

Serializes schema owner, schema privileges, schema grant options, and every
ordered table owner/privilege/grant expectation for server-side comparison.

## `decodeAggregateRow`

Requires exactly one aggregate row, strict booleans, and canonical safe
integer cells before reconstructing closed measurements.

## `evaluateSentinel`

Requires exactly one eligible candidate, decrypts only its title, compares
mutable bytes to the fixed marker, and clears both plaintext buffers in
`finally`.

## `decodeSentinelCandidate`

Admits only the expected owner, node identifier, domain, and mutable title
envelope from the bounded query.

## `equalBytes`

Performs length and byte equality without creating a plaintext string.

## `readR2Measurements`

Caps traversal at 100 pages, 10,000 objects, and safe-integer bytes; it rejects
non-progressing cursors and reads only the required-date candidate.

## `validateStoredBackup`

Checks exact metadata, body checksum, format version, algorithm, key version
1, ciphertext digest shape, parsed backup contract, and marker absence without
using a backup decryption key.

## `validMetadata`

Requires the exact allowlisted custom-metadata key/value set.

## `sameMetadata`

Compares fetched metadata to the previously admitted listing metadata.

## `containsBytes`

Searches the encrypted body for the fixed marker bytes and returns only a
boolean.

## `decodeSafeInteger`

Admits nonnegative safe numbers or canonical unsigned decimal strings.

## `toProbeObject`

Snapshots only the fields needed for bounded internal traversal and validation.

## `cloneManifest`

Freezes a deep value snapshot so later caller mutation cannot alter the query
contract.

## `isNonemptyText`

Requires a nonempty string for configuration and internal metadata admission.

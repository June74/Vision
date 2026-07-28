# `src/data/phase-b-foundation-probe.ts`

Reads only bounded database and backup aggregates for the preview acceptance
probe. It never returns rows, object keys, ciphertext, or provider errors.

## `createNeonPhaseBFoundationProbePool`

Creates one database pool that can retain at most one client.

## `connect`

Retains the sole database client for one observation.

## `query`

Runs one parameterized read-only query.

## `release`

Releases the retained client during cleanup.

## `end`

Closes the one-client pool on every outcome.

## `createR2PhaseBFoundationProbeBucket`

Exposes only bounded list and get operations for encrypted backups.

## `list`

Lists metadata under the fixed backup prefix.

## `get`

Reads the one required-date encrypted backup candidate.

## `createPhaseBFoundationProbeSource`

Rejects incomplete configuration or a non-production application schema
before any database or R2 access.

## `read`

Collects one aggregate-only observation from statically schema-qualified
application relations and closes all retained resources.

## `schemaColumnExpectations`

Converts the authoritative backup schema into expected database columns.

## `informationSchemaType`

Maps one contract type to its PostgreSQL information-schema name.

## `privilegeQueryParameter`

Passes every attested owner, privilege, and grant expectation to the query.

## `decodeAggregateRow`

Admits one database result containing only booleans and safe counts.

## `evaluateSentinel`

Treats zero, multiple, or malformed candidates as `not_tested`. For one
candidate it returns only title status and raw-marker absence booleans.

## `decodeSentinelCandidate`

Admits only the owner-scoped encrypted fields needed for the title check.

## `equalBytes`

Compares two byte arrays without converting plaintext to text.

## `readR2Measurements`

Counts encrypted backups with strict page, object, cursor, and byte limits.

## `validateStoredBackup`

Validates the required-date object without decrypting it.

## `validMetadata`

Accepts only the exact fixed backup metadata.

## `sameMetadata`

Requires listed and fetched metadata to match exactly.

## `containsBytes`

Checks that the fixed public marker is absent from an encrypted body.

## `decodeSafeInteger`

Accepts only canonical nonnegative safe integers.

## `toProbeObject`

Copies only size, checksum, metadata, and an internally retained key.

## `cloneManifest`

Takes an immutable snapshot of the already admitted privilege manifest.

## `isNonemptyText`

Accepts only nonempty text used by internal boundaries.

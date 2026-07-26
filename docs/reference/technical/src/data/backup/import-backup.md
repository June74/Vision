# `src/data/backup/import-backup.ts`

Restore follows a validation-before-write boundary: authenticate the AES-GCM envelope; validate manifest version and
key agreement; verify plaintext SHA-256; parse canonical NDJSON; verify complete row counts and references; and only
then enter the target transaction. The target is locked before its identity, revision, disposability, schema, and
emptiness are used for policy. A non-empty target additionally requires the replace flag plus exact environment and
target-ID assertions. Staging, database-side inspection, a second unchanged-target assertion, and promotion all remain
inside that same target-owned transaction.

## `importBackup`

Sequences every fail-closed gate before `transaction.stage`. It compares database-side staged counts and reference
status before promotion and returns only format, time, counts, checksum, target ID, and replacement status.

## `validateSnapshotReferences`

Delegates to the sole migration-9 schema contract, which checks every declared PostgreSQL foreign-key relationship.

## `snapshotTargetDescription`

Copies the lock-scoped target facts, rejects missing identity/environment/revision, unsafe disposal or schema state,
and incomplete counts, then freezes the owned description used by both policy checks and promotion.

## `requireMatchingCounts`

Requires exactly the 29 supported table names, non-negative safe integer counts, and value equality at archive,
staging, and target-description boundaries.

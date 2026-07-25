# `src/data/backup/import-backup.ts`

Restore follows a validation-before-write boundary: authenticate the AES-GCM envelope; validate manifest version and
key agreement; verify plaintext SHA-256; parse canonical NDJSON; verify complete row counts and references; and only
then inspect the target. The target must be disposable and schema-compatible. A non-empty target additionally requires
the replace flag plus exact environment and target-ID assertions. Staging, database-side inspection, and promotion are
called inside one target-owned transaction.

## `importBackup`

Sequences every fail-closed gate before `transaction.stage`. It compares database-side staged counts and reference
status before promotion and returns only format, time, counts, checksum, target ID, and replacement status.

## `validateSnapshotReferences`

Checks declared PostgreSQL foreign-key relationships for setup, graph, events, annotations, audit, deletion,
operation snapshots, projection rebuilds, and AI usage. Optional audit node references may be null.

## `referenceKey`

Requires present scalar columns and tags scalar types before JSON encoding, preventing string/number key collisions.

## `validateTargetDescription`

Rejects missing target identity/environment, non-boolean disposal state, invalid schema versions, or incomplete count
maps before a replacement decision.

## `requireMatchingCounts`

Requires exactly the 29 supported table names, non-negative safe integer counts, and value equality at archive,
staging, and target-description boundaries.

# `src/data/backup/import-backup.ts`

Restore now exposes the validation-before-capability boundary explicitly. Authentication, AES-GCM decryption,
manifest and key agreement, plaintext SHA-256, canonical NDJSON decoding, all 29 row counts, and references complete
before a module-issued frozen preparation exists. Its protected snapshot remains in a private `WeakMap`; the public
token exposes only safe manifest facts and carries no target capability.

## `prepareBackupImport`

Performs every cryptographic and logical gate, then binds the owned snapshot to the exact frozen preparation token.

## `importPreparedBackup`

Rejects forged preparations, retrieves the privately retained snapshot, and runs the existing lock, policy, staging,
database inspection, unchanged-target assertion, and promotion transaction. A non-empty target still requires the
existing exact replacement assertion.

## `importBackup`

Compatibility wrapper that calls `prepareBackupImport` followed by `importPreparedBackup`.

## `validateSnapshotReferences`

Delegates to the sole migration-9 schema contract, which checks every declared PostgreSQL foreign-key relationship.

## `snapshotTargetDescription`

Copies the lock-scoped target facts, rejects missing identity/environment/revision, unsafe disposal or schema state,
and incomplete counts, then freezes the owned description used by both policy checks and promotion.

## `requireMatchingCounts`

Requires exactly the 29 supported table names, non-negative safe integer counts, and value equality at archive,
staging, and target-description boundaries.

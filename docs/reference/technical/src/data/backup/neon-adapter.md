# `src/data/backup/neon-adapter.ts`

Supplies the production Neon source and PostgreSQL restore target for the portable Task 1 format. Backup reads use
one read-only repeatable-read batch; restore keeps a single serializable session while all authoritative tables are
locked, staged, inspected, and promoted.

## `createBackupSnapshotSource`

Requires exactly one result set for each migration-9 table and copies row objects into a complete snapshot.

## `readConsistentSnapshot`

Builds the 29 exact projections once, submits them through the injected transaction boundary, and rejects incomplete
results.

## `createNeonBackupSnapshotSource`

Validates the least-privileged Worker database URL, pins bytea and timestamp-with-time-zone parsers to text for
lossless portable encoding, and uses Neon HTTP `RepeatableRead` with `readOnly`.

## `readOnlyRepeatableRead`

Submits every exact-column query in one Neon transaction call rather than independent snapshots.

## `createNeonBackupRestoreTarget`

Validates the operator database URL, creates the interactive Neon pool, binds the expected target identity for later
database-attestation comparison, and returns explicit pool cleanup.

## `connect`

Retains one pool client for the complete interactive transaction.

## `query`

Copies parameters into the driver's mutable input form and returns typed rows.

## `release`

Releases the retained client exactly after transaction cleanup.

## `close`

Ends the restore-only pool when the command completes.

## `createPostgresBackupRestoreTarget`

Validates the operator's preview identity assertion before opening connections and wraps the callback in begin,
commit, rollback, and release. Database-owned proof is still required before staging.

## `transaction`

Uses serializable isolation on one session and preserves the original failure if rollback also fails.

## `lockTargetForRestore`

Reads the independently provisioned database attestation, rejects any environment, branch identity, disposable
policy, schema, or migration-digest mismatch, then takes access-exclusive locks over every authoritative table and
captures the complete row-count map.

## `stage`

Creates 29 temporary tables with migration-9 PostgreSQL constraints and inserts exact validated columns with
parameters.

## `inspectStage`

Recounts the transaction-local tables after database type and constraint admission and reruns the complete
migration-9 cross-table reference contract. It returns only a closed boolean if reference validation fails.

## `assertTargetUnchanged`

Rereads the database attestation inside the serializable snapshot and compares environment, disposable status, target
ID, schema, attestation revision, and fresh locked-table counts with the captured description.

## `promote`

Requires replacement policy to match whether the target was empty, deletes dependency order in reverse only when
explicitly approved, and inserts staged rows in forward order.

## `requireLocked`

Enforces the lock-before-stage state transition.

## `requireStage`

Requires the exact transaction-owned opaque staging token.

## `readRestoreTargetAttestation`

Queries the operator-provisioned `vision_restore_target_attestation` table and requires exactly one preview row whose
target ID matches the operator assertion, whose disposable flag is true, whose schema is migration 9, whose migration
digest equals the compiled contract, and whose revision is bounded. Missing tables and query details collapse to a
safe attestation error.

## `backupSnapshotQueries`

Uses the reviewed column and primary-key contracts to produce deterministic projections without `SELECT *`.

## `readRowCounts`

Collects every table count in one statement and rejects absent, negative, fractional, or unsafe values.

## `postgresParameter`

Serializes JSON, ISO timestamps, and big integers for the PostgreSQL driver while passing ciphertext strings and
bytes through unchanged.

## `quotedIdentifier`

Restricts identifiers to the compile-time lowercase schema grammar before quoting.

## `publicTable`

Pins authoritative destinations to the public schema.

## `validateTargetIdentity`

Rejects production, non-disposable, empty, or malformed target identities before a restore session opens.

## `randomOpaque`

Generates canonical base64url entropy for revisions and stages.

## `randomSqlToken`

Generates lowercase hexadecimal entropy for quoted temporary identifiers.

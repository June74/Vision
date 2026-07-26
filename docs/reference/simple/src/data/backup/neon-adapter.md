# `src/data/backup/neon-adapter.ts`

Reads one consistent snapshot from Neon and restores a validated backup inside one locked preview transaction.

## `createBackupSnapshotSource`

Turns one all-table transaction reader into a complete 29-table backup source.

## `readConsistentSnapshot`

Returns owned copies of every row and rejects incomplete transaction results.

## `createNeonBackupSnapshotSource`

Uses one read-only repeatable-read Neon transaction and keeps timestamp and byte values lossless.

## `readOnlyRepeatableRead`

Executes all exact-column table projections together.

## `createNeonBackupRestoreTarget`

Creates the preview restore target and its close operation.

## `connect`

Keeps one PostgreSQL connection for the entire restore transaction.

## `query`

Runs a parameterized statement on that connection.

## `release`

Returns the connection after commit or rollback.

## `close`

Closes the operator process's connection pool.

## `createPostgresBackupRestoreTarget`

Builds the transaction-locked PostgreSQL restore adapter.

## `transaction`

Runs the restore atomically at serializable isolation.

## `lockTargetForRestore`

Reads the database-owned disposable-preview attestation, then locks all 29 public tables and captures their counts.

## `stage`

Loads validated raw rows into transaction-local PostgreSQL tables.

## `inspectStage`

Recounts all staged rows and rechecks every cross-table reference before promotion.

## `assertTargetUnchanged`

Rereads the database attestation and requires it and all locked table counts to remain exactly the same.

## `promote`

Optionally clears an explicitly confirmed disposable target, then copies every staged table atomically.

## `requireLocked`

Stops staging or policy work before target locking.

## `requireStage`

Stops use of a missing or foreign staging identity.

## `readRestoreTargetAttestation`

Requires exactly one database-owned marker proving the connected target is the expected disposable preview branch
at the current schema and migration digest.

## `backupSnapshotQueries`

Builds exact-column, primary-key-ordered reads for all 29 tables.

## `readRowCounts`

Reads and validates complete nonnegative table counts.

## `postgresParameter`

Converts dates, big integers, and JSON values to driver parameters without decrypting protected fields.

## `quotedIdentifier`

Quotes only validated schema identifiers.

## `publicTable`

Qualifies one authoritative table in the public schema.

## `validateTargetIdentity`

Accepts only an explicit disposable preview target.

## `randomOpaque`

Creates a report-safe random identifier.

## `randomSqlToken`

Creates lowercase random text safe for temporary table names.

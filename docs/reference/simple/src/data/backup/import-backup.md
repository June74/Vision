# `src/data/backup/import-backup.ts`

Checks a backup completely before any database write, then locks, stages, rechecks, and promotes it inside one target
transaction.

## `importBackup`

Authenticates, verifies, stages, inspects, and promotes an encrypted backup into a disposable target.

## `validateSnapshotReferences`

Checks every declared relationship between restored rows.

## `snapshotTargetDescription`

Copies and validates the transaction-locked target identity, revision, safety policy, schema, and row counts.

## `requireMatchingCounts`

Requires exact non-negative row totals for every authoritative table.

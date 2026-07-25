# `src/data/backup/import-backup.ts`

Checks a backup completely before any database write, then stages and promotes it inside one target transaction.

## `importBackup`

Authenticates, verifies, stages, inspects, and promotes an encrypted backup into a disposable target.

## `validateSnapshotReferences`

Checks every declared relationship between restored rows.

## `referenceKey`

Builds a typed scalar key for one relationship.

## `validateTargetDescription`

Checks safe target identity, environment, disposal, schema, and count facts.

## `requireMatchingCounts`

Requires exact non-negative row totals for every authoritative table.

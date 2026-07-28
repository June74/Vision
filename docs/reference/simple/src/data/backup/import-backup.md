# `src/data/backup/import-backup.ts`

Checks a backup completely before any database capability is supplied. The temporary restore can retain that exact
immutable preparation across its one-shot claim, then lock, stage, recheck, and promote it inside one target
transaction.

## `prepareBackupImport`

Authenticates, decrypts, checks the manifest and checksum, decodes all 29 tables, and validates counts and references.
It returns a frozen value with no database target or protected rows.

## `importPreparedBackup`

Restores only a preparation issued by this module and uses its privately retained snapshot.

## `importBackup`

Keeps the existing API by preparing first and then importing that exact preparation.

## `validateSnapshotReferences`

Checks every declared relationship between restored rows.

## `snapshotTargetDescription`

Copies and validates the transaction-locked target identity, revision, safety policy, schema, and row counts.

## `requireMatchingCounts`

Requires exact non-negative row totals for every authoritative table.

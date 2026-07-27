# `src/jobs/purge-expired-backups.ts`

Keeps the most recent 30 UTC calendar dates of valid Vision backup objects.

## `purgeExpiredBackups`

Pages through only the fixed backup prefix and deletes valid objects that are 30 whole UTC dates old or older.

## `validatedBackupObjectDate`

Ignores anything whose path, metadata, date, or checksums do not match the Vision backup format.

## `utcDateMilliseconds`

Converts the scheduler time to UTC midnight for whole-day age calculations.

## `parseUtcDate`

Rejects impossible or normalized dates such as February 30.

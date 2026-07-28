# `src/data/usage-warning-source.ts`

This server-only adapter measures total PostgreSQL size and encrypted backup
storage without returning storage identities or provider errors.

## `createUsageWarningSource`

Creates a read-only measurement source from the canonical database, private R2
backup bucket, and validated thresholds.

## `readUsageWarnings`

Measures both services independently. If either measurement is unavailable or
malformed, only that service becomes actionable while a trustworthy other
measurement is preserved.

## `readDatabaseBytes`

Runs the content-free PostgreSQL database-size aggregate and admits one
non-negative safe integer.

## `readR2Measurements`

Lists only encrypted backups with fixed page, page-count, object, byte, cursor,
and overflow boundaries. It aggregates sizes and counts without copying keys
or metadata.

## `decodeDatabaseBytes`

Accepts safe PostgreSQL integer output in number or canonical decimal-string
form.

# `src/data/usage-warning-source.ts`

The adapter is a `UsageWarningSource` implementation over `VisionDatabase` and
`R2Bucket`. It exposes only two booleans.

## `createUsageWarningSource`

**Signature:** `(database: VisionDatabase, bucket: R2Bucket, thresholds: UsageWarningThresholds) => UsageWarningSource`

Validates thresholds without I/O, requires the list capability, and returns a
frozen source. Each read settles database and R2 work independently and
substitutes the corresponding threshold only for a failed provider, producing
an actionable provider-specific warning.

## `readUsageWarnings`

Runs the two read-only measurements concurrently and applies the pure domain
policy once to either measured or fail-safe inputs. No caught error is logged,
serialized, or returned.

## `readDatabaseBytes`

Executes only `select pg_database_size(current_database())` and decodes the
single aggregate cell. A missing row or invalid integer becomes a constant
internal failure consumed by the source.

## `readR2Measurements`

Calls `R2Bucket.list` only with `prefix: "backups/v1/"`, `limit: 100`, and an
optional previously admitted cursor. It caps traversal at ten pages, rejects
over-page object arrays, bounds cursor length and progress, admits only
non-negative safe-integer sizes, checks addition before overflow, and stops
once either approved warning threshold is proven. Keys, metadata, prefixes,
and cursors never cross the adapter result.

## `decodeDatabaseBytes`

Accepts a non-negative safe number or canonical unsigned decimal string and
rejects every other database cell with a constant internal error.

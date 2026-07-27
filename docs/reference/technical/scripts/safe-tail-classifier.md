# `scripts/safe-tail-classifier.ts`

Provides the closed, privacy-safe projection used for live scheduled recovery
and temporary-restore acceptance. It incrementally parses Wrangler's pretty
JSON, caps buffered input at one MiB, recognizes only approved crons, and emits
no provider-controlled fields.

## `createSafeTailAccumulator`

Creates a stateful line accumulator that resets after one complete JSON value
or after the one-MiB safety cap.

## `push`

Adds one raw line, returns `null` for incomplete or irrelevant input, and
returns one closed recovery or restore result only for a complete recognized
event.

## `classifySafeTailLine`

Parses one JSON value, requires a recognized scheduled cron, returns an exact
accepted restore record before legacy recovery classification, maps known
fixed backup messages to allowlisted categories, and otherwise uses
`unknown_failure`.

## `classifyTemporaryRestoreEvidence`

Snapshots own enumerable data properties, requires the exact key set for the
declared outcome, validates all literals, booleans, and counts, and
reconstructs a new plain `TemporaryRestoreEvidence`.

## `normalizeOutcome`

Maps `ok`, `exception`, `canceled`, and `exceededCpu` to the public evidence
vocabulary; every other value becomes `unknown`.

## `locateTemporaryRestoreEvidence`

Walks the log array and inspects only each entry's first message. An attempted
`backup.restore` record with extra or invalid data blocks generic fallback.

## `classifyRestoreRowCounts`

Requires exactly the 29 authoritative migration-9 table names and a
nonnegative safe integer for every value, then reconstructs a plain frozen
record.

## `findFailureMarker`

Traverses parsed arrays and own data properties iteratively, comparing strings
only with fixed recovery markers and never stringifying the full event.

## `snapshotOwnEnumerableData`

Uses property descriptors to copy only own enumerable data properties into an
internal snapshot without invoking accessors or accepting enumerable symbols.

## `hasExactKeys`

Requires key-count equality plus ownership of every allowlisted string key.

## `isNonnegativeSafeInteger`

Admits only nonnegative JavaScript safe integers for row and event counts.

## `isPositiveSafeInteger`

Admits only positive JavaScript safe integers for the retained backup key
version.

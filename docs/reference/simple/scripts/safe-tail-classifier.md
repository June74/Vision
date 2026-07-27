# safe-tail-classifier

Turns a Cloudflare scheduled-event log into either a tiny recovery result or
the exact closed temporary-restore evidence object.

## `createSafeTailAccumulator`

Collects pretty-printed JSON one line at a time without showing it.

## `push`

Accepts one line and returns a safe result only after one complete event exists.

## `classifySafeTailLine`

Recognizes only the temporary or normal backup schedules, returns exact restore
evidence first, and otherwise maps known backup failures to fixed names.

## `classifyTemporaryRestoreEvidence`

Accepts only the exact success or allowlisted failure shape and returns a new
plain evidence object.

## `normalizeOutcome`

Converts Cloudflare's outcome into Vision's small approved outcome list.

## `locateTemporaryRestoreEvidence`

Checks only the first message in each log entry for the exact restore record.

## `classifyRestoreRowCounts`

Requires one nonnegative safe count for every migration-9 backup table.

## `findFailureMarker`

Searches for fixed legacy recovery messages without copying or serializing the
tail event.

## `snapshotOwnEnumerableData`

Copies only an object's own enumerable data properties without running
getters.

## `hasExactKeys`

Rejects missing or extra properties.

## `isNonnegativeSafeInteger`

Accepts only safe whole-number counts at least zero.

## `isPositiveSafeInteger`

Accepts only safe positive key versions.

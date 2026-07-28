# safe-tail-classifier

Turns a Cloudflare scheduled-event log into a tiny recovery result, the exact
closed temporary-restore evidence object, or the exact four-field temporary
role-probe evidence object.

## `createSafeTailAccumulator`

Collects pretty-printed JSON one line at a time without showing it.

## `push`

Accepts one line and returns a safe result only after one complete event exists.

## `classifySafeTailLine`

Recognizes only the temporary or normal backup schedules, returns exact
role-probe or restore evidence first, and otherwise maps known backup failures
to fixed names.

## `classifyTemporaryPreviewRoleProbeEvidence`

Accepts only the exact four keys and valid success or failure combinations,
then returns a new plain value-free object.

## `classifyTemporaryRestoreEvidence`

Accepts only the exact success or allowlisted failure shape and returns a new
plain evidence object.

## `normalizeOutcome`

Converts Cloudflare's outcome into Vision's small approved outcome list.

## `locateTemporaryRestoreEvidence`

Checks only the first message in each log entry for the exact restore record.

## `locateTemporaryPreviewRoleProbeEvidence`

Checks only the first message in each log entry for the exact role-probe
action, and blocks generic fallback for malformed or wrongly labeled
role-probe-shaped records.

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

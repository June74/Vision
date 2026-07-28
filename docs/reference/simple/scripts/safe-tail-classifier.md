# safe-tail-classifier

Turns a Cloudflare scheduled-event log into a tiny recovery result, the exact
five-field normal maintenance result, the exact closed temporary-restore
evidence object, the exact four-field temporary role-probe evidence object, or
the exact 19-field Phase B foundation evidence object.

## `createSafeTailAccumulator`

Collects pretty-printed JSON one line at a time without showing it.

## `push`

Accepts one line and returns a safe result only after one complete event exists.

## `classifySafeTailLine`

Recognizes only the exact maintenance or recovery schedules, returns an exact
maintenance, role-probe, or restore result, and otherwise maps known backup
failures to fixed names.

## `classifyCalendarMaintenanceEvidence`

Accepts only the five exact maintenance keys and coherent repair, renewal,
category, and outcome combinations.

## `classifyTemporaryPreviewRoleProbeEvidence`

Accepts only the exact four keys and valid success or failure combinations,
then returns a new plain value-free object.

## `classifyPhaseBFoundationProbeEvidence`

Accepts only the exact foundation keys, safe counts, and coherent terminal
combinations. Numeric-bound evidence must contain at least one possible
sanitized zero. The classifier reconstructs a new privacy-safe object.

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

## `locatePhaseBFoundationProbeEvidence`

Requires exactly one foundation terminal on the one-minute observation and
rejects duplicates, mixed terminals, wrong actions, or malformed shapes.

## `locateCalendarMaintenanceEvidence`

Requires one valid maintenance terminal record and rejects duplicate, mixed,
malformed, or wrongly labeled terminal records.

## `classifyRestoreRowCounts`

Requires one nonnegative safe count for every migration-9 backup table.

## `findFailureMarker`

Searches for fixed legacy recovery messages without copying or serializing the
tail event.

## `snapshotOwnEnumerableData`

Copies only an object's own enumerable data properties without running
getters, and rejects symbols, accessors, hidden keys, and custom prototypes.

## `hasExactKeys`

Rejects missing or extra properties.

## `isNonnegativeSafeInteger`

Accepts only safe whole-number counts at least zero.

## `isPositiveSafeInteger`

Accepts only safe positive key versions.

## `isUnavailableFoundationMeasurements`

Recognizes only the canonical zeroed measurement shape used for unavailable
foundation sources.

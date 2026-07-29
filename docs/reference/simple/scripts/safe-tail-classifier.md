# `scripts/safe-tail-classifier.ts`

Turns Cloudflare scheduled-event logs into small, privacy-safe evidence records.
It never returns a raw log line. It accepts only known schedules, exact actions,
exact key sets, and coherent values for maintenance, recovery, restore,
role-probe, foundation, AI-usage, and preview-fault evidence.

## `createSafeTailAccumulator`

Collects pretty-printed JSON one line at a time without displaying it. The
buffer is capped at one MiB and resets after either a complete JSON event or an
oversized frame, so unrelated events cannot be joined together.

## `push`

Adds one line to the current frame. It returns `null` for incomplete,
oversized, malformed, or irrelevant input and emits only the closed result
produced after one complete event.

## `classifySafeTailLine`

Accepts maintenance evidence only on `*/15 * * * *`, daily recovery only on
`5 6 * * *`, and temporary acceptance terminals only on `* * * * *`.
Terminal records take precedence over the older fixed-message recovery
fallback. A malformed, duplicate, wrongly labeled, or mixed terminal blocks
fallback instead of allowing provider-controlled text to become evidence.

## `classifyPhaseBAiUsageEvidence`

Requires the exact ten AI fields and rebuilds the record from monthly cents,
the Gateway-limit boolean, and the non-AI availability boolean. Derived
thresholds, tier, category, and outcome must match the canonical producer.

## `classifyTemporaryPreviewFaultEvidence`

Requires exactly `category`, `evidenceType`, `outcome`, and `scenario`. It
rebuilds the result from the frozen six-scenario vocabulary, allowing only
`r2_upload_failed` to pair with
`failed/backup_storage_write_failed`; the other five must pair with
`succeeded/none`.

## `isPhaseBAiUsageEvidenceShape`

Requires the exact AI key set and the primitive inputs needed for safe
reconstruction.

## `isCanonicalUnavailableAiUsageEvidence`

Recognizes only the producer's fixed zeroed unavailable AI record.

## `createUnavailableAiUsageEvidence`

Builds a new unavailable AI record from fixed values rather than copying tail
data.

## `matchesPhaseBAiUsageEvidence`

Checks every derived AI category, outcome, threshold, tier, and amount against
the canonical reconstruction.

## `classifyPhaseBFoundationProbeEvidence`

Requires exactly 19 foundation keys, safe nonnegative counts, coherent
success/failure combinations, and a possible sanitized zero for numeric-bound
failures. It returns a newly reconstructed record.

## `classifyCalendarMaintenanceEvidence`

Requires exactly five keys and a coherent repair, renewal, category, and
outcome combination.

## `classifyTemporaryPreviewRoleProbeEvidence`

Requires exactly four keys. Success must be `succeeded/none/true`; failure must
use an approved category and `failed/false`.

## `classifyTemporaryRestoreEvidence`

Requires either the exact three-field failure form or the complete verified
success form. Successful row counts must contain every authoritative backup
table.

## `normalizeOutcome`

Converts Cloudflare's `ok`, `exception`, `canceled`, and `exceededCpu` values
into Vision's small approved outcome vocabulary; everything else is
`unknown`.

## `locateTemporaryRestoreEvidence`

Checks only the first message in each log entry for the exact restore action.
An attempted but malformed restore terminal is treated as seen and blocks
legacy fallback.

## `locateTemporaryPreviewRoleProbeEvidence`

Checks only the first message in each log entry. A role-probe evidence type
under the wrong action is treated as malformed evidence and blocks fallback.

## `terminalKindsForMessage`

Uses one shared action/evidence registry to identify every terminal kind named
by a message.

## `hasTerminalKind`

Reports whether a message identifies one requested terminal kind.

## `hasOtherTerminalKind`

Reports whether a message identifies a different terminal kind.

## `hasMixedTerminalKinds`

Scans every message in the event and rejects cross-kind evidence before any
locator can win because of its call order.

## `locatePhaseBFoundationProbeEvidence`

Scans all messages, requires exactly one canonical foundation terminal, and
rejects duplicates, wrong actions, extra fields, malformed values, or another
terminal kind.

## `locatePhaseBAiUsageEvidence`

Scans all messages and requires exactly one canonical AI terminal. Duplicate,
wrong-action, malformed, and mixed evidence is rejected.

## `locateTemporaryPreviewFaultEvidence`

Scans all messages and requires exactly one
`acceptance.preview-fault`/`vision.preview-fault/v1` terminal. Duplicate,
mixed, malformed, or wrongly labeled records are rejected.

## `locateCalendarMaintenanceEvidence`

Scans all messages for exactly one valid maintenance terminal and rejects
duplicates, mixed terminals, extra fields, and wrong actions.

## `isUnavailableFoundationMeasurements`

Recognizes only the fixed all-false, all-zero, `not_tested` measurement set
used when a foundation source is unavailable.

## `classifyRestoreRowCounts`

Requires one nonnegative safe count for every authoritative migration-9 backup
table and reconstructs a plain record.

## `findFailureMarker`

Searches for fixed legacy recovery messages without serializing or returning
the full tail event.

## `snapshotOwnEnumerableData`

Copies only an object's own enumerable plain data fields. Getters, symbols,
hidden fields, arrays where objects are expected, and custom prototypes reject
the candidate before any field can be read.

## `hasExactKeys`

Rejects missing or extra own properties.

## `isNonnegativeSafeInteger`

Accepts only safe whole-number counts at least zero.

## `isPositiveSafeInteger`

Accepts only positive safe-integer key versions.

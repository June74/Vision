# `scripts/safe-tail-classifier.ts`

Provides the closed projection used for normal maintenance, daily recovery,
temporary restore/role-probe candidates, and Phase B foundation, AI-usage, and
fault acceptance. It incrementally parses Wrangler JSON, caps each frame at
1,048,576 bytes, snapshots only own enumerable data properties, reconstructs
canonical records, and emits no raw provider-controlled field.

## `createSafeTailAccumulator`

Creates a stateful line accumulator. It ignores non-object prefixes, resets
after a complete JSON value, and also clears the frame when the one-MiB cap is
exceeded. This prevents malformed or adjacent events from sharing state.

## `push`

Appends one raw line and returns `null` until `JSON.parse` can consume the
complete frame. It then calls `classifySafeTailLine`, clears the frame even
when classification returns `null`, and returns only the closed result.

## `classifySafeTailLine`

Requires a plain event object and rejects mixed terminal kinds before locator
dispatch. `calendar.maintenance` is valid only on `*/15 * * * *`; the
one-minute cron maps to `temporary_recovery`; `5 6 * * *` maps to
`daily_recovery`. On the one-minute cron, locator precedence is foundation,
preview fault, AI usage, role probe, then restore. Any seen-but-invalid
terminal returns `null` and blocks legacy string fallback. Only events with no
terminal attempt may use fixed failure markers or `unknown_failure`.

## `classifyPhaseBAiUsageEvidence`

Requires the exact ten-key AI object and `vision.ai-usage/v1`. The sole
unavailable form is rebuilt from fixed literals; every other record is
reconstructed through `createPhaseBAiUsageEvidence`, and all derived category,
outcome, threshold, tier, and amount fields must match.

## `classifyTemporaryPreviewFaultEvidence`

Requires exactly four keys and `vision.preview-fault/v1`, validates membership
in the single frozen six-value scenario array, reconstructs through
`createTemporaryPreviewFaultEvidence`, and compares outcome/category with the
canonical matrix. No tail-owned object is returned.

## `isPhaseBAiUsageEvidenceShape`

Requires exactly the AI key inventory, the fixed discriminator, a numeric
monthly amount, and boolean Gateway/non-AI inputs.

## `isCanonicalUnavailableAiUsageEvidence`

Checks every literal in the sole zeroed `failed/unavailable` producer form,
including fixed 800/900/950 thresholds and the normal tier.

## `createUnavailableAiUsageEvidence`

Returns a new frozen unavailable record containing fixed allowlisted literals.

## `matchesPhaseBAiUsageEvidence`

Compares the candidate's category, outcome, three thresholds, tier, and
monthly amount with the canonical reconstruction.

## `classifyPhaseBFoundationProbeEvidence`

Snapshots the exact 19 keys, requires booleans and nonnegative safe integers,
and reconstructs success and semantic-failure forms. Source-unavailable
categories require the canonical all-zero measurement set. A
`numeric_bound_exceeded` record requires at least one sanitized zero because
the producer zeroes every rejected numeric input.

## `classifyCalendarMaintenanceEvidence`

Requires exactly `category`, `evidenceType`, `outcome`, `renewalOutcome`, and
`repairOutcome`; derives the only coherent outcome/category for the nine
repair/renewal combinations; and returns a new frozen five-key object.

## `classifyTemporaryPreviewRoleProbeEvidence`

Requires exactly four keys. It accepts only
`succeeded/none/roleMatches=true` or an allowlisted
`failed/<category>/roleMatches=false` combination, then reconstructs a new
plain frozen object.

## `classifyTemporaryRestoreEvidence`

Requires the exact three-key failure shape or the 14-key success shape.
Success fixes format/schema/table-count literals, requires all verification
booleans, validates event/key counts, and reconstructs all authoritative row
counts.

## `normalizeOutcome`

Maps `ok`, `exception`, and `canceled` directly, converts `exceededCpu` to
`exceeded_cpu`, and maps every other value to `unknown`.

## `locateTemporaryRestoreEvidence`

Traverses log entries but inspects only each entry's first message for
`backup.restore`. Once the action is seen, invalid envelope/evidence shape
sets the seen state so generic recovery fallback cannot accept nearby text.

## `locateTemporaryPreviewRoleProbeEvidence`

Traverses only first messages. It recognizes either the role-probe action or
its evidence discriminator; action/evidence mismatch is seen-but-invalid and
therefore blocks fallback.

## `terminalKindsForMessage`

Matches both action and evidence discriminator against the complete terminal
registry for maintenance, restore, role probe, foundation, AI, and preview
fault records.

## `hasTerminalKind`

Tests registry membership for one expected terminal kind.

## `hasOtherTerminalKind`

Detects any registry match other than the locator's expected kind.

## `hasMixedTerminalKinds`

Traverses every message in every log entry before locator dispatch. As soon as
two distinct registered kinds appear, classification fails independently of
message order or locator precedence.

## `locatePhaseBFoundationProbeEvidence`

Traverses all messages, requires exactly one
`acceptance.phase-b-foundation` envelope, validates its exact two-key outer
shape and 19-key evidence, and rejects duplicates or any other terminal kind.

## `locatePhaseBAiUsageEvidence`

Traverses all messages, requires exactly one registered AI action/evidence
identity, validates the exact envelope and ten-key evidence, and rejects
duplicates, wrong actions, malformed values, or mixed terminal kinds.

## `locateTemporaryPreviewFaultEvidence`

Traverses all messages on the one-minute event, requires exactly one
`acceptance.preview-fault` envelope with canonical four-key evidence, and
rejects duplicates, action/discriminator mismatch, malformed matrices, or
other terminal kinds.

## `locateCalendarMaintenanceEvidence`

Traverses all messages, requires exactly one `calendar.maintenance` envelope,
and rejects wrong actions, duplicates, mixed terminal evidence, malformed
values, and extra fields before the cron check accepts it.

## `isUnavailableFoundationMeasurements`

Requires the exact all-false, all-zero, `not_tested` measurement shape so an
unavailable source cannot carry misleading partial measurements.

## `classifyRestoreRowCounts`

Requires exactly the authoritative migration-9 backup table names and a
nonnegative safe integer for each value, then reconstructs a plain frozen
record.

## `findFailureMarker`

Traverses arrays and own data fields iteratively, compares strings only with
fixed recovery markers, and never serializes the full event.

## `snapshotOwnEnumerableData`

Uses property descriptors to copy only own enumerable data properties from a
plain or null-prototype object. Symbols, accessors, non-enumerable own
properties, and custom prototypes reject the candidate without invoking
untrusted code.

## `hasExactKeys`

Requires key-count equality plus ownership of every allowlisted string key.

## `isNonnegativeSafeInteger`

Admits only nonnegative JavaScript safe integers for counts and byte totals.

## `isPositiveSafeInteger`

Admits only positive JavaScript safe integers for the retained backup key
version.

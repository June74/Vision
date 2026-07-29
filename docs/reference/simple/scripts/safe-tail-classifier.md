# `scripts/safe-tail-classifier.ts`

Safely reduces scheduled Worker logs to closed evidence records without keeping raw provider-controlled lines.

## `createSafeTailAccumulator`
Buffers one bounded JSON event.
## `push`
Accepts one tail line and emits only a complete safe result.
## `classifySafeTailLine`
Recognizes only approved schedules and terminal records.
## `classifyPhaseBAiUsageEvidence`
Rebuilds canonical AI evidence.
## `classifyTemporaryPreviewFaultEvidence`
Accepts only the exact four-key preview-fault mapping.
## `isPhaseBAiUsageEvidenceShape`
Checks the AI evidence shape.
## `isCanonicalUnavailableAiUsageEvidence`
Recognizes fixed unavailable AI evidence.
## `createUnavailableAiUsageEvidence`
Builds fixed unavailable AI evidence.
## `matchesPhaseBAiUsageEvidence`
Compares derived AI fields.
## `classifyPhaseBFoundationProbeEvidence`
Rebuilds closed foundation evidence.
## `classifyCalendarMaintenanceEvidence`
Rebuilds closed maintenance evidence.
## `classifyTemporaryPreviewRoleProbeEvidence`
Rebuilds closed role-probe evidence.
## `classifyTemporaryRestoreEvidence`
Rebuilds closed restore evidence.
## `normalizeOutcome`
Maps platform outcomes to the safe vocabulary.
## `locateTemporaryRestoreEvidence`
Finds a restore terminal.
## `locateTemporaryPreviewRoleProbeEvidence`
Finds a role-probe terminal.
## `terminalKindsForMessage`
Identifies a message's terminal kind.
## `hasTerminalKind`
Checks for one kind.
## `hasOtherTerminalKind`
Checks for a different kind.
## `hasMixedTerminalKinds`
Rejects mixed terminal kinds.
## `locatePhaseBFoundationProbeEvidence`
Finds one foundation terminal.
## `locatePhaseBAiUsageEvidence`
Finds one AI terminal.
## `locateTemporaryPreviewFaultEvidence`
Finds one preview-fault terminal and rejects duplicates or mixed records.
## `locateCalendarMaintenanceEvidence`
Finds one maintenance terminal.
## `isUnavailableFoundationMeasurements`
Recognizes fixed unavailable foundation measurements.
## `classifyRestoreRowCounts`
Checks bounded restore row counts.
## `findFailureMarker`
Maps fixed legacy backup failures.
## `snapshotOwnEnumerableData`
Copies only plain own data fields.
## `hasExactKeys`
Rejects missing and extra fields.
## `isNonnegativeSafeInteger`
Checks safe nonnegative integers.
## `isPositiveSafeInteger`
Checks safe positive integers.

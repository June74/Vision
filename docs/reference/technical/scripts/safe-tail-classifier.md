# `scripts/safe-tail-classifier.ts`

Uses own-enumerable snapshots, bounded incremental framing, exact key sets, and canonical reconstruction for every accepted terminal record.

## `createSafeTailAccumulator`
Maintains a one-MiB-bounded JSON frame.
## `push`
Returns a result only after a complete parse.
## `classifySafeTailLine`
Routes only approved cron and terminal combinations.
## `classifyPhaseBAiUsageEvidence`
Reconstructs the closed AI evidence form.
## `classifyTemporaryPreviewFaultEvidence`
Requires the exact four keys and the allowed scenario/outcome/category matrix.
## `isPhaseBAiUsageEvidenceShape`
Validates reconstruction inputs.
## `isCanonicalUnavailableAiUsageEvidence`
Validates the sole unavailable producer form.
## `createUnavailableAiUsageEvidence`
Returns fixed unavailable AI evidence.
## `matchesPhaseBAiUsageEvidence`
Checks all derived AI fields.
## `classifyPhaseBFoundationProbeEvidence`
Reconstructs foundation evidence.
## `classifyCalendarMaintenanceEvidence`
Reconstructs maintenance evidence.
## `classifyTemporaryPreviewRoleProbeEvidence`
Reconstructs role-probe evidence.
## `classifyTemporaryRestoreEvidence`
Reconstructs restore evidence.
## `normalizeOutcome`
Maps allowed platform outcomes.
## `locateTemporaryRestoreEvidence`
Locates one restore terminal.
## `locateTemporaryPreviewRoleProbeEvidence`
Locates one role-probe terminal.
## `terminalKindsForMessage`
Uses the shared terminal registry.
## `hasTerminalKind`
Tests terminal membership.
## `hasOtherTerminalKind`
Detects terminal mismatches.
## `hasMixedTerminalKinds`
Rejects cross-kind events before locator order applies.
## `locatePhaseBFoundationProbeEvidence`
Requires one exact foundation terminal.
## `locatePhaseBAiUsageEvidence`
Requires one exact AI terminal.
## `locateTemporaryPreviewFaultEvidence`
Requires one exact `acceptance.preview-fault` terminal on the one-minute cron.
## `locateCalendarMaintenanceEvidence`
Requires one exact maintenance terminal.
## `isUnavailableFoundationMeasurements`
Checks fixed unavailable measurements.
## `classifyRestoreRowCounts`
Checks all migration backup-table counts.
## `findFailureMarker`
Matches fixed legacy errors without serializing logs.
## `snapshotOwnEnumerableData`
Rejects getters, symbols, hidden fields, and non-plain prototypes.
## `hasExactKeys`
Requires exact own keys.
## `isNonnegativeSafeInteger`
Checks accepted counts.
## `isPositiveSafeInteger`
Checks accepted positive values.

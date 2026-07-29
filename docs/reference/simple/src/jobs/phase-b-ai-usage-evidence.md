# `src/jobs/phase-b-ai-usage-evidence.ts`

## `emitPhaseBAiUsageEvidence`
Writes the fixed action.
## `unavailableEvidence`
Creates safe failed evidence.

Creates one exact, privacy-safe AI usage acceptance record.

## `createPhaseBAiUsageEvidence`

Uses the fixed 800, 900, and 950-cent boundaries. Exactly 950 is a successful
stopped state; a higher amount is reported only as `limit_exceeded`.

## `runPhaseBAiUsageEvidence`

Reads a monthly aggregate, then performs the deterministic status and calendar
checks. `nonAiAvailable` becomes true only after both reads succeed. Unavailable
or inconsistent results become closed evidence without printing error details.

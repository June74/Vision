# SB-20260731-212303-task4-ledger-rounded-time: Task 4 cleanup closure used a rounded timestamp

- **Status:** closed
- **First observed:** 2026-07-31T21:23:03.5485336Z
- **Last observed:** 2026-07-31T21:23:03.5485336Z
- **Phase/task:** Phase B Task 4 setback-ledger maintenance
- **Environment:** Local documentation edit
- **Version/commit:** 2cf0ff1 plus uncommitted Task 4 implementation

## Symptom

The cleanup-incident closure used a manually rounded `21:22:00` timestamp
instead of recording the actual current UTC timestamp.

## Impact

No implementation or external state changed, but the ledger temporarily
contained imprecise closure metadata.

## Cause classification

- **Confirmed cause:** The closure patch substituted a convenient rounded time
  rather than querying the clock immediately before writing.
- **Hypotheses:** None remaining.
- **Known exclusions:** No provider, network, database, secret, staging state,
  or commit changed.

## Correction and prevention

- **Correction:** Replace the rounded value in the incident and index with the
  actual queried UTC timestamp.
- **Prevention:** Never synthesize or round incident timestamps; query UTC for
  every ledger mutation.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Recurrence history

- 2026-07-31T21:23:03.5485336Z: Observed, corrected, and closed immediately.


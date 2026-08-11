# SB-20260811-211548-controller-test-old-dispatch-deadline

- Incident ID: `SB-20260811-211548-controller-test-old-dispatch-deadline`
- First observed: `2026-08-11T21:15:48Z`
- Last observed: `2026-08-11T21:22:26Z`
- Status: `closed`
- Phase/task: Phase B monitored acceptance correlation-wait repair
- Environment: Windows PowerShell, Phase B linked worktree
- Version/commit: working tree before repair commit

## Symptom

The full preview-acceptance controller unit suite timed out one existing test
after the dispatch correlation boundary was intentionally increased. That test
still advanced only the former two-minute timer while the implementation now
waits five minutes for observer and candidate dispatch receipts.

## Impact

Only local verification was affected. No application, database, provider,
secret, key, calendar, deployment, or external workflow state changed.

## Cause classification

- **Confirmed cause:** the test fixture encoded the former two-minute dispatch
  timeout and was not updated with the approved five-minute contract.
- **Rejected hypotheses:** the controller implementation did not hang in a
  live provider call; 73 other controller tests passed in the same run.

## Correction and prevention

Update the test to advance the new five-minute candidate dispatch deadline and
retain its reconciliation assertions. When changing a timing contract, search
for all tests that advance or assert the old duration before running the full
suite.

## Next step

Rerun the focused test and the full controller suite after the test-only
alignment, then continue with type, build, documentation, and monitored live
acceptance checks.

## Verification

The failure was reproduced locally with the full controller suite and was
contained before any external action. The existing test now advances the
five-minute boundary, and the focused test plus full 74-test controller suite
pass.

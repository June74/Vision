# SB-20260729-042416-task5-worker-test-patch-context: Worker test patch context was stale

- **Status:** closed
- **First observed:** 2026-07-29T04:24:16.3267175Z
- **Last observed:** 2026-07-29T04:31:37.7684282Z
- **Phase/task:** Phase B acceptance instrumentation Task 5 review fixes
- **Environment:** Local Phase B worktree
- **Version/commit:** Uncommitted review fixes based on `1880cf9`

## Symptom

The first patch for the activation-source Worker tests expected a nearby test
name and assertion layout that did not match the current file.

## Impact

The patch was rejected before changing the test file. No runtime, provider, or
external state changed.

## Cause classification

- **Confirmed cause:** The patch anchor was inferred instead of copied from the
  current file.
- **Hypotheses:** None.
- **Rejected hypotheses:** Concurrent modification.
- **Known exclusions:** The intended Worker tests were not partially applied.

## Correction and prevention

- **Correction:** Re-read the local wrong-owner test block and applied the
  change against exact current context.
- **Prevention:** Copy the immediate insertion anchor from the current file
  before applying a late-stage patch.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected patch applied cleanly. Focused Worker verification follows before
the final complete gate.

## Recurrence history

- 2026-07-29T04:31:37.7684282Z: Recurred when the Git-staging incident close
  patch expected a verification section that had not yet been created. The
  patch was rejected before mutation; the incident was re-read and updated
  against exact current context.

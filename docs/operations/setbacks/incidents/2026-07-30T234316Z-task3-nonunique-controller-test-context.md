# SB-20260730-234316-task3-nonunique-controller-test-context: Task 3 controller test patch matched a non-unique fixture context

- **Status:** closed
- **First observed:** 2026-07-30T23:43:16.282821Z
- **Last observed:** 2026-07-31T04:20:06.3651997Z
- **Phase/task:** Phase B live-acceptance closure Task 3 final repair
- **Environment:** Local focused controller test
- **Version/commit:** Task 3 final-repair working tree after `b1935577c211`

## Symptom

A test-only patch inserted a mock reset into an earlier timing fixture because the selected context was not unique.

## Impact

Inspection caught the misplaced test line before rerun; no production file or external state was affected.

## Reproduction conditions

Patch a repeated timing-fixture expression without anchoring to the exact test
name or unique surrounding assertion.

## Safe evidence

The misplaced reset was found by inspection before the suite ran.

## Attempts and outcomes

- One test-only line landed in the earlier timing case.
- The correction removes that line and applies it only inside the uniquely
  named exact-boundary case.

## Cause classification

- **Confirmed cause:** The patch context was repeated across controller timing
  fixtures.
- **Hypotheses:** None.
- **Rejected hypotheses:** No production deadline defect caused the edit
  placement.
- **Known exclusions:** No production file, provider, protected value, network,
  Git history, or external state was affected.

## Correction and prevention

- **Correction:** Revert the one misplaced line and reapply under a unique test
  heading.
- **Prevention:** Anchor timing-fixture patches to unique test names.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The next focused run must prove the exact-boundary case without altering the
earlier fixture.

## Recurrence history

- 2026-07-30T23:43:16.282821Z: First observed.
- 2026-07-31T04:14:50.6416214Z: Recurred when a two-hunk delayed-uniqueness
  fixture patch added the stable timestamp variable under the correct test but
  replaced a non-unique timestamp expression elsewhere, leaving the target
  return dynamic. No production file or external state changed. The correction
  is anchored to the unique state-read block and exact target line.
- 2026-07-31T04:20:06.3651997Z: Closed after the uniquely anchored timestamp
  corrections and complete controller verification passed.

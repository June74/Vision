# SB-20260730-202907-task2-review-active-invalid-signal-tests: Task 2 review found active-suppression invalid-signal test gap

- **Status:** closed
- **First observed:** 2026-07-30T20:29:07.549892Z
- **Last observed:** 2026-07-30T20:34:40.4261959Z
- **Phase/task:** Phase B live-acceptance closure Task 2 independent review
- **Environment:** Local Task 2 review package; no live/provider execution
- **Version/commit:** `6f03ad0090ba0b596acff00da2cd9ee920b3881b`

## Symptom

Worker tests for wrong-resource and expired-channel requests did not enable the active suppression selector or assert zero evidence emission.

## Impact

Task 2 is not accepted until two focused security-regression cases are added and re-reviewed; production logic was found correctly ordered and no live state changed.

## Reproduction conditions

Exercise wrong-resource and expired-channel Worker cases only under a normal
environment and assert Queue absence, without enabling the active selector or
observing the suppression evidence sink.

## Safe evidence

Independent review reported zero Critical findings, one Important test-coverage
finding, and zero Minors. It separately confirmed that production
authentication ordering is currently correct.

## Attempts and outcomes

- The full focused suites and gates passed before independent review.
- Independent review rejected acceptance because two explicit active-selector
  negative cases were not regression-locked.

## Cause classification

- **Confirmed cause:** The two fixtures predated suppression and were not
  upgraded to activate the new selector or spy its evidence writer.
- **Hypotheses:** None.
- **Rejected hypotheses:** No production ordering defect was found.
- **Known exclusions:** No deployment, provider call, Queue action, database
  mutation, private-data output, or external state change occurred.

## Correction and prevention

- **Correction:** Activate a valid suppression binding in both cases; assert
  zero evidence, replay inspection, reservation, Queue send, and mark-enqueued
  calls.
- **Prevention:** Every pre-authenticity/lifecycle negative case for a new
  post-authentication feature must run with that feature enabled and observe
  its terminal sink.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The focused fix recorded a two-test mutation RED, restored production code
exactly, passed all 34 Worker tests and typecheck, and committed only the Worker
test path. Independent re-review reported zero Critical, zero Important, and
zero Minor findings with both final verdicts passing.

## Recurrence history

- 2026-07-30T20:29:07.549892Z: First observed.
- 2026-07-30T20:34:40.4261959Z: Focused regression tests and clean independent
  re-review completed; incident closed.

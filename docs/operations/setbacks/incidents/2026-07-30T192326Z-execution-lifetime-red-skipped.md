# SB-20260730-192326-execution-lifetime-red-skipped: Execution lifetime RED was skipped

- **Status:** closed
- **First observed:** 2026-07-30T19:23:26.342076Z
- **Last observed:** 2026-07-30T19:24:03.7001477Z
- **Phase/task:** Phase B live-acceptance closure Task 1 TDD
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `44d8e93802ce834fd0c8ca620d81472e23431b00`

## Symptom

The integration test for execution-time suppression lifetime was first run after selector propagation had already been implemented.

## Impact

The test passed but lacked observed pre-implementation RED evidence; no provider or external state changed.

## Reproduction conditions

Run the focused integration test after adding the execution-time selector
propagation without first observing the missing-behavior failure.

## Safe evidence

The initial integration run passed 41 tests. No private or provider value was
rendered.

## Attempts and outcomes

- Removed only the new selector propagation while retaining the test.
- The integration suite then failed exactly because a ten-minute-plus-one-
  millisecond suppression lifetime was admitted under the old 30-minute rule.
- Reapplied the minimal selector propagation and reran the same suite.

## Cause classification

- **Confirmed cause:** The focused integration RED command was omitted between
  writing the test and implementing selector propagation.
- **Hypotheses:** None.
- **Rejected hypotheses:** The test was not incapable of failing; it failed for
  the intended overlong suppression lifetime once the implementation was
  removed.
- **Known exclusions:** No provider, database, network, or external state was
  involved.

## Correction and prevention

- **Correction:** Re-established strict RED/GREEN order for this isolated
  runtime slice and retained the verified minimal implementation.
- **Prevention:** Track the integration RED command separately from the unit
  RED command when the brief lists it only in final GREEN verification.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected RED had 1 intended failure and 40 passes. The subsequent GREEN
had 41 passing tests.

## Recurrence history

- 2026-07-30T19:23:26.342076Z: First observed.
- 2026-07-30T19:24:03.7001477Z: The isolated RED/GREEN correction completed
  with the intended failure followed by 41 passing tests.

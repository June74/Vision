# SB-20260730-211953-task3-calendar-observer-legacy-name: Task 3 follow-up retained a legacy calendar observer name

- **Status:** closed
- **First observed:** 2026-07-30T21:19:53.116588Z
- **Last observed:** 2026-07-30T21:23:57.6765941Z
- **Phase/task:** Phase B live-acceptance closure Task 3 GREEN iteration
- **Environment:** Local Task 3 focused tests
- **Version/commit:** Uncommitted Task 3 implementation based on `24e959f`

## Symptom

A six-file follow-up left one failing assertion because the calendar observer still used its legacy naming contract.

## Impact

One of 142 focused tests failed until the local naming branch was corrected; no live or external state changed.

## Reproduction conditions

Run the post-implementation observer-focused suite while one calendar
observation branch still exposes its pre-Task-3 name.

## Safe evidence

Five of six files passed and 141 of 142 tests passed; the remaining failure was
bounded to the legacy name assertion.

## Attempts and outcomes

- The focused run isolated one naming mismatch.
- The implementer patched the local branch before the next full rerun.

## Cause classification

- **Confirmed cause:** One observer naming branch was not updated with the new
  Task 3 family contract.
- **Hypotheses:** None.
- **Rejected hypotheses:** Controller, R2 reader, and observer resolver logic
  were already green in their separate 21-test slice.
- **Known exclusions:** No provider, private-data, live, or external state was
  involved.

## Correction and prevention

- **Correction:** Update the remaining calendar observer name branch.
- **Prevention:** Family-vocabulary changes require an exhaustive legacy-name
  rejection assertion across every observer path.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected exact 19-file run passed all 55 collected project suites and all
412 tests, and full typecheck exited zero.

## Recurrence history

- 2026-07-30T21:19:53.116588Z: First observed.
- 2026-07-30T21:23:57.6765941Z: Corrected full suite and typecheck passed;
  incident closed.

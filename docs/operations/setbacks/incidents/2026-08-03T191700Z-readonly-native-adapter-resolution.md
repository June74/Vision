# SB-20260803-191700-readonly-native-adapter-resolution: Read-only rollback validation could not resolve a native process adapter

- **Status:** resolved
- **First observed:** 2026-08-03T19:17:00.032435Z
- **Last observed:** 2026-08-03T19:17:00.032435Z
- **Phase/task:** Phase B live rollback validation
- **Environment:** Local Windows PowerShell 5.1 controller
- **Version/commit:** Task 1 repair and Task 2 read-only validation

## Symptom

The no-XDG validate_current_rollback run accepted fresh schedule evidence, then returned native_process_adapter_resolution_failed.

## Impact

No deployment or provider mutation occurred. Validation was incomplete until
the explicit adapter was repaired and the read-only validation reran
successfully.

## Reproduction conditions

Run the no-XDG `validate_current_rollback` controller before the explicit
TSX-to-Node native process adapter is present.

## Safe evidence

- Task 1's focused adapter test passed.
- Task 1's full 12-check native-controller suite passed.
- An independent specification and quality review found zero findings.
- Task 2's successful live read-only result reported only the allowlisted
  outcome with `current_rollback_valid: true`.

## Attempts and outcomes

1. The earlier no-XDG validation accepted fresh schedule evidence, then could
   not resolve the native process adapter.
2. Task 1 added and verified the explicit TSX-to-Node adapter.
3. Task 2 re-ran the live read-only validation successfully after the fresh
   schedule confirmation gate.

## Cause classification

- **Confirmed cause:** The controller lacked an explicit TSX-to-Node native
  process adapter.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The repaired adapter is insufficient for the
  native-controller checks or current live read-only validation.
- **Known exclusions:** No candidate deployment, rollback, schedule change,
  other provider mutation, credential output, or secret output occurred.

## Correction and prevention

- **Correction:** Task 1 supplied the explicit adapter and verified it with
  the focused test, full 12-check suite, and independent review.
- **Prevention:** Keep the explicit adapter under focused and suite-level
  regression coverage.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None for this incident.

## Verification and related work

The repaired adapter passed Task 1's focused and 12-check validation and its
independent review. Task 2 then completed the live read-only validation with
`current_rollback_valid: true`.

## Recurrence history

- 2026-08-03T19:17:00.032435Z: First observed.
- 2026-08-03: Task 1 repair and Task 2 successful live read-only result
  resolved the incident.

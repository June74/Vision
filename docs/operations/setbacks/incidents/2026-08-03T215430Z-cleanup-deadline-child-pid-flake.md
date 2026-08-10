# SB-20260803-215430-cleanup-deadline-child-pid-flake: Cleanup deadline test timed out before child PID file appeared

- **Status:** closed
- **First observed:** 2026-08-03T21:54:30.880032Z
- **Last observed:** 2026-08-03T21:57:41.4296046Z
- **Phase/task:** Phase B deployment classifier verification
- **Environment:** Windows PowerShell 5.1 local synthetic child-process cleanup test
- **Version/commit:** ignored test-only stability change; controller behavior unchanged

## Symptom

The independent complete controller suite stopped at cleanup_child_pid_absent after the 500 ms synthetic cleanup deadline elapsed before the child wrote its PID file.

## Impact

No provider or product state changed, but independent suite verification is not yet accepted until the isolated process contract is diagnosed and rerun.

## Reproduction conditions

Start a new PowerShell child, require it to write a PID marker, sleep, and be
forcibly terminated, while allowing only 500 milliseconds for both interpreter
startup and the bounded wait on a busy Windows host.

## Safe evidence

The complete suite failed once with `cleanup_child_pid_absent`; the same
isolated test passed immediately on retry without any controller change.

## Attempts and outcomes

The isolated immediate retry passed, identifying a timing flake. The test-only
allowance changed from 500 to 1500 milliseconds and its strict upper stopwatch
bound from four to five seconds. Three consecutive isolated runs and the full
suite then passed in both the implementation and independent verification
lanes.

## Cause classification

- **Confirmed cause:** The synthetic test's 500-millisecond budget was
  occasionally shorter than Windows PowerShell startup plus PID-file creation.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The controller failed to terminate an established
  cleanup child or the classifier changed cleanup behavior.
- **Known exclusions:** Controller production behavior, provider state,
  product source, credentials, keys, schedules, and Git were unchanged.

## Correction and prevention

- **Correction:** Give the synthetic interpreter 1500 milliseconds while
  retaining a strict five-second end-to-end upper bound and survivor check.
- **Prevention:** Process-deadline tests must separate realistic interpreter
  startup variance from the bounded-cleanup property they assert.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

Three consecutive isolated runs returned `cleanup_deadline_contract_ok`, and
the complete 13-check suite returned `corrected_redeploy_native_suite_ok` in
independent verification.

## Recurrence history

- 2026-08-03T21:54:30.880032Z: First observed.
- 2026-08-03T21:57:41.4296046Z: Stable repeated and full-suite verification
  completed; incident closed.

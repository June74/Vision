# SB-20260727-193832-unit-suite-short-timeout: Unit suite exceeded the short segmented timeout

- **Status:** closed
- **First observed:** 2026-07-27T19:38:32Z
- **Last observed:** 2026-07-31T21:02:25.7615346-05:00
- **Phase/task:** Phase B Task 7 continuation
- **Environment:** Local Phase B worktree
- **Version/commit:** `9bbc4be`

## Symptom

The isolated unit-test command exceeded a 55-second shell deadline without
returning a completed test result.

## Impact

TypeScript checks passed, but local unit-test status remains unknown. No
assertion failure was reported before termination and no provider state changed.

## Cause classification

- **Confirmed cause:** The local unit suite runtime is longer than the short
  observation window.
- **Known exclusions:** This timeout alone does not reproduce the hosted
  application-check failure.

## Correction and prevention

- **Correction:** Run the unit suite as a hidden background process, poll its
  completion at intervals shorter than one minute, and inspect only its final
  exit code and safe summary.
- **Prevention:** Use the background-poll pattern for this repository's long
  suites instead of repeatedly terminating them under short shell deadlines.

## Verification and related work

The background run completed after 76 seconds and produced an authoritative
single-test failure. The longer-run result is tracked as the tail-correction
test-coverage incident; the timeout workaround itself is verified.

## Recurrence history

- 2026-07-29T18:34:29Z: Recurred during acceptance instrumentation Task 7
  because the shell deadline was set to one second while expecting a yielded
  long-running cell. The harness terminated the command instead. No completed
  test result was produced, no assertion failure was reported, and no provider
  or external state changed. The exact suite will be rerun with a normal shell
  deadline and bounded output.

The exact Task 7 unit project rerun completed with exit zero: 78 files passed,
1 file was intentionally skipped, 1,040 tests passed, and 1 test was
intentionally skipped. This closes the recurrence.
- 2026-07-30T18:36:59.5276737Z: Recurred during the Phase B closure baseline
  when the complete unit project exceeded a 120-second command-wrapper
  deadline before Vitest emitted any final result. No assertion failure,
  repository change, provider access, or external mutation was observed. The
  unchanged suite will be rerun with a resumable hidden-process poll and a
  longer process budget.
- 2026-07-30T19:00:40Z: The resumable rerun completed with exit zero after
  180.3 seconds: 86 test files and 1,181 tests passed, with one file and one
  test intentionally skipped. This verifies the timeout workaround and closes
  the baseline recurrence.
- 2026-07-31T21:02:25.7615346-05:00: The Task 7 continuation attempted a
  package-script fallback after the direct focused command was unavailable.
  The literal separator reached Vitest, started the full unit project, and
  exceeded the 120-second bounded runner without a final result. No assertion
  result or external mutation was observed. Focused retries use the local
  `vitest.cmd` shim directly rather than the package-script fallback.

# SB-20260727-193832-unit-suite-short-timeout: Unit suite exceeded the short segmented timeout

- **Status:** closed
- **First observed:** 2026-07-27T19:38:32Z
- **Last observed:** 2026-07-27T19:38:32Z
- **Phase/task:** Phase B restore Task 4 diagnosis
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

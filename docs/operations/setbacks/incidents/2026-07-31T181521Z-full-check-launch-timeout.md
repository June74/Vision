# SB-20260731-181521-full-check-launch-timeout: Full-check wrapper used an insufficient timeout

- **Status:** closed
- **First observed:** 2026-07-31T18:15:21.9412916Z
- **Last observed:** 2026-07-31T18:34:34.1475347Z
- **Phase/task:** Phase B Task 3 complete repository verification
- **Environment:** Local test runner
- **Version/commit:** 0c3ea58 plus verified lifecycle and ledger edits

## Symptom

The full `pnpm.cmd check` wrapper was launched with an approximately one-second
tool timeout and returned exit code 124 before the repository suite could
finish.

## Impact

The result is an orchestration timeout, not test evidence. The temporary output
paths may contain partial output and must be verified before cleanup and retry.
No provider, network, environment, secret, staging, or commit was touched.

## Cause classification

- **Confirmed cause:** The first shell timeout was set for early yielding, and
  the subsequent 120-second retry was still shorter than this repository's
  complete check duration.
- **Hypotheses:** The child process may have been terminated with the wrapper;
  exact temporary-file state will determine safe cleanup.
- **Known exclusions:** No test assertion failure was reported by the wrapper.

## Correction and prevention

- **Correction:** Inspect only the exact two temporary paths, remove them after
  target validation, and rerun with the previously proven ten-minute bound.
- **Prevention:** Use the tool's long timeout for synchronous redirected checks;
  reserve wait/resume only for calls that explicitly return a running cell.
- **Owner:** Codex.
- **Next diagnostic step:** Check existence and last-write stability of the two
  exact temporary files.

## Recurrence history

- 2026-07-31T18:15:21.9412916Z: Observed and contained before accepting any
  full-check result.
- 2026-07-31T18:18:12.2702486Z: Recurred when the 120-second retry remained too
  short; no assertion failure was accepted from the timed-out run.
- 2026-07-31T18:19:00.0422643Z: Recurred because the next launch accidentally
  reused the one-second timeout instead of the documented 600000-millisecond
  bound. The mistake was caught before treating the result as evidence.
- 2026-07-31T18:34:34.1475347Z: Closed after the complete check ran within the
  verified 600000-millisecond bound and returned the authoritative exit code 0.

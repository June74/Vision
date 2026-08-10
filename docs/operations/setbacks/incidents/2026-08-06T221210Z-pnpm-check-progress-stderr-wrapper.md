# SB-20260806-221210-pnpm-check-progress-stderr-wrapper: Full check wrapper treated pnpm progress as a failure

- **Status:** closed
- **First observed:** 2026-08-06T22:12:10.1707858Z
- **Last observed:** 2026-08-06T22:35:32.3387883Z
- **Area:** Phase B local full-check verification
- **Impact:** A PowerShell wrapper stopped while `pnpm check` was emitting a
  progress line on stderr, before the wrapper could inspect the actual exit
  status. No provider, deployment, credential, key, or tracked source action
  ran.

## Evidence

The wrapper raised a PowerShell native-command error from pnpm's progress
output rather than returning the check result. A follow-up process-count check
found no `pnpm`, `vitest`, or `tsx` process; unrelated Node processes were not
inspected further. No raw test output was retained or emitted.

## Cause classification

- **Confirmed cause:** Terminating PowerShell error handling around a native
  pnpm command that writes progress to stderr.
- **Hypotheses:** None required for this wrapper defect.
- **Rejected hypotheses:** No evidence of a product or provider failure.

## Correction and prevention

- Invoke the command through a bounded `System.Diagnostics.Process` with
  stdout/stderr redirected, then assert only its exit code and bounded output
  lengths.
- Do not treat progress-channel text as the test result and never print raw
  captured output.

## Verification

The corrected native process wrapper completed the full `pnpm check` with
exit zero. It isolated stdout/stderr and emitted only bounded lengths; no raw
progress or diagnostic text was exposed.

## Owner and next step

- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; the native bounded full check is green.

## Recurrence history

- 2026-08-06T22:35:32.3387883Z: Closed after the native bounded full check
  completed with exit zero.

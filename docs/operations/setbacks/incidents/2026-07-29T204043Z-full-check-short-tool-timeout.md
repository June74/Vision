# SB-20260729-204043-full-check-short-tool-timeout

- **Status:** closed
- **First observed:** 2026-07-29T20:40:43Z
- **Last observed:** 2026-07-30T03:28:50.7168206Z
- **Phase/task:** Phase B consolidated final-fix full verification
- **Environment:** Local Phase B worktree
- **Version/commit:** `6ebabd1`
- **Title:** Full repository check used a short command timeout
- **Impact:** The full check was terminated before returning a pass/fail result. No deployment or external state changed.
- **Cause:** The command timeout was sized for yielding behavior that this shell tool does not provide.
- **Resolution:** Confirmed no orphaned test process, removed the interrupted log, and passed the same aggregate check with a long bounded timeout.
- **Recurrence:** First full-check attempt in this fix wave.

## Recurrence history

- 2026-07-30T03:28:50.7168206Z: Gate 0 repeated the same aggregate
  `pnpm.cmd check` invocation with a two-minute tool timeout even though the
  earlier incident established that this shell does not yield the running
  process. The command reached the unit-test runner without reporting a test
  failure before termination. A bounded process check reported zero orphaned
  Gate 0 processes. The retry is split into repository-declared component
  scripts with realistic per-command bounds.

## Cause classification

- **Confirmed cause:** The controller ignored the recorded timeout behavior and
  reused an insufficient aggregate-command timeout.
- **Hypotheses:** None.
- **Rejected hypotheses:** No test failure was reported before termination.
- **Known exclusions:** No deployment, network call, provider mutation,
  credential access, or private-data output occurred.

## Prevention and verification

- **Prevention:** Run long aggregate gates with a proven long bound, or run
  their declared component scripts separately so each result is observable.
- **Owner:** Codex.
- **Next diagnostic step:** Complete the same declared component gates and
  record their exit categories.

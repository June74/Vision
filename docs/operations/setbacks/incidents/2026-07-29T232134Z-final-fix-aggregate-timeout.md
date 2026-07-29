# SB-20260729-232134-final-fix-aggregate-timeout: Aggregate gate process budget was too short

- **Status:** closed
- **First observed:** 2026-07-29T23:21:34.4164787Z
- **Last observed:** 2026-07-29T23:21:34.4164787Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 2
- **Environment:** Local Phase B worktree
- **Version/commit:** Uncommitted wave-2 fixes based on `41d3e74`

## Symptom

The aggregate `check` gate exceeded the shell command's 60-second process
timeout and was terminated before returning a result.

## Impact

The run produced no acceptance result. It did not deploy, contact a provider,
or expose a protected value. Any local build output is reproducible and
remains subject to the complete rerun.

## Cause classification

- **Confirmed cause:** The shell process budget was shorter than the normal
  aggregate gate duration.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No test assertion failure was reported.
- **Known exclusions:** No provider or production mutation was authorized.

## Correction and prevention

- **Correction:** Rerun the same aggregate gate with a longer process timeout
  while using short output-yield intervals.
- **Prevention:** Give complete aggregate gates a multi-minute process budget;
  use the wait mechanism, rather than the process timeout, for progress
  responsiveness.
- **Owner:** Codex and project owner.

## Verification and related work

The complete rerun returned exit zero after 143.8 seconds: 1,169
unit/integration/security tests passed with one intentional skip, 179 contract
tests passed, and 94 Worker tests passed. TypeScript, documentation, build, and
release security checks also completed inside the aggregate gate.

## Recurrence history

- 2026-07-29T23:21:34.4164787Z: First observed.

# SB-20260726-203842-full-check-tool-timeout: Full quality gate exceeded tool timeout

- **Status:** closed
- **First observed:** 2026-07-26T20:38:42.4041444Z
- **Last observed:** 2026-07-26T20:46:22.9385791Z
- **Phase/task:** Phase B clean-room verification
- **Environment:** Local Phase B worktree
- **Version/commit:** `9f5a0d5`

## Symptom

The combined `pnpm check` process exceeded the command tool's two-minute
limit while the unit-test stage was running.

## Impact

The combined gate produced no authoritative final result. No provider state
changed and no test failure was reported before termination.

## Reproduction conditions

Run the full sequential repository quality gate under a command timeout shorter
than the suite's total duration.

## Safe evidence

TypeScript checking completed and the unit-test runner started before the
command tool returned its timeout status.

## Attempts and outcomes

- The combined gate timed out during its first test suite.
- Verification was split into individually bounded repository stages so each
  stage can return an authoritative exit result.

## Cause classification

- **Confirmed cause:** The command timeout was shorter than the combined gate's
  runtime.
- **Hypotheses:** None.
- **Rejected hypotheses:** No test assertion failure was reported.
- **Known exclusions:** No live resource or application configuration changed.

## Correction and prevention

- **Correction:** Run the same gate as its constituent scripts with suitable
  per-stage timeouts.
- **Prevention:** Reserve a longer tool timeout for `pnpm check`, or use the
  stage commands listed in the clean-room plan.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Complete every constituent stage and record their
  exit results.

## Verification and related work

The lower-level background process completed the full command far enough to
return an authoritative test result, so the tool timeout no longer blocks
verification. A separate migration-file read incident is tracked independently.

## Recurrence history

- 2026-07-26T20:38:42.4041444Z: First observed.
- 2026-07-26T20:46:22.9385791Z: Closed after the background process returned
  a complete suite result without the command tool terminating it.

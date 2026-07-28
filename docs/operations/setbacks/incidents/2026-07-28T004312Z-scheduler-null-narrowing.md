# SB-20260728-004312-scheduler-null-narrowing: Scheduler evidence helper did not narrow null

- **Status:** closed
- **First observed:** 2026-07-28T00:43:12.0569819Z
- **Last observed:** 2026-07-28T00:45:38.1475011Z
- **Phase/task:** Listener-first restore retry Task 2 implementation
- **Environment:** Local Phase B worktree
- **Version/commit:** `ff6a767`

## Symptom

The first combined Task 2 check passed all 59 focused tests, then TypeScript
reported that temporary restore evidence could still be null at the owner
outcome check.

## Impact

The implementation did not typecheck. No provider, browser, network, database,
or deployment action occurred.

## Reproduction conditions and safe evidence

Call a helper that returns an ordinary boolean after checking a nullable value,
then access the original value in the caller. The helper result does not act as
a TypeScript type predicate for the caller's local variable.

## Attempts and outcomes

- The five focused test files passed 59 tests.
- `pnpm.cmd typecheck` stopped at the nullable evidence access in
  `src/jobs/scheduled.ts`.
- The direct null guard corrected the source error and the covering scheduler
  test passed 12 tests.
- The next complete typecheck reached seven test-only errors: an underspecified
  R2 mock tuple, a generic transaction mock widened to `unknown`, three
  nullable-result assertions, and one non-tuple spread.

## Cause classification

- **Confirmed cause:** The boolean-returning emission helper did not narrow
  the caller's `TemporaryRestoreEvidence | null` variable. Several new tests
  also relied on Vitest runtime transpilation without giving TypeScript the
  exact mock tuple, generic callback, nullable branch, or parameter tuple.
- **Hypotheses:** None.
- **Rejected hypotheses:** Runtime claim behavior and focused tests were not
  failing.
- **Known exclusions:** No private value appeared in the diagnostic.

## Correction and prevention

- **Correction:** Branch explicitly on `evidence === null` before calling the
  emission helper and reading the owner outcome.
- **Prevention:** Use direct null guards when later statements need control-flow
  narrowing; keep emission helpers responsible only for output.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Rerun focused tests and typecheck.

## Verification and related work

The source correction is verified by 12 passing scheduler tests. After the
test-only declarations were corrected, `pnpm.cmd typecheck` completed with
both source and test TypeScript projects passing.

## Recurrence history

- 2026-07-28T00:43:45Z: The corrected rerun advanced beyond the source error
  and exposed the seven latent test-only typing errors listed above. Runtime
  behavior remained green; no provider or private-data boundary was involved.
- 2026-07-28T00:45:38.1475011Z: The first test-typing correction retained an
  arrow token in generic object-method syntax. TypeScript stopped at the
  parser error before semantic checks. No runtime or provider action occurred;
  the correction is limited to the malformed test declaration.

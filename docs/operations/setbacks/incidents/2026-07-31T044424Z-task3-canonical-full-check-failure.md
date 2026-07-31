# SB-20260731-044424-task3-canonical-full-check-failure: Canonical full repository gate exited after focused checks passed

- **Status:** closed
- **First observed:** 2026-07-31T04:44:24.4805062Z
- **Last observed:** 2026-07-31T05:02:52.0572913Z
- **Phase/task:** Phase B Task 3 canonical integration verification
- **Environment:** Main Phase B worktree; captured full repository gate
- **Version/commit:** 5f11f52

## Symptom

The full `check` pipeline exited unsuccessfully after approximately 197
seconds, despite the focused Task 3 tests and the separately run compiler,
documentation, build, and security gates passing.

## Impact

Task 3 cannot be declared integrated or sent for final independent review until
the failed aggregate stage is safely classified and corrected. No provider or
external state changed.

## Reproduction conditions

Run the repository's complete local quality pipeline at the integrated Task 3
commit with all output captured.

## Safe evidence

The process returned only a nonzero exit category and elapsed duration. The
captured stream was not printed. Focused controller, resolver, workflow,
restore, schema, and temporary-surface checks had already passed with zero
failures. Bounded parsing identified exactly one timed-out file:
`tests/unit/scripts/print-safe-tail.test.ts`.

## Attempts and outcomes

- TypeScript compilation passed.
- Documentation coverage passed.
- Focused Task 3 test groups passed.
- Repository security scan passed.
- Production build passed.
- The combined full gate exited unsuccessfully.
- The exact timed-out file then passed independently with 28 passed tests and
  zero failures in approximately 37 seconds.

## Cause classification

- **Confirmed cause:** One test at
  `tests/unit/scripts/print-safe-tail.test.ts:499` performs three sequential
  child-process checks under Vitest's default five-second case limit. It
  repeatedly exceeds that limit under the complete suite load while the file
  passes alone.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The separately verified compiler, documentation,
  build, and security stages are not currently implicated.
- **Known exclusions:** No raw stream, protected value, provider action, or
  external mutation occurred.

## Correction and prevention

- **Correction:** Give only the identified three-process test a bounded
  15-second allowance, then rerun the focused file and complete repository
  gate.
- **Prevention:** Keep aggregate output captured and stop after the first safe
  failure category.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The corrected focused file passed all 28 tests. The complete repository
`check` pipeline then passed at the integrated Task 3 tip in approximately 221
seconds.

## Recurrence history

- 2026-07-31T04:44:24.4805062Z: First observed and contained before diagnostic
  output was inspected.
- 2026-07-31T04:54:43.4639015Z: The complete unit project failed again after
  approximately 163 seconds. Four concurrent standalone copies of the
  originally implicated file had passed, so the failure is reproducible only
  in the broader suite context so far.
- 2026-07-31T04:56:09.1738814Z: Bounded stack-location inspection identified
  source line 499. The case performs three sequential process runs under the
  five-second default, confirming a suite-load test-timeout flaw rather than a
  production regression.
- 2026-07-31T05:02:52.0572913Z: Closed after the per-case 15-second allowance
  passed the focused file and the complete repository gate.

# SB-20260726-204622-ai-budget-migration-file-open-error: AI budget test could not open a migration file

- **Status:** closed
- **First observed:** 2026-07-26T20:46:22.9385791Z
- **Last observed:** 2026-07-26T20:50:27.1782591Z
- **Phase/task:** Phase B clean-room verification
- **Environment:** Local Phase B worktree on OneDrive-backed storage
- **Version/commit:** `9f5a0d5` plus uncommitted CI policy test

## Symptom

One AI budget integration test reported an operating-system `unknown error`
while opening migration `0009`; its business-rule assertion did not run.

## Impact

The unit/integration/security project failed one test while 610 passed and one
was skipped. The full quality gate stopped before contract, Worker,
documentation, build, and release-scan stages.

## Reproduction conditions

Run the full unit project with multiple PGlite-backed files reading the same
numbered migrations concurrently from the OneDrive-backed worktree.

## Safe evidence

The stack trace ended at the test's read-only migration-file load. It reported
no database, provider, credential, or assertion error.

## Attempts and outcomes

- The full project produced one file-open error.
- The exact test passed three consecutive isolated runs.
- The full 24-test file passed.
- The full unit/integration/security project then passed 611 tests with one
  intentional skip under the original four-worker configuration.

## Cause classification

- **Confirmed cause:** None established.
- **Hypotheses:** A transient filesystem or concurrent file-handle condition
  interrupted the read.
- **Rejected hypotheses:** The reported evidence does not show a budget
  settlement assertion failure.
- **Known exclusions:** The migration existed and was read successfully by
  earlier focused schema tests.

## Correction and prevention

- **Correction:** No application change was made; the failed boundary was
  rerun from narrow to broad scope until the original configuration passed.
- **Prevention:** Retain the migration-contract tests and require a clean full
  project rerun after any future file-open recurrence.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed; reopen only if the same
  filesystem category recurs.

## Verification and related work

The exact test passed 3/3 repeated runs, its file passed 24/24, and the full
project passed 611 tests with one intentional skip.

## Recurrence history

- 2026-07-26T20:46:22.9385791Z: First observed.
- 2026-07-26T20:50:27.1782591Z: Closed after progressively broader reruns
  passed without a code change.

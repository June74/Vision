# SB-20260728-014416-vitest-project-filter-excluded-focused-files: Vitest project filter excluded focused files

- **Status:** closed
- **First observed:** 2026-07-28T01:44:16.5948330Z
- **Last observed:** 2026-07-28T01:44:16.5948330Z
- **Phase/task:** Listener-first restore retry Task 3 Step 1
- **Environment:** Local Phase B worktree
- **Version/commit:** `7d2f9f6`; reviewed candidate `0f08fc1`

## Symptom

The direct test runner started, but an added project filter selected no tests
from the five requested integration files.

## Impact

That invocation produced no verification result. No repository, provider,
database, secret, workflow, or R2 state changed.

## Reproduction conditions and safe evidence

Invoke the exact integration-test file list with a project filter whose include
pattern covers a different test directory. The runner exits without executing
the requested files.

## Attempts and outcomes

- The filtered invocation ran zero tests.
- The controller reread the project include patterns.
- The exact five files were then run through the repository-local Windows
  launcher without the incompatible filter; 59 tests passed.

## Cause classification

- **Confirmed cause:** The supplied project filter did not include the five
  focused integration files in this invocation shape.
- **Hypotheses:** None.
- **Rejected hypotheses:** The focused tests were not missing or failing.
- **Known exclusions:** No private value or external state was involved.

## Correction and prevention

- **Correction:** Run exact files through the verified local launcher using
  the repository configuration that includes integration tests.
- **Prevention:** Check configured include patterns before adding a project
  filter to an exact-file run.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected exact-file run passed five files and 59 tests with zero failures.

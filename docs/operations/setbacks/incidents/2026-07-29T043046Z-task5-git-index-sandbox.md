# SB-20260729-043046-task5-git-index-sandbox: Sandbox blocked linked-worktree staging

- **Status:** closed
- **First observed:** 2026-07-29T04:30:46.4130206Z
- **Last observed:** 2026-07-29T04:30:46.4130206Z
- **Phase/task:** Phase B acceptance instrumentation Task 5 review fixes
- **Environment:** Managed local sandbox and linked Git worktree
- **Version/commit:** Uncommitted review fixes based on `1880cf9`

## Symptom

`git add -A` could not create the linked worktree's `index.lock` under the
parent repository metadata directory.

## Impact

No files were staged by the failed command. The verified working-tree changes
remain intact.

## Cause classification

- **Confirmed cause:** The managed sandbox permits worktree source writes but
  not the linked parent repository metadata write needed for staging.
- **Hypotheses:** None.
- **Rejected hypotheses:** A stale lock file.
- **Known exclusions:** No source, provider, or external state was changed by
  the failed staging attempt.

## Correction and prevention

- **Correction:** Retry the exact scoped Git staging operation with the
  repository-metadata permission explicitly approved by the task's commit
  requirement.
- **Prevention:** Expect linked-worktree staging and commit operations to need
  repository-metadata permission in this sandbox.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The approved retry staged the exact Task 5 source, tests, references, report,
and setback records. The staged inventory was confirmed before commit.

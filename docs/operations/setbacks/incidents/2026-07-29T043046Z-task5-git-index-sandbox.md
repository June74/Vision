# SB-20260729-043046-task5-git-index-sandbox: Sandbox blocked linked-worktree staging

- **Status:** closed
- **First observed:** 2026-07-29T04:30:46.4130206Z
- **Last observed:** 2026-07-31T04:31:59.3465504Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 4
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

On 2026-07-29T17:05:31Z the same linked-worktree metadata boundary recurred
during scoped Task 6 staging. No path was staged by the failed attempt; the
exact scoped command is retried with repository-metadata permission.

On 2026-07-30T01:34:09.3799447Z the wave-4 tracked-file stage hit the same
linked-worktree index boundary. The lock could not be created, the staged diff
remained empty, and the verified working changes remained intact. The exact
tracked-file stage and commit require the same narrow metadata permission.

On 2026-07-30T19:32:49.8884559Z Task 1 exact-path staging hit the same
linked-worktree index boundary. The lock could not be created before any path
was staged. The identical allowlisted stage and verification require the same
narrow repository-metadata permission.

On 2026-07-30T20:37:56.4287329Z the dedicated setback-ledger stage hit the
same linked-worktree index boundary. Git exited before staging any path; the
setback files remain intact. The exact setback-only stage requires the same
narrow repository-metadata permission.

On 2026-07-30T23:03:07.1839924Z the Task 3 exact-allowlist stage hit the same
linked-worktree index boundary. Git exited before staging any path; all green
implementation and documentation changes remain intact. The identical scoped
stage requires narrow repository-metadata permission.

On 2026-07-31T00:43:09.8934480Z the final bounded Task 3 exact-allowlist stage
hit the same linked-worktree index boundary. Git exited before staging any path;
the identical 29-path operation was retried with narrow repository-metadata
permission.

On 2026-07-31T04:31:21.1301691Z the isolated controller repair's exact
four-path stage hit the linked-worktree index-lock boundary. Git exited before
staging any path. The identical allowlisted operation requires narrow
repository-metadata permission.

On 2026-07-31T04:31:59.3465504Z the identical four-path stage succeeded with
narrow repository-metadata permission; cached inventory and whitespace checks
matched exactly and the incident closed.

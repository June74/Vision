# SB-20260731-174919-git-worktree-index-permission: Sandbox blocked the worktree Git index

- **Status:** closed
- **First observed:** 2026-07-31T17:49:19.1079389Z
- **Last observed:** 2026-07-31T21:54:05.3420661Z
- **Phase/task:** Phase B Tasks 3 and 4 setback-ledger commit
- **Environment:** Local Git worktree
- **Version/commit:** ee8f260 plus two setback-ledger paths

## Symptom

The exact two-file setback commit could not create the linked worktree's
`index.lock` because the repository metadata directory is read-only inside the
workspace sandbox.

## Impact

No path was staged or committed. Project code, provider state, network state,
environment values, and secrets were unaffected.

## Cause classification

- **Confirmed cause:** The worktree's Git metadata is stored under the parent
  repository `.git/worktrees` directory, which requires approved write access.
- **Hypotheses:** None remaining.
- **Known exclusions:** This was not a merge conflict, stale lock, or content
  validation failure.

## Correction and prevention

- **Correction:** Retry the identical bounded Git operation with repository
  metadata write authority.
- **Prevention:** Use the established approved Git path for commits from this
  linked worktree.
- **Owner:** Codex.
- **Next diagnostic step:** None; retry only the exact three ledger paths.

## Recurrence history

- 2026-07-31T17:49:19.1079389Z: Observed and contained before staging.
- 2026-07-31T21:53:19.8105626Z: Recurred when Task 4 ledger staging tried to
  create the linked-worktree index lock inside shared repository metadata.
  Nothing was staged; retry requires the established bounded metadata-write
  approval.
- 2026-07-31T21:54:05.3420661Z: Closed after the approved bounded retry staged
  only the setback index and incident directory and the cached diff audit
  completed without an error.

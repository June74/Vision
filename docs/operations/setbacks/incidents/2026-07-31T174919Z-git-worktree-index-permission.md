# SB-20260731-174919-git-worktree-index-permission: Sandbox blocked the worktree Git index

- **Status:** closed
- **First observed:** 2026-07-31T17:49:19.1079389Z
- **Last observed:** 2026-07-31T17:49:19.1079389Z
- **Phase/task:** Phase B Task 3 setback-ledger commit
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

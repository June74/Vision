# SB-20260731-143828-task3-stage-index-lock-permission: Task 3 staging could not create the worktree index lock

- **Status:** closed
- **First observed:** 2026-07-31T14:38:28.6621493Z
- **Last observed:** 2026-07-31T14:39:50.4303548Z
- **Phase/task:** Phase B Task 3 verified implementation staging
- **Environment:** Main Phase B worktree; restricted filesystem sandbox
- **Version/commit:** c5de12d plus verified unstaged controller and resolver repairs

## Symptom

Exact-path `git add` failed because the restricted process could not create the
linked worktree's Git index lock.

## Impact

The eight verified implementation paths remain safely on disk but unstaged and
uncommitted. No verification result or source content was lost.

## Reproduction conditions

Attempt to stage linked-worktree files when the sandbox permits repository
worktree writes but denies writes to the parent repository's Git metadata.

## Safe evidence

Git returned only the index-lock permission category. No source, URI,
credential, protected identifier, provider value, environment value, staged
content, or external system was exposed or changed.

## Attempts and outcomes

- The exact eight-path allowlist had already passed scope verification.
- Staging stopped before any index change.

## Cause classification

- **Confirmed cause:** Sandbox permission denied creation of the linked
  worktree index lock.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** No dirty-index collision or source/test failure is
  indicated.
- **Known exclusions:** No provider, network, deployment, or remote Git action
  occurred.

## Correction and prevention

- **Correction:** Repeat the same exact-path staging command with approved Git
  metadata write access, then revalidate cached paths before commit.
- **Prevention:** Expect linked-worktree staging to require escalation when the
  parent `.git` directory is read-only to the sandbox.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Obtain scoped Git staging permission and retry the
  unchanged eight-path allowlist.

## Verification and related work

Before staging, the combined focused group, TypeScript, documentation, build,
security scan, security evidence, and complete repository check all passed.

## Recurrence history

- 2026-07-31T14:38:28.6621493Z: First observed and contained with zero index
  mutation.
- 2026-07-31T14:39:50.4303548Z: Closed after scoped Git metadata permission
  staged exactly eight expected paths, with zero unexpected, missing,
  unstaged-owned, or setback paths and a clean cached-diff check.

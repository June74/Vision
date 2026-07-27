# SB-20260727-211305-git-worktree-ownership-rejected: Git rejected linked-worktree ownership

- **Status:** closed
- **First observed:** 2026-07-27T21:13:05Z
- **Last observed:** 2026-07-27T21:15:49Z
- **Phase/task:** Listener-first restore retry Task 1
- **Environment:** Managed local sandbox, linked worktree
- **Version/commit:** Not inspected; Git metadata access was rejected first.

## Symptom

Every requested Git metadata command stopped before reading repository state because
Git rejected the linked worktree as owned by a different local account.

## Impact

Task 1 did not start editing, testing, staging, committing, or pushing. No provider
or private state was accessed or changed.

## Reproduction conditions

Run a read-only Git metadata command in the linked worktree using the managed
sandbox account.

## Safe evidence

Git reported an ownership safety check and requested a global safe-directory
configuration change. No configuration change was made.

## Attempts and outcomes

- Read-only `git status`, repository-root, revision, and branch commands were
  attempted together and each stopped at the ownership safety check.
- No workaround was attempted because the Task 1 brief requires reporting a
  sandbox Git-metadata block rather than bypassing it.

## Cause classification

- **Confirmed cause:** The current sandbox account differs from the linked
  worktree owner recorded by Git.
- **Hypotheses:** None.
- **Rejected hypotheses:** No repository corruption was indicated; Git stopped
  before repository metadata access.
- **Known exclusions:** No source files, Git configuration, provider state, or
  sensitive values were changed.

## Correction and prevention

- **Correction:** Used the controller-approved command-scoped safe-directory
  override for Git commands only; no global or local Git configuration changed.
- **Prevention:** Before source edits, ensure the execution environment has an
  approved repository-metadata boundary that permits Git ownership validation;
  use the narrowest command-scoped override supplied for the worktree.
- **Owner:** Project owner and Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The controller-approved command-scoped override permitted `git status`,
revision, branch, and diff checks in the exact linked worktree. No persistent Git
configuration was changed.

## Recurrence history

- 2026-07-27T21:13:05Z: First observed and contained without a workaround.
- 2026-07-27T21:15:49Z: The controller supplied an approved command-scoped
  safe-directory override for this exact worktree. Git metadata reads and the
  whitespace check then succeeded; the incident is closed.

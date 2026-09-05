# SB-20260727-211305-git-worktree-ownership-rejected: Git rejected linked-worktree ownership

- **Status:** closed
- **First observed:** 2026-07-27T21:13:05Z
- **Last observed:** 2026-08-10T23:25:36Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave
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
- 2026-07-28T14:49:26Z: Recurred during the read-only cleanup-boundary audit.
  The first Git read stopped at the ownership check; the audit then used the
  existing command-scoped safe-directory boundary and completed without a
  persistent Git configuration change, tracked-file edit, or provider action.
- 2026-07-28T20:43:57.5678432Z: Recurred during Task 3 branch/base validation.
  The initial reads stopped at the ownership check; the controller-approved
  command-scoped boundary then verified the expected worktree, branch, and base
  commit without a persistent Git configuration change or provider action.
- 2026-07-29T21:45:45.9840176Z: Recurred while resuming the Task 7 final-fix
  wave. Plain read-only Git commands stopped at the ownership check. No
  repository or provider state changed; subsequent Git commands use the existing
  command-scoped safe-directory override, without changing persistent Git
  configuration.
- 2026-08-07T19:09:19Z: Recurred during a read-only Phase B scalar probe. Plain
  Git metadata reads stopped at the ownership check; the probe was discarded
  and the command-scoped override then returned the expected branch, commit,
  status count, and zero open incident rows. No persistent Git configuration or
  provider state changed.
- 2026-08-10T23:25:36Z: Recurred while independently checking the detached
  candidate worktree. Plain Git reads stopped at the ownership check; no
  configuration or repository state changed. Future candidate reads use the
  command-scoped `safe.directory` override only.
- 2026-09-04: Recurred during a read-only check of the Projects Phase C
  worktree from the offline sandbox identity. The approved elevated execution
  under the owning user returned a clean status and the expected revision.
  No safe-directory exception or persistent Git configuration was added.

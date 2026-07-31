# SB-20260731-014701-task3-cross-worktree-git-safe-directory: Cross-worktree Git validation missed sandbox safe-directory context

- **Status:** closed
- **First observed:** 2026-07-31T01:47:01.149184Z
- **Last observed:** 2026-07-31T01:50:37.2528640Z
- **Phase/task:** Phase B Task 3 parallel worktree setup
- **Environment:** Windows managed sandbox; parent repository plus linked Git worktrees
- **Version/commit:** 2bfbc23f13c44e60b01bbffcecc9748d322765b5

## Symptom

A read-only multi-worktree Git object comparison failed the sandbox ownership check and follow-on null handling produced additional local errors.

## Impact

Dependency-tree validation paused; no branch, worktree, source, provider, or protected state changed.

## Reproduction conditions

From the parent repository, invoke Git with `-C` against linked worktrees
owned by the desktop user while the process runs as the sandbox identity, then
call string methods on the absent command result without checking the exit
code.

## Safe evidence

Git returned only the sandbox ownership category for each local worktree. The
follow-on PowerShell errors were null-result categories. No repository content
or protected value was printed.

## Attempts and outcomes

- A physical lockfile hash comparison was inconclusive because checkout
  newline form differed.
- The follow-up Git-object comparison used the wrong cross-worktree execution
  context and failed before returning object IDs.

## Cause classification

- **Confirmed cause:** The comparison ran Git from the parent with `-C`
  instead of running from each already-approved worktree context, and the
  helper did not stop after the first nonzero exit.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** Both worktrees were created directly from the same
  literal base commit; no lockfile, package manifest, branch, provider, or
  external state changed.

## Correction and prevention

- **Correction:** Treat the identical literal base commit as the dependency
  compatibility proof and run any later Git validation with that worktree as
  the command working directory. Check the exit code before consuming output.
- **Prevention:** Do not batch linked-worktree Git commands through parent
  `-C` calls under the sandbox; use one exact worktree per command.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; later Git checks run from their exact
  worktree context.

## Verification and related work

The exact primary and isolated paths were resolved without cross-worktree Git.
Both isolated branches originated from the same literal base commit. The
partial controller dependency tree was preserved, and both worktrees received
local junctions to the verified primary dependency tree. A focused controller
test then passed.

## Recurrence history

- 2026-07-31T01:47:01.149184Z: First observed.
- 2026-07-31T01:50:37.2528640Z: Closed after path-only validation, local
  junction creation, and a successful focused test avoided the failing
  cross-worktree command shape.

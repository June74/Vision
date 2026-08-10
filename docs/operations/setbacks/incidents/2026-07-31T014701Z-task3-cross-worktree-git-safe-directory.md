# SB-20260731-014701-task3-cross-worktree-git-safe-directory: Cross-worktree Git validation missed sandbox safe-directory context

- **Status:** closed
- **First observed:** 2026-07-31T01:47:01.149184Z
- **Last observed:** 2026-08-02T23:07:59.8233834Z
- **Phase/task:** Phase B Task 3 parallel worktree setup and OAuth reconnect Task 5 isolated-candidate proof preparation
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
  compatibility proof and run later Git validation from the exact worktree or
  with an exact command-local `safe.directory`. Check the exit code before
  consuming output.
- **Prevention:** Do not batch linked-worktree Git commands through unadmitted
  parent `-C` calls under the sandbox. Use one exact worktree per command and
  never mutate global Git configuration.
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
- 2026-08-02T19:59:01.3575094Z: Recurred while validating the detached OAuth
  reconnect candidate helper. The read-only `-C` command omitted the
  candidate's command-local safe-directory admission, and the missing result
  then caused a local null-method error. Helper syntax had already passed; no
  source, candidate commit, credential, database, provider, or deployment
  state changed. The helper and retry use only the exact candidate path as a
  command-local safe directory and check the Git exit before consuming output.
- 2026-08-02T23:07:59.8233834Z: Recurred during the read-only preflight for
  approved short rollback-worktree cleanup. The parent repository was admitted
  but the child worktree was not, and the wrapper then trimmed the absent HEAD
  result. Containment/path/registration checks passed, no deletion ran, and no
  repository or external state changed. Retry must admit the exact child path
  command-locally and gate every consumed result on Git exit zero.
- 2026-08-02T23:09:52.9851982Z: Closed after the command-local child admission
  returned the exact rollback commit, tracked-clean state, containment, and
  registration facts with every Git exit checked before output consumption.

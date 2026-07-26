# SB-20260726-203035-git-global-ignore-unreadable: Git global ignore file was unreadable

- **Status:** closed
- **First observed:** 2026-07-26T20:30:35.2961897Z
- **Last observed:** 2026-07-26T20:31:38.8232065Z
- **Phase/task:** Phase B release operations
- **Environment:** Local Phase B worktree under the managed sandbox
- **Version/commit:** `3128b5c`

## Symptom

Git reported that the user's global ignore file could not be read while checking
the worktree state.

## Impact

The status and upstream checks still succeeded. No repository or provider state
changed.

## Reproduction conditions

Run a Git command that consults the user-level ignore configuration while the
managed sandbox cannot read that file.

## Safe evidence

Git returned the expected clean branch, upstream, and zero-ahead/zero-behind
results, followed by a permission warning for the global ignore file.

## Attempts and outcomes

- The repository check completed successfully despite the warning.
- The warning was classified as a local configuration-read limitation rather
  than a repository failure.

## Cause classification

- **Confirmed cause:** The managed process lacked permission to read the
  user-level Git ignore file.
- **Hypotheses:** None.
- **Rejected hypotheses:** The linked worktree and remote branch were not
  unavailable.
- **Known exclusions:** No project file, commit, or deployment changed.

## Correction and prevention

- **Correction:** Accepted the independently successful repository results and
  made no configuration change outside the project.
- **Prevention:** Treat this exact warning as non-blocking when the Git command
  exits successfully and its requested repository results are present.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The branch was clean, tracked its expected remote, and was synchronized at
commit `3128b5c`.

## Recurrence history

- 2026-07-26T20:30:35.2961897Z: First observed.
- 2026-07-26T20:31:38.8232065Z: Recurred during documentation and diff
  verification; the checks still completed successfully.

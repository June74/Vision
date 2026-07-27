# SB-20260726-190339-git-worktree-lock-permission: Git worktree lock creation was denied

- **Status:** closed
- **First observed:** 2026-07-26T19:03:39.626332Z
- **Last observed:** 2026-07-27T03:14:01.3548535Z
- **Phase/task:** Phase B restore Task 1 fix wave
- **Environment:** Local linked worktree under the managed sandbox
- **Version/commit:** `f7778b8`

## Symptom

Git could not create the linked-worktree index lock during staging under the default sandbox profile.

## Impact

No files were lost or partially committed; the release commit paused pending the required repository metadata permission.

## Reproduction conditions

Stage files in the linked worktree while the sandbox grants read-only access to
the shared repository metadata.

## Safe evidence

Git reported that the linked-worktree index lock could not be created. The same
stage-and-commit operation succeeded after narrowly scoped repository metadata
permission was granted.

## Attempts and outcomes

- Default-permission staging failed before writing the index.
- The exact Git operation was retried with repository metadata permission.
- Commit `f7778b8` preserved all listed incident records.

## Cause classification

- **Confirmed cause:** The default sandbox allowed reading but not writing the
  linked worktree's shared Git metadata directory.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** The working-tree files and previous commits were
  unaffected.

## Correction and prevention

- **Correction:** Retried only the scoped Git stage-and-commit operation with
  the required permission.
- **Prevention:** Expect linked-worktree Git mutations to require metadata
  permission in this workspace; keep file edits separate from Git mutations.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The retry completed successfully and produced commit `f7778b8`.

## Recurrence history

- 2026-07-26T19:03:39.626332Z: First observed.
- 2026-07-26T22:01:39Z: Recurred while staging live migration evidence;
  contained before any index write and retried through the approved metadata
  boundary.
- 2026-07-27T03:13:22.2147232Z: Recurred while staging the Task 1 fix wave
  through explicit paths. The default sandbox denied the linked-worktree index
  lock before any index write; the same explicit-path operation then succeeded
  through the scoped metadata-permission boundary.

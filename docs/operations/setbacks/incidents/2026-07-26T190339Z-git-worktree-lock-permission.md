# SB-20260726-190339-git-worktree-lock-permission: Git worktree lock creation was denied

- **Status:** closed
- **First observed:** 2026-07-26T19:03:39.626332Z
- **Last observed:** 2026-07-28T20:34:20.6673153Z
- **Phase/task:** Phase B acceptance plan-review resolution staging
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

The Task 1 retry staged the complete explicit source, test, script, workflow,
reference, operational-evidence, and setback path set through the approved
metadata boundary. Earlier related work produced commit `f7778b8`.

## Recurrence history

- 2026-07-26T19:03:39.626332Z: First observed.
- 2026-07-26T22:01:39Z: Recurred while staging live migration evidence;
  contained before any index write and retried through the approved metadata
  boundary.
- 2026-07-27T03:13:22.2147232Z: Recurred while staging the Task 1 fix wave
  through explicit paths. The default sandbox denied the linked-worktree index
  lock before any index write; the same explicit-path operation then succeeded
  through the scoped metadata-permission boundary.
- 2026-07-27T03:45:20Z: Recurred while staging only Task 2 and incident
  paths. The default sandbox denied the linked-worktree index lock before any
  index write; the same explicit-path staging set succeeded through the scoped
  metadata-permission boundary.
- 2026-07-27T04:04:09Z: Recurred during the interrupted Task 3 pre-edit run
  when incident files were staged under the default sandbox. No index write
  occurred. Future Task 3 staging uses the already established scoped metadata
  permission boundary and explicit paths.
- 2026-07-27T05:01:37Z: Recurred while staging the corrected Task 3 candidate
  through explicit paths. The default sandbox denied the linked-worktree index
  lock before any index write; the exact path set is retried through the
  established metadata-permission boundary.
- 2026-07-27T18:06:52Z: Recurred while staging only Task 4 value-free
  credential and setback records. The default sandbox denied the linked
  worktree index lock before any index write; the same explicit path set is
  retried through the established metadata-permission boundary.
- 2026-07-27T19:45:19Z: Recurred while staging the corrected workflow
  assertion and value-free operational records. The default sandbox denied the
  linked-worktree index lock before any index write; the same explicit path set
  is retried through the established metadata-permission boundary.
- 2026-07-27T21:17:36Z: Recurred while staging the Task 1 listener-first
  workflow, test, restore-drill, and safe setback records. The command-scoped
  safe-directory override resolved ownership validation but did not grant the
  separate linked-worktree index-write permission. Git stopped before creating
  the lock; no stage, commit, or push was attempted afterward.
- 2026-07-27T23:29:53Z: Recurred while staging only the approved in-memory
  Task 2 specification and plan amendment. Git stopped before creating the
  linked-worktree index lock, so neither documentation file was staged or
  committed. The unchanged files remain in the worktree for retry through the
  established scoped metadata-permission boundary.
- 2026-07-28T02:46:00Z: Recurred while staging only the role-probe handoff
  incident and index update. Git stopped before creating the linked-worktree
  index lock; no index write or commit occurred. The exact safe path set is
  retried through the established scoped metadata-permission boundary.
- 2026-07-28T14:37:16Z: Recurred while staging only the Phase B resume
  setback records after documentation and whitespace validation passed. Git
  stopped before creating the linked-worktree index lock; no index write or
  commit occurred. The expanded exact safe path set is retried through the
  established metadata-permission boundary.
- 2026-07-28T19:17:15.0700713Z: Recurred while staging the complete verified
  Task 1 path set. Git stopped before creating the linked-worktree index lock;
  the following chained read-only commands saw an empty staged diff, so no
  file was partially staged or committed. The same scoped path set is retried
  through the established metadata-permission boundary.
- 2026-07-28T20:34:20.6673153Z: Recurred while staging only the validated
  acceptance-plan review resolution. Git stopped before creating the linked
  worktree index lock; no file was partially staged or committed. The same
  explicit documentation path is retried through the established scoped
  metadata-permission boundary.

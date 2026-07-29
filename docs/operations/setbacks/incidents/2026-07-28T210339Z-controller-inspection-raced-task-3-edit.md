# SB-20260728-210339-controller-inspection-raced-task-3-edit: Controller inspection raced Task 3 edit

- **Status:** closed
- **First observed:** 2026-07-28T21:03:39.942454Z
- **Last observed:** 2026-07-29T19:12:27.1987572Z
- **Phase/task:** Phase B acceptance instrumentation Task 3
- **Environment:** Local shared Phase B worktree
- **Version/commit:** `36f9df2` plus uncommitted Task 3 implementation

## Symptom

A read-only controller status command inspected a known in-progress source path while the implementer was replacing it, so the path was absent at command time.

## Impact

The status output was noisy and incomplete; no repository, provider, credential, database, R2, deployment, secret, or key state changed.

## Reproduction conditions

Run a path-specific read-only status command while the assigned implementer is
actively creating, replacing, or renaming Task 3 files in the shared worktree.

## Safe evidence

The preceding `git status` showed the adapter path as untracked. A later
read-only `Get-Item` reported that same path absent while the implementer
remained active. The controller command performed no write.

## Attempts and outcomes

1. Stopped path-specific inspection immediately.
2. Kept the worker active and shifted monitoring to its explicit checkpoint
   messages and complete-task report.

## Cause classification

- **Confirmed cause:** Controller inspection overlapped the implementer's
  uncommitted file replacement in the shared worktree.
- **Hypotheses:** None.
- **Rejected hypotheses:** Accidental deletion by the controller; its command
  was read-only.
- **Known exclusions:** No provider, database, R2, deployment, credential,
  secret, key, or committed Git state changed.

## Correction and prevention

- **Correction:** Wait for the implementer's explicit focused-test checkpoint
  before inspecting the complete diff.
- **Prevention:** Do not inspect individual uncommitted paths while a subagent
  is actively editing them; use agent checkpoints or whole-worktree status.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

Closed after adopting checkpoint-based monitoring. The implementation remains
owned by the active Task 3 subagent.

## Recurrence history

- 2026-07-28T21:03:39.942454Z: First observed.
- 2026-07-29T19:12:27.1987572Z: Recurred when the controller added a
  coordination-setback record while two reviewers were reading immutable diff
  packages. Their packages and reviewed commit ranges were unchanged, but the
  live tracked worktree became dirty during review. The controller stopped
  further edits and will ask reviewers to rely on their immutable packages,
  then commit the coordination record only after both reviews finish.

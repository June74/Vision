# SB-20260730-202300-task2-review-git-dubious-ownership: Task 2 reviewer Git validation hit dubious ownership

- **Status:** closed
- **First observed:** 2026-07-30T20:23:00.536370Z
- **Last observed:** 2026-07-31T23:11:44.2606709Z
- **Phase/task:** Phase B live-acceptance closure Tasks 2 and 6 status review
- **Environment:** Read-only reviewer sandbox against the local linked worktree
- **Version/commit:** `6f03ad0090ba0b596acff00da2cd9ee920b3881b`

## Symptom

A read-only reviewer Git validation command was rejected because the sandbox process user differs from the linked-worktree owner.

## Impact

Independent review paused; no configuration, file, provider state, or private data changed.

## Reproduction conditions

Invoke Git from a sandbox process identity that does not match the linked
worktree owner and has no preconfigured safe-directory exception.

## Safe evidence

Git rejected the read-only validation before returning repository data. The
controller had already validated the review package's exact base/head, one
commit, twelve diff files, three section markers, and zero URL tokens.

## Attempts and outcomes

- The reviewer attempted an unnecessary second Git validation and it failed
  closed.
- The reviewer paused without changing persistent Git configuration.

## Cause classification

- **Confirmed cause:** Git's ownership safety check rejected the sandbox
  identity for the linked worktree.
- **Hypotheses:** None.
- **Rejected hypotheses:** The controller-validated review package is not
  missing or structurally invalid.
- **Known exclusions:** No configuration, file, provider, private-data, or
  external state changed.

## Correction and prevention

- **Correction:** Trust the already validated package and continue without Git.
- **Prevention:** Reviewers receive the controller's package-validation
  evidence and must not repeat repository Git checks unless they first identify
  a concrete internal inconsistency.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The reviewer completed both passes from the validated package without Git or
persistent configuration changes and returned a bounded verdict.

## Recurrence history

- 2026-07-30T20:23:00.536370Z: First observed.
- 2026-07-31T23:11:44.2606709Z: Recurred when the controller requested a
  read-only Task 6 status without the established command-scoped safe-directory
  override. Git failed closed before returning repository state; the controller
  switched back to the non-persistent command-scoped override.

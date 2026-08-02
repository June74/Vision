# SB-20260802-014114-task8-worktree-submodule-null-trim: Worktree check trimmed an empty submodule result

- **Status:** closed
- **First observed:** 2026-08-02T01:41:14.3143298Z
- **Last observed:** 2026-08-02T01:41:58.8442612Z
- **Phase/task:** Phase B Task 8 prepublication readiness
- **Environment:** Local Phase B linked worktree
- **Version/commit:** Reviewed uncommitted candidate

## Symptom

A read-only worktree check called `.Trim()` directly on the optional
superproject command result. Git correctly returned no text because this
checkout is not a submodule, so PowerShell reported a null-method error after
the required branch and linked-worktree facts had already been collected.

## Impact

No file, Git metadata, provider, deployment, browser, credential, key, or live
state changed. The worktree facts were true, but the diagnostic did not satisfy
its clean-exit requirement and cannot be used as final evidence.

## Reproduction conditions and safe evidence

The optional superproject query returns no output in this linked worktree.
Calling a string method on that empty native-command result raises the observed
PowerShell category without exposing project or protected data.

## Attempts and outcomes

- The first check confirmed the expected branch and linked-worktree relation.
- Its optional submodule guard produced no text and the direct `.Trim()` call
  failed.
- The corrected check will normalize the command result as an array before
  joining and trimming it.

## Cause classification

- **Confirmed cause:** The diagnostic assumed an optional native command always
  returns a string.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The checkout is not a submodule and the branch is not
  detached.
- **Known exclusions:** No private value or sensitive log was read or recorded.

## Correction and prevention

- **Correction:** Join the optional command output as an array, then trim the
  resulting string.
- **Prevention:** Normalize optional native-command output before invoking string
  methods in PowerShell.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected read-only check exited zero and proved the checkout is not a
submodule, is a linked worktree, and is on the expected branch.

## Recurrence history

- 2026-08-02T01:41:14.3143298Z: First observed and contained before retry.
- 2026-08-02T01:41:58.8442612Z: Closed after array-normalized optional output
  produced a clean three-fact worktree result.

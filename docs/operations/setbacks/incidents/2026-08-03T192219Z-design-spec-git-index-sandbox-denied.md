# SB-20260803-192219-design-spec-git-index-sandbox-denied: Sandbox denied design-spec Git index write

- **Status:** contained
- **First observed:** 2026-08-03T19:22:19.019035Z
- **Last observed:** 2026-08-03T19:22:19.019035Z
- **Phase/task:** Phase B controller repair design
- **Environment:** Shared worktree Git index under the restricted sandbox
- **Version/commit:** design-only commit `3ecacc6`

## Symptom

Staging the approved TSX adapter design specification failed because the shared worktree Git index is outside the writable sandbox boundary.

## Impact

The specification file is intact and reviewed, but its required design-only commit needs a narrowly scoped elevated Git add and commit.

## Reproduction conditions

Attempt to stage the approved design specification through the restricted
sandbox when the shared worktree Git index is outside its writable boundary.

## Safe evidence

- The restricted sandbox denied the original Git index write.
- Exact-file elevated staging succeeded.
- Design-only commit `3ecacc6` succeeded without staging unrelated changes.

## Attempts and outcomes

1. Restricted-sandbox staging failed at the shared Git index boundary.
2. Exact-file elevated staging and the design-only commit succeeded.

## Cause classification

- **Confirmed cause:** The shared worktree Git index is outside the restricted
  sandbox's writable boundary.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The design specification was missing or could not
  be committed safely.
- **Known exclusions:** No unrelated files were staged or committed, and no
  provider state changed.

## Correction and prevention

- **Correction:** Used exact-file elevated staging and a design-only commit.
- **Prevention:** For this worktree boundary, request narrowly scoped elevated
  Git index writes and verify the staged name set before committing.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** The access boundary remains contained; use the
  established exact-file elevated path when a new scoped Git write is needed.

## Verification and related work

Exact-file elevated staging and design-only commit `3ecacc6` succeeded without
staging unrelated changes.

## Recurrence history

- 2026-08-03T19:22:19.019035Z: First observed.
- 2026-08-03: Exact-file elevated staging and design-only commit succeeded;
  incident contained.

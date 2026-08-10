# SB-20260803-195229-review-package-wsl-linked-worktree-path: WSL review-package helper could not resolve Windows worktree Git pointer

- **Status:** closed
- **First observed:** 2026-08-03T19:52:29.114304Z
- **Last observed:** 2026-08-06T22:44:32.7354035Z
- **Phase/task:** Phase B TSX adapter Task 2 review
- **Environment:** Local Windows linked-worktree review packaging
- **Version/commit:** Review artifact only; no provider mutation

## Symptom

The required review-package script ran under WSL, where the linked worktree's Windows absolute gitdir pointer was concatenated to the WSL worktree path; Git then rejected the base as outside a repository.

## Impact

The Task 2 commit is unchanged and verified; independent review is delayed until the documented PowerShell fallback writes the same commit list, stat, and full diff package.

## Reproduction conditions

The WSL helper was not used for the linked Windows worktree; native PowerShell
generated the equivalent bounded package instead.

## Safe evidence

Only the path-resolution failure category was retained. No raw diff, private
value, or provider output was emitted.

## Attempts and outcomes

- The WSL helper was stopped before package generation.
- The native PowerShell fallback produced the review package used by later
  exact-tip review.

## Cause classification

- **Confirmed cause:** WSL could not interpret the linked worktree's Windows
  Git pointer as a valid repository path.
- **Hypotheses:** None.
- **Rejected hypotheses:** The worktree itself was not missing.
- **Known exclusions:** No provider, credential, key, or deployment action ran.

## Correction and prevention

- **Correction:** Use the native PowerShell review-package fallback for this
  Windows linked-worktree layout.
- **Prevention:** Do not concatenate Windows linked-worktree pointers into WSL
  paths.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; native review packaging is established.

## Verification and related work

The later exact-tip review package and zero-finding review provide the closure
evidence.

## Recurrence history

- 2026-08-03T19:52:29.114304Z: First observed.
- 2026-08-06T22:44:32.7354035Z: Closed after native review-package fallback
  and exact-tip review completion.

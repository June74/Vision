# SB-20260801-213854-task7-task5-git-config-warnings: Task 5 status check emitted sandbox Git configuration warnings

- **Status:** contained
- **First observed:** 2026-08-01T21:38:54.5590424Z
- **Last observed:** 2026-08-16T15:15:45.1039002Z
- **Phase/task:** Phase B Task 7 correlation repair Task 5 review repair
- **Environment:** Local worktree status preflight
- **Version/commit:** admitted baseline `10b228b`

## Symptom

The implementation agent's repository-status preflight exited successfully but emitted two safe warnings while attempting to access Git configuration through the sandbox boundary.

## Impact

No status fact was lost and the repair may continue, but the warnings are retained so they are not mistaken for source, branch, or provider failures. No file, Git state, provider, network, credential, deployment, browser, database, calendar, object storage, authentication, secret, key, or backup-key state changed.

## Reproduction conditions

Run the scoped read-only worktree status check inside the restricted local environment.

## Safe evidence

Exit status was zero and the warning count was two. No warning body, configuration value, path outside the repository, remote URL, or credential material is recorded.

## Attempts and outcomes

- One read-only status preflight completed successfully.
- No retry or configuration mutation was performed.

## Cause classification

- **Confirmed cause:** The sandbox could not access optional Git configuration locations while the explicitly supplied safe-directory and excludes-file settings still allowed the scoped status query to complete.
- **Hypotheses:** None needed unless a later required Git operation fails.
- **Rejected hypotheses:** The working branch or index was corrupted; the status check itself succeeded.
- **Known exclusions:** No repository mutation or external action occurred.

## Correction and prevention

- **Correction:** Continue using the exact command-local Git safety settings and treat the known warnings as environment noise only while exit status remains zero.
- **Prevention:** Report warning counts without printing configuration contents and do not change global Git configuration to suppress sandbox noise.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Continue to the planned contained RED; investigate only if a required Git command exits nonzero.

## Verification and related work

Contained by the successful preflight and command-local Git settings. Final Git checks remain pending after the repair.

## Recurrence history

- 2026-08-01T21:38:54.5590424Z: First observed during the Task 5 review-repair preflight.
- 2026-08-16T15:15:45.1039002Z: The final read-only Phase C worktree check
  again emitted the same optional Git ignore-file access warning while
  returning the correct branch, root, commit, and clean status. No repository
  or external state changed.

# SB-20260731-201907-task4-green-invalid-workdir: Task 4 GREEN retry used an invalid worktree path

- **Status:** closed
- **First observed:** 2026-07-31T20:19:07.520663Z
- **Last observed:** 2026-08-07T18:37:00Z
- **Phase/task:** Phase B Tasks 4 and 5 worktree verification
- **Environment:** Local Phase B worktree, Windows PowerShell
- **Version/commit:** c23e301 plus Task 4 working changes

## Symptom

The focused test retry did not start because the command metadata omitted one worktree path separator.

## Impact

No test, code, provider, network, database, or external action ran; verification was delayed until the corrected retry.

## Reproduction conditions

Use a worktree metadata path with one directory separator omitted.

## Safe evidence

The process creation boundary returned the invalid-working-directory category before the test command started.

## Attempts and outcomes

- Retried the identical command with the exact verified worktree path; all four files and 201 tests passed.

## Cause classification

- **Confirmed cause:** One path separator was omitted from the command metadata.
- **Hypotheses:** None active.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No test-runner, repository, or sandbox defect was involved.

## Correction and prevention

- **Correction:** Reused the exact canonical worktree path for the retry.
- **Prevention:** Copy the verified worktree path instead of manually retyping it.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; incident closed.

## Verification and related work

The corrected retry passed four files and 201 tests with an empty error stream.

## Recurrence history

- 2026-07-31T20:19:07.520663Z: First observed.
- 2026-07-31T22:23:32.5457736Z: Recurred when the scheduled-package reviewer
  checked reference paths outside the explicit Phase B linked-worktree
  directory and reported four false absences. Root verification in the exact
  worktree confirmed all four paths exist.
- 2026-07-31T22:24:22.0996423Z: Recurred when the reviewer still reported the
  same four false absences after receiving the worktree directory. Root checks
  remain true; the next read uses four fully expanded absolute filenames with
  no relative path or brace notation.
- 2026-08-07T18:37:00Z: Recurred during a scalar post-acceptance status probe
  that used the parent repository root instead of the linked Phase B worktree.
  The missing-path result was discarded; the corrected probe uses the verified
  worktree path and no implementation, provider, credential, or private-data
  state changed.

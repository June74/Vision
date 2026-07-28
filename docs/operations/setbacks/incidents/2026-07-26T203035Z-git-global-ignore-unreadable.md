# SB-20260726-203035-git-global-ignore-unreadable: Git global ignore file was unreadable

- **Status:** closed
- **First observed:** 2026-07-26T20:30:35.2961897Z
- **Last observed:** 2026-07-28T18:35:01Z
- **Phase/task:** Phase B acceptance instrumentation plan pre-commit
- **Environment:** Local Phase B worktree under the managed sandbox
- **Version/commit:** Staged Task 1 patch based on `59e6a02`

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
  unavailable. Overriding the excludes file with the Windows `NUL` device is
  not supported by this Git build.
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
commit `4420f6d`.

## Recurrence history

- 2026-07-26T20:30:35.2961897Z: First observed.
- 2026-07-26T20:31:38.8232065Z: Recurred during documentation and diff
  verification; the checks still completed successfully.
- 2026-07-26T20:53:19.9855914Z: Recurred during the pre-commit status and
  diff check; all requested repository results were still returned.
- 2026-07-26T20:54:22.5223781Z: An attempted `NUL` excludes-file override
  failed before the Git diff check. Documentation had already passed; the
  diff check was rerun normally instead of pursuing another workaround.
- 2026-07-27T00:24:17Z: Recurred during the AI Gateway identifier pre-commit
  status check. Git returned the requested state successfully.
- 2026-07-27T01:52:24Z: Recurred during the post-push branch synchronization
  check. Git returned an empty worktree status and matching local and remote
  commit identifiers.
- 2026-07-27T03:56:50Z: Recurred during Task 3 repository inspection. Git
  returned the requested branch, commit, and status data successfully; no
  configuration workaround or provider action was attempted.
- 2026-07-27T18:04:36Z: Recurred during restore Task 4 documentation and
  whitespace verification. Both checks exited zero and Git returned the
  requested status; no configuration workaround was attempted.
- 2026-07-27T18:07:39Z: Recurred during the read-only staged privacy check.
  The check confirmed 18 operations files and zero prohibited patterns; no
  configuration workaround was attempted. Remaining Git output is captured
  and classified before display.
- 2026-07-27T21:24:34.4110712Z: Recurred during the Task 2 immutable-candidate
  check. Git returned matching local and remote candidate commits, and the
  focused test command passed all 7 tests. No configuration workaround or
  provider action was attempted.
- 2026-07-27T23:34:27.6431391Z: Recurred during the amended Task 2
  immutable-candidate check. Git returned matching local and remote candidate
  commits, and the focused test command passed all 7 tests. No configuration
  workaround or provider action was attempted.
- 2026-07-28T00:25:50.5676199Z: Recurred during the Task 2 implementation
  preflight status check. Git returned the expected commit and worktree state;
  no configuration workaround or provider action was attempted.
- 2026-07-28T00:52:25.6785004Z: Recurred during the final Task 2 changed-file
  inventory. Git returned the complete worktree status and diff inventory; no
  configuration workaround or provider action was attempted.
- 2026-07-28T01:20:44.6624354Z: Recurred during Task 3 candidate
  reconfirmation. The ordinary status check had already returned a clean,
  synchronized worktree; a repeated `NUL` excludes-file workaround was
  rejected before the retry. No repository or provider mutation occurred, and
  the unsupported workaround is not reused.
- 2026-07-28T02:02:31.3503418Z: Recurred during the preview role probe
  implementation preflight. Git returned the exact branch and base commit
  successfully; no configuration workaround, provider action, or repository
  runtime mutation occurred.
- 2026-07-28T02:36:34.6558608Z: Recurred during the independent staged-diff
  review. Git returned the requested inventory and diff successfully. The
  reviewer approved the staged implementation with zero Critical or Important
  findings; no provider or runtime mutation occurred.
- 2026-07-28T13:58:00Z: Recurred during a final short-status check. Git exited
  zero and returned no changed paths, but the warning-bearing result was not
  accepted as fresh clean proof; the controller's independent clean
  attribution was used.
- 2026-07-28T14:08:00Z: Recurred during the ignored-report acceptance gate.
  A supported null exclude-file override then returned the tracked-state result
  without changing repository or provider state.
- 2026-07-28T14:32:43Z: Recurred during the Phase B completion resume
  preflight. Git returned the requested branch, commit, worktree, and plan
  state with exit code zero; no configuration workaround, repository mutation,
  or provider action was attempted.
- 2026-07-28T14:33:13Z: The controller mistakenly retried the already-rejected
  Windows `NUL` excludes-file workaround while seeking a warning-free status
  check. Git failed before reading repository state; no file or provider state
  changed. Future checks must accept the ordinary successful result and
  classify only the known trailing warning.
- 2026-07-28T14:35:22Z: Recurred during the resumed setback diff and status
  checks. Both requested Git operations exited successfully and returned their
  requested results; no workaround or external action was attempted.
- 2026-07-28T14:44:32Z: Recurred when a status check suppressed the known
  warning stream. Git still returned the four expected modified setback paths,
  but the shell reported a nonzero native-command status, so that invocation
  was not accepted as clean-state proof. No repository or provider mutation
  occurred.
- 2026-07-28T14:54:48Z: Recurred after the bounded clean/equality check. The
  command separately confirmed a clean tracked worktree, clean index, and
  matching local and remote commits before the warning appeared; no workaround
  or mutation was attempted.
- 2026-07-28T15:05:48Z: Recurred during the approved acceptance-design
  preflight. The command separately confirmed a clean tracked worktree, the
  expected branch, matching local and remote commits, and absence of the new
  design file before the warning appeared; no workaround or external mutation
  was attempted.
- 2026-07-28T18:35:01Z: Recurred during the implementation-plan status and
  ignore check. Git returned the two modified setback files and the new plan
  path before the known warning. No workaround, provider action, or unrelated
  repository mutation was attempted.

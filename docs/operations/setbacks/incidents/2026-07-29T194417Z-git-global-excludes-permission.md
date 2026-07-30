# SB-20260729-194417-git-global-excludes-permission: Git could not read the user excludes file

- **Status:** closed
- **First observed:** 2026-07-29T19:44:17Z
- **Last observed:** 2026-07-30T17:35:24.7550264Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final re-review
- **Environment:** Local Phase B worktree
- **Version/commit:** `41d3e74` base with tracked setback recurrences

## Symptom

The read-only Git status check succeeded but warned that the user-level global
excludes file could not be read because access was denied.

## Impact

No repository or provider state changed. The worktree status and exact commit
were still available, but later Git commands may repeat the warning.

## Cause classification

- **Confirmed cause:** The current process cannot read the configured
  user-level excludes path.
- **Hypotheses:** The path is outside the managed workspace permissions.
- **Rejected hypotheses:** A dirty worktree or an invalid repository.
- **Known exclusions:** Repository-local status and commit inspection succeeded.

## Correction and prevention

- **Correction:** Continue with repository-local tracked-file inspection and
  treat any repeated identical warning as this closed incident.
- **Prevention:** Do not change user Git configuration during this scoped fix.
- **Owner:** Local tooling environment.
- **Next diagnostic step:** None unless a Git result becomes incomplete.

## Verification and related work

The same command returned a clean worktree at the required base commit.

## Recurrence history

- 2026-07-29T21:46:31.2210743Z: The warning recurred after the
  command-scoped worktree ownership override allowed repository metadata reads.
  Git still returned the expected branch, commit, and status. No persistent
  Git configuration or provider state changed.
- 2026-07-29T21:50:06.9379108Z: The warning recurred during the wave-2
  baseline check. Git still returned the expected branch, commit, linked
  worktree metadata, and tracked status; no persistent Git configuration or
  provider state changed.
- 2026-07-29T22:11:21.8745113Z: A controller read-only status check reproduced
  the same user-excludes permission warning. The status command still
  completed, and no repository, persistent Git configuration, or provider
  state changed.
- 2026-07-29T23:35:05.5454395Z: The final-fix range scan reproduced the same
  user-excludes warning. Git still returned complete safe aggregate path and
  pattern counts plus an exit-zero diff check; no repository or persistent
  Git configuration changed.
- 2026-07-30T00:05:36.3524779Z: The whole-branch reviewer reproduced the same
  warning during a read-only clean-status check, and the Task 7 reviewer
  reproduced it while confirming the package header mismatch. Git returned the
  expected branch state, neither package diff was inspected, and no repository
  or provider state changed.
- 2026-07-30T17:35:24.7550264Z: The resumed plan-review status check repeated
  the same warning. Git still returned the complete modified/untracked path
  list, branch name, and exact commit; exact-path staging remains the
  prevention, and no provider or persistent Git configuration changed.

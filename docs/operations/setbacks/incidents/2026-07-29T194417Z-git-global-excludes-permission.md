# SB-20260729-194417-git-global-excludes-permission: Git could not read the user excludes file

- **Status:** closed
- **First observed:** 2026-07-29T19:44:17Z
- **Last observed:** 2026-07-29T19:44:17Z
- **Phase/task:** Phase B consolidated final-fix preflight
- **Environment:** Local Phase B worktree
- **Version/commit:** Clean `e3c1272` base

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

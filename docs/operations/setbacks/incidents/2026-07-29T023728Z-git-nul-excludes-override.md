# SB-20260729-023728-git-nul-excludes-override: Git rejected the local NUL excludes override

- **Status:** closed
- **First observed:** 2026-07-29T02:37:28.278093Z
- **Last observed:** 2026-08-01T02:37:16.7357368Z
- **Phase/task:** Phase B Task 7 exact-tip review
- **Environment:** Windows PowerShell, isolated phase-b-foundation worktree
- **Version/commit:** ecd74074fe223d4e9d185e8c92dd033eb26678a4

## Symptom

A read-only Git status command attempted to suppress an inaccessible global excludes warning with a NUL override, and Git rejected that override.

## Impact

The status read did not run; no tracked file, private value, provider, database, or external state changed.

## Reproduction conditions

Running `git status --short` with a command-local `core.excludesFile=NUL`
override.

## Safe evidence

- The override itself was rejected before the status read.
- Plain read-only Git status remains available in the worktree.

## Attempts and outcomes

- Removed the unsupported override.
- Re-ran plain `git status --short`; it returned the working-tree state.

## Cause classification

- **Confirmed cause:** This Git environment does not accept `NUL` as an
  excludes file for the command-local override.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No repository mutation, external access, or private
  value was involved.

## Correction and prevention

- **Correction:** Use ordinary read-only Git commands and tolerate the existing
  local global-excludes warning.
- **Prevention:** Do not add platform-device paths as command-local Git config
  overrides without verifying the Git build accepts them.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Plain `git status --short` completed successfully after the override was
removed.

## Recurrence history

- 2026-07-29T02:37:28.278093Z: First observed.
- 2026-07-29T23:06:32.2236081Z: Recurred when a consolidated status-and-source
  inspection reused the rejected override. The read stopped before any state
  change; subsequent Git reads omit the override.
- 2026-08-01T02:37:16.7357368Z: Recurred when a fresh exact-tip reviewer used
  `NUL` for a read-only cleanliness probe. Git rejected the override; direct
  diff checks still proved clean state and no mutation occurred. The review was
  invalidated before package inspection. Its replacement must use the proven
  `core.excludesFile=/dev/null` form for every Git read.

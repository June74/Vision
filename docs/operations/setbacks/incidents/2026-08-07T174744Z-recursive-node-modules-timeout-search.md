# SB-20260807-174744-recursive-node-modules-timeout-search: Timeout-search probe traversed stale linked-worktree node_modules

- **Status:** contained
- **First observed:** 2026-08-07T17:47:44.382957Z
- **Last observed:** 2026-08-10T01:33:56.7069130Z
- **Phase/task:** Phase B monitored candidate deployment
- **Environment:** Windows PowerShell, linked Phase B worktree
- **Version/commit:** Current reviewed Phase B checkout

## Symptom

A recursive Select-String file list included stale linked-worktree `node_modules` paths; one generated map path was absent when read, so the bounded search stopped before returning matches.

## Impact

No source, controller, deployment, rollback, schedule, binding, secret, database, calendar, AI Gateway, or key state changed.

## Reproduction conditions

Avoid recursive searches over the entire worktree; scan only the named source/test files and explicit top-level controller paths.

## Safe evidence

The corrected bounded search scanned 149 test files plus the controller script and returned nine timeout-related matches without traversing `node_modules`. No provider action ran. Do not paste private or secret values.

## Attempts and outcomes

1. Whole-worktree recursive search: missing generated map path; no state change.
2. Bounded tests-plus-controller search: completed with an allowlisted count.

## Cause classification

- **Confirmed cause:** The search scope included stale generated dependency paths that are not stable files.
- **Hypotheses:** None retained.
- **Rejected hypotheses:** The timeout controller and provider were not exercised by the search failure.
- **Known exclusions:** No deployment, rollback, schedule, binding, secret, database, calendar, AI Gateway, or key action.

## Correction and prevention

- **Correction:** Restrict searches to explicit source/test roots and named controller files.
- **Prevention:** Exclude `node_modules`, linked worktrees, and generated artifacts from diagnostic searches.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Establish the smallest safe reproduction.

## Verification and related work

Verified by the successful bounded search and the safe controller result already captured.

## Recurrence history

- 2026-08-07T17:47:44.382957Z: First observed.
- 2026-08-07T17:48:06.6751118Z: Bounded replacement search completed; incident
  closed.
- 2026-08-10T01:33:56.7069130Z: A broad helper search again traversed a stale
  linked-worktree dependency path and stopped on a missing directory. No
  provider or project state changed; the search is being replaced with
  explicit controller/script paths and a bounded depth.

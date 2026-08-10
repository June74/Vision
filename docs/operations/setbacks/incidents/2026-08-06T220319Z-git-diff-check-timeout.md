# SB-20260806-220319-git-diff-check-timeout: Full diff check exceeded the local bound

- **Status:** closed
- **First observed:** 2026-08-06T22:03:19.1312382Z
- **Last observed:** 2026-08-06T22:04:15.4269803Z
- **Area:** Phase B local verification
- **Impact:** A full working-tree `git diff --check` did not finish within the
  30-second local bound. The command was stopped by the bounded runner; no
  provider or deployment action ran, and no Git process remained afterward.

## Evidence

The bounded command returned a timeout status. A follow-up process-count check
found zero running `git` processes. No Git stdout, stderr, paths, identifiers,
or private values were emitted.

## Cause classification

- **Confirmed cause:** Full dirty-tree diff verification exceeded the chosen
  local time bound in the OneDrive worktree.
- **Hypotheses:** OneDrive filesystem latency or the volume of unrelated dirty
  historical documentation changes may contribute.
- **Rejected hypotheses:** A provider or controller process was not involved.

## Correction and prevention

- Use a bounded diff check over the exact files changed in the current repair,
  while retaining the already completed parser and contract gates.
- Avoid unbounded or repeated full-tree scans when unrelated dirty history is
  known to be present.
- Keep the command result to exit status and lengths; never print raw Git
  diagnostics.

## Owner and next step

- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; the scoped changed-file check completed and
  the direct-launcher parser/contract passed.

## Verification

The exact documentation and incident files changed in this repair were checked
with a bounded `git diff --check` invocation. It exited zero; Git's known
warning channel was isolated and no raw diagnostic was emitted.

## Recurrence history

- 2026-08-06T22:03:19.1312382Z: Full dirty-tree diff check timed out; no Git
  process remained afterward.
- 2026-08-06T22:04:15.4269803Z: Closed after the scoped changed-file check
  completed successfully.

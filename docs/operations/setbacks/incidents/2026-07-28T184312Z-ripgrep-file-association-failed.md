# SB-20260728-184312-ripgrep-file-association-failed: Ripgrep file association failed

- **Status:** closed
- **First observed:** 2026-07-28T18:43:12.190089Z
- **Last observed:** 2026-07-29T21:52:02.2637668Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 2
- **Environment:** Local Windows PowerShell worktree
- **Version/commit:** `41d3e74`

## Symptom

The preferred repository text search command could not start because Windows had no application associated with the executable.

## Impact

The read-only discovery command stopped after confirming the base commit. No source, runtime, provider, or private state changed.

## Reproduction conditions

Invoke `rg.exe` in this worktree on the installed Windows environment.

## Safe evidence

PowerShell reported that no application was associated with the executable.
The same environment's documented fallback, `Select-String`, remained
available.

## Attempts and outcomes

- The initial bounded text search did not start.
- The failure was contained to repository discovery.
- Subsequent searches use `Select-String` rather than retrying the broken
  executable.

## Cause classification

- **Confirmed cause:** Windows could not start the installed `rg.exe` through
  its current file association.
- **Hypotheses:** None.
- **Rejected hypotheses:** The repository path and search pattern were not the
  cause because PowerShell failed before executing the search.
- **Known exclusions:** No source, runtime, provider, or private state changed.

## Correction and prevention

- **Correction:** Continue bounded repository searches with `Select-String`.
- **Prevention:** Honor the repository-environment note that `rg.exe` may be
  unavailable or misassociated in PowerShell.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

`Select-String` successfully found the repository evidence needed to continue
without retrying `rg.exe`.

## Recurrence history

- 2026-07-28T18:43:12.190089Z: First observed.
- 2026-07-29T21:52:02.2637668Z: The executable shim was present but again
  could not start through the current Windows association. The read-only
  search did not execute; repository and provider state were unchanged, and
  bounded discovery resumed with `Select-String`.

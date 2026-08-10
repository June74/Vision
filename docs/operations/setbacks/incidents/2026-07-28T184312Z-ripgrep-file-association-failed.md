# SB-20260728-184312-ripgrep-file-association-failed: Ripgrep file association failed

- **Status:** closed
- **First observed:** 2026-07-28T18:43:12.190089Z
- **Last observed:** 2026-08-03T21:59:58.2738957Z
- **Phase/task:** Phase B Task 8 reconnect-state diagnosis and reconnect Task 5 resumption
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
- 2026-07-30T04:53:23.7871797Z: A read-only AI planning subagent encountered
  the same Windows association failure. The search did not execute and changed
  no repository or provider state. The subagent resumed with the documented
  PowerShell fallback.
- 2026-08-02T01:47:32.0350764Z: A parallel read-only Phase B status check
  encountered the same Windows association failure. The search did not start,
  no repository or provider state changed, and bounded verification resumed
  with `Select-String`.
- 2026-08-02T05:32:26.8942986Z: Recurred during the reconnect-state source
  trace when three parallel read-only searches tried the known-broken
  executable. One process failed before searching; no file, browser, provider,
  database, credential, or key state changed. All subsequent searches used
  `Select-String`.
- 2026-08-02T20:31:22.5776874Z: Recurred during reconnect Task 5 plan and
  progress discovery. The executable again failed before searching; no
  repository or external state changed. The documented bounded
  `Select-String` fallback immediately succeeded for incident lookup.
- 2026-08-03T00:36:28.2471845Z: Recurred during the corrected-redeploy
  provider-contract trace. Ripgrep failed before searching; bounded
  `Select-String` immediately found the exact binding-contract source and no
  repository or external state changed.
- 2026-08-03T21:25:23.6971358Z: Recurred during the candidate-failure trace
  against one exact installed Wrangler bundle. The executable failed before
  searching because of the same Windows association problem; a bounded
  PowerShell reader completed the source scan. No source or provider state
  changed.
- 2026-08-03T21:59:58.2738957Z: Recurred during the final classifier-ledger
  verification. The preferred executable again failed before searching;
  bounded `Select-String` checks resumed immediately. No application,
  provider, credential, key, schedule, or deployment state changed.

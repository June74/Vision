# SB-20260802-184855-reconnect-diagnostic-relative-path: Reconnect diagnostic command assumed the worktree directory

- **Status:** closed
- **First observed:** 2026-08-02T18:48:55.309078Z
- **Last observed:** 2026-08-02T18:49:36.2227461Z
- **Phase/task:** Phase B OAuth reconnect recovery Task 2 review hardening
- **Environment:** Owner local PowerShell terminal outside the Phase B worktree
- **Version/commit:** `887cf72` plus the unstaged Task 2 review hardening

## Symptom

The owner-run PowerShell command could not resolve the relative diagnostic script path and stopped before the script executed.

## Impact

The final disposable PostgreSQL proof was delayed; no database, provider, credential, repository, or deployment state changed.

## Reproduction conditions

Invoke the task-local script through a relative `.superpowers` path while the
terminal's current directory is not the Phase B worktree.

## Safe evidence

PowerShell rejected the `-File` argument before the script executed. A local
read confirmed the script exists at its absolute worktree path.

## Attempts and outcomes

- The relative invocation stopped before the hidden prompt, database access,
  or any external action.
- The wrapper was updated to derive and select the worktree from
  `$PSScriptRoot` before resolving its local binaries and probe.
- Parser validation and an out-of-directory root-resolution check both passed.

## Cause classification

- **Confirmed cause:** Later owner guidance omitted the required worktree
  location and passed a relative script path to PowerShell.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The diagnostic file was not missing from the
  worktree.
- **Known exclusions:** The script stopped before reading a connection string
  or contacting Neon. No provider, database, repository, deployment, key, or
  private-data state changed.

## Correction and prevention

- **Correction:** Resolve the worktree relative to `$PSScriptRoot`, then invoke
  the wrapper by its absolute quoted path.
- **Prevention:** Owner-run task scripts must either include an explicit
  `Set-Location` or be location-independent and presented with an absolute
  path.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Rerun the absolute location-independent wrapper
  with the direct disposable connection string.

## Verification and related work

The PowerShell parser reported zero errors, and an invocation-root test run
from outside the worktree resolved the exact Phase B worktree successfully.

## Recurrence history

- 2026-08-02T18:48:55.309078Z: First observed.
- 2026-08-02T18:49:36.2227461Z: Closed after absolute-path and out-of-directory
  resolution verification passed.

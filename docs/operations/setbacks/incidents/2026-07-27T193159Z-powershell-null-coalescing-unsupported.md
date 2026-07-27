# SB-20260727-193159-powershell-null-coalescing-unsupported: PowerShell null-coalescing syntax was unsupported

- **Status:** closed
- **First observed:** 2026-07-27T19:31:59Z
- **Last observed:** 2026-07-27T19:31:59Z
- **Phase/task:** Phase B restore Task 4 live retry
- **Environment:** Local Windows worktree
- **Version/commit:** `9bbc4be`

## Symptom

The first read-only GitHub run-status command failed to parse because it used
the `??` null-coalescing operator.

## Impact

The workflow had already been dispatched successfully, but this local command
did not reach GitHub and therefore returned no status.

## Cause classification

- **Confirmed cause:** The installed PowerShell parser predates support for the
  null-coalescing operator.
- **Known exclusions:** The parse error occurred before the network query or any
  provider mutation.

## Correction and prevention

- **Correction:** Replace the operator with an explicit `$null`/empty-string
  conditional.
- **Prevention:** Keep operator-facing PowerShell compatible with the installed
  legacy parser and reuse already proven syntax.

## Verification and related work

The corrected read-only status command is the next action.

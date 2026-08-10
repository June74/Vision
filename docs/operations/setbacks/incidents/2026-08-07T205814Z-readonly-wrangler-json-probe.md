# SB-20260807-205814-readonly-wrangler-json-probe: Read-only JSON probe decode mismatch

- **Status:** contained
- **First observed:** 2026-08-07T20:58:14Z
- **Last observed:** 2026-08-07T20:58:14Z
- **Phase/task:** Phase B classifier-fingerprinted monitored candidate deployment
- **Environment:** Windows PowerShell, linked Phase B worktree, normal Wrangler authentication
- **Version/commit:** Current reviewed Phase B checkout; no tracked implementation change

## Symptom

The bounded read-only deployment/version probe exited zero but its first
PowerShell file-capture wrapper did not decode the captured JSON. The preview
health request decoded successfully and returned the expected contract.
The follow-up shape-only wrapper then had an unmatched PowerShell `try` block
before execution.
The shape check showed the provider output was valid pretty-printed JSON; the
first reader had named a function parameter `$args`, colliding with
PowerShell's automatic argument variable.

## Impact

No provider mutation occurred. The deployment/version reconciliation result was
temporarily inconclusive because of the local capture wrapper.

## Resolution

The probe will be rerun with shape-only capture diagnostics and an explicit
JSON-output normalization path. Raw Wrangler output will not be printed or
stored in the incident.
The wrapper is being reduced to separate, explicitly scoped endpoint checks.
The corrected reader uses an explicit command-arguments parameter and decodes
the same output successfully.

## Prevention

Treat exit status and JSON decoding as separate checks, and validate the
captured output's safe shape before interpreting provider state.
Keep bounded PowerShell probes short and structurally validate each wrapper
before composing multiple endpoint checks.

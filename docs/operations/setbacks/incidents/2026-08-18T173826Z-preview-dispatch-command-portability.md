# SB-20260818-173826 — Preview dispatch command portability failures

- Status: contained
- Detected at: 2026-08-18T17:38:26Z
- Last observed at: 2026-08-18T17:38:26Z
- Scope: Phase C preview workflow dispatch command
- Environment: Windows PowerShell 5.1 and GitHub CLI
- Reviewed branch: `codex/phase-c-write-pipeline`

## What happened

The dispatch command reported two local failures: the static
`RandomNumberGenerator.Fill` method was unavailable, followed by the wrapper
exception `Workflow dispatch failed.`

## Impact

The command did not establish a new preview workflow run or deployment. No
production, database, credential, or provider state changed.

## Confirmed causes

1. Windows PowerShell 5.1/.NET Framework does not expose the static
   `RandomNumberGenerator.Fill` method. A compatible instance created by
   `RandomNumberGenerator.Create()` and its `GetBytes()` method succeeds.
2. `gh workflow run --json` parses standard-input inputs into string values.
   The command supplied `configure_ai_budget` as JSON Boolean `false`, so
   `gh` returned nonzero before it could create the workflow dispatch event.
   The surrounding PowerShell `throw` converted that nonzero result into the
   generic RuntimeException message.

## Secondary risk

The first method failure was non-terminating in Windows PowerShell, so the
script could continue with an all-zero byte array. That value has the correct
length but is not a safe unique dispatch correlation. The command must fail
closed when randomness generation fails.

## Correction

Use `RandomNumberGenerator.Create().GetBytes()` with disposal, set
`$ErrorActionPreference = 'Stop'`, validate that the correlation is 64
lowercase hexadecimal characters and not all zero, and send all workflow
inputs as strings through the `--json` standard-input path. The context itself
remains a JSON string nested inside the outer input object.

## Verification

The portable `GetBytes()` path produced a 64-character lowercase hexadecimal
correlation locally. The GitHub CLI source confirms that JSON workflow inputs
are unmarshaled into `map[string]string`; the corrected command has not yet
been dispatched.

## Next step

Push the current documentation-only branch tip, then dispatch one fresh
normal preview using the portable generator and string-valued JSON inputs.
Inspect the `gh` error directly if it returns nonzero; do not wrap it in a
generic exception before preserving its safe message.

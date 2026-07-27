# SB-20260726-203035-powershell-utc-flag-unsupported: PowerShell UTC flag was unsupported

- **Status:** closed
- **First observed:** 2026-07-26T20:30:35.2961897Z
- **Last observed:** 2026-07-26T23:54:52Z
- **Phase/task:** Phase B release operations
- **Environment:** Local PowerShell runtime
- **Version/commit:** `3128b5c`

## Symptom

The installed PowerShell version rejected the `Get-Date -AsUTC` parameter.

## Impact

Only timestamp collection for the setback record was delayed. No project or
provider state changed.

## Reproduction conditions

Invoke the newer `Get-Date -AsUTC` form in this older PowerShell runtime.

## Safe evidence

PowerShell reported that no parameter matched `AsUTC`.

## Attempts and outcomes

- The unsupported command failed without side effects.
- `[DateTime]::UtcNow` produced the required UTC timestamp successfully.

## Cause classification

- **Confirmed cause:** The local PowerShell version predates the `AsUTC`
  parameter.
- **Hypotheses:** None.
- **Rejected hypotheses:** System time access was not unavailable.
- **Known exclusions:** No application code or provider configuration was
  involved.

## Correction and prevention

- **Correction:** Used `[DateTime]::UtcNow` for compatible UTC timestamp
  generation.
- **Prevention:** Use the .NET UTC clock form in this workspace.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The compatible form returned a correctly formatted UTC timestamp.

## Recurrence history

- 2026-07-26T20:30:35.2961897Z: First observed.
- 2026-07-26T22:51:41Z: Recurred while timestamping an unrelated browser
  diagnostic incident. The failed command had no side effects; the compatible
  `[DateTime]::UtcNow` form succeeded immediately afterward.
- 2026-07-26T23:54:52Z: Recurred while timestamping another browser helper
  incident. No state changed; the compatible .NET UTC clock form succeeded
  immediately afterward.

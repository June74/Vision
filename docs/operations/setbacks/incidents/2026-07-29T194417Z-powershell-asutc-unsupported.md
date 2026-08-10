# SB-20260729-194417-powershell-asutc-unsupported: PowerShell rejected the UTC date parameter

- **Status:** closed
- **First observed:** 2026-07-29T19:44:17Z
- **Last observed:** 2026-08-10T21:33:49Z
- **Phase/task:** Phase B consolidated final-fix setback logging
- **Environment:** Local Phase B worktree
- **Version/commit:** Working changes based on `e3c1272`

## Symptom

The local PowerShell version rejected `Get-Date -AsUTC` while preparing a
privacy-safe incident timestamp.

## Impact

One read-only timestamp command failed. No repository or provider state
changed.

## Cause classification

- **Confirmed cause:** This PowerShell version does not implement the
  `Get-Date -AsUTC` parameter.
- **Hypotheses:** None.
- **Rejected hypotheses:** Clock unavailability.
- **Known exclusions:** The .NET UTC clock API succeeded immediately afterward.

## Correction and prevention

- **Correction:** Use the version-compatible .NET UTC clock API for local
  incident timestamps.
- **Prevention:** Avoid `Get-Date -AsUTC` in this worktree.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The replacement returned a UTC timestamp without exposing private data.

- 2026-08-01T00:43:15.6288058Z: Recurred during Gate 0 setback-ledger
  maintenance because a read-only timestamp command reused `Get-Date -AsUTC`.
  The command's file reads still completed, no state changed, and the
  controller immediately returned to `[DateTime]::UtcNow.ToString('o')`.
- 2026-08-02T05:51:23.8451089Z: Recurred during Task 8 live acceptance
  setback maintenance. Parameter binding failed before any repository or
  provider state changed; the compatible .NET UTC clock expression succeeded.
- 2026-08-02T22:58:28.1718576Z: Recurred during reconnect rollback-evidence
  maintenance. Parameter binding failed before any repository or provider
  state changed; `[DateTime]::UtcNow.ToString('o')` succeeded immediately.
- 2026-08-10T21:33:49Z: Recurred during Phase B artifact-verification
  documentation. Parameter binding failed before any repository or provider
  state changed; `[DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')`
  succeeded immediately.

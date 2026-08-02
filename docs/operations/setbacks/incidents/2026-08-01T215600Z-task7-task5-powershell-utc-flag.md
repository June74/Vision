# SB-20260801-215600-task7-task5-powershell-utc-flag: PowerShell rejected the UTC timestamp flag

- **Status:** contained
- **First observed:** 2026-08-01T21:56:00Z
- **Last observed:** 2026-08-01T22:05:24.8336071Z
- **Phase/task:** Phase B Task 7 correlation repair Task 5 setback logging
- **Environment:** Local Windows PowerShell
- **Version/commit:** admitted baseline `10b228b`

## Symptom

A read-only logging command used `Get-Date -AsUTC`, but this PowerShell version does not provide that parameter. The orchestration call returned nonzero and suppressed the successful sibling read results.

## Impact

No project or external state changed. The timestamp lookup and two read-only file inspections had to be retried separately. No secret, key, provider, network, deployment, database, browser, calendar, object storage, stage, commit, or push was involved.

## Reproduction conditions

Run `Get-Date` with the unsupported UTC parameter in the current Windows PowerShell host.

## Safe evidence

The shell reported an invalid parameter for the timestamp-only command. No raw sensitive output is retained.

## Attempts and outcomes

- The first combined read-only orchestration call returned nonzero.
- The runtime-neutral .NET UTC clock returned one canonical timestamp successfully.

## Cause classification

- **Confirmed cause:** The command assumed a newer PowerShell parameter set than the active host provides.
- **Hypotheses:** Use the runtime-neutral .NET UTC clock or an already supported `Get-Date` form.
- **Rejected hypotheses:** Filesystem permissions, repository state, and external authentication did not contribute.
- **Known exclusions:** This has no effect on application runtime or provider behavior.

## Correction and prevention

- **Correction:** Use `[DateTime]::UtcNow.ToString(...)` for future UTC log timestamps.
- **Prevention:** Avoid version-specific PowerShell date flags in portable project commands.
- **Owner:** Codex.
- **Next diagnostic step:** Perform one runtime-neutral UTC timestamp read.

## Verification and related work

Closed locally: the runtime-neutral UTC timestamp read succeeded without modifying project or external state.

## Recurrence history

- 2026-08-01T21:56:00Z: First recorded after the timestamp-only parameter failure.
- 2026-08-01T21:57:41.7823920Z: Closed after the portable UTC clock succeeded.
- 2026-08-01T22:05:24.8336071Z: The Task 5 repair subagent repeated the
  unsupported flag during a post-GREEN timestamp-only inspection. The
  remaining read-only inspection succeeded, and no source, provider, or
  external state changed. The incident is contained by requiring the portable
  .NET UTC clock in all remaining Task 5 work.

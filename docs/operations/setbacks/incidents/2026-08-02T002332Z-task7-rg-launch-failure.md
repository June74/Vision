# Task 7 bounded search could not launch rg

- **Occurred:** 2026-08-02T00:23:32Z
- **Status:** contained
- **Phase:** Phase B / tracked correlation repair / Task 7 proof-chain reachability repair
- **Category:** local tooling incompatibility

## What happened

A bounded read-only repository search could not launch the bundled `rg.exe` because this Windows session reported that no application was associated with the executable.

No project state, provider state, secret, or live environment was changed.

## Impact

The intended search produced no results and the paired source read did not run because the orchestration cell stopped on the first failed command. The failure does not affect product code or evidence already collected.

## Corrective action

- Record the failed command before retrying.
- Use bounded `Select-String` and `Get-Content` reads for this repair.
- Keep each diagnostic read independent so one local tool failure cannot suppress another result.

## Prevention

On this Windows session, treat `rg.exe` launchability as unverified and fall back immediately to native PowerShell search when it cannot start.

## Recurrence

At 2026-08-02T00:28:32Z the read-only integration reviewer encountered the same local launch failure before reading project content. The reviewer made no changes and switched to bounded PowerShell search. The review was then stopped for a separate moving-target repair.

At 2026-08-02T01:12:19.1512532Z the exact-tip reviewer encountered the same local launch restriction while listing ignored review artifacts. No project or protected state was accessed or changed. The review was stopped before verdict and will restart with native PowerShell discovery only.

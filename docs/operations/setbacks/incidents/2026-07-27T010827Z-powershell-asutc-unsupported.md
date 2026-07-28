# SB-20260727-010827-powershell-asutc-unsupported: PowerShell UTC flag was unsupported

- **Status:** closed
- **First observed:** 2026-07-27T01:08:27Z
- **Last observed:** 2026-07-28T22:23:26.3813087Z
- **Phase/task:** Phase B acceptance instrumentation Task 1 discovery
- **Environment:** Local Windows worktree
- **Version/commit:** `0f08fc1`

## Symptom

PowerShell rejected the `Get-Date -AsUTC` parameter.

## Impact

The timestamp subcommand failed; subsequent read-only inspection still ran.

## Cause classification

- **Confirmed cause:** The installed PowerShell version does not implement that
  parameter.
- **Known exclusions:** No filesystem or provider mutation depended on the
  failed timestamp.

## Correction and prevention

- **Correction:** Use `[DateTime]::UtcNow.ToString(...)`.
- **Prevention:** Prefer the .NET UTC API for cross-version PowerShell scripts.

## Verification and related work

The replacement returned a valid UTC timestamp.

## Recurrence

- **2026-07-27T19:24:12Z:** The unsupported flag was used again while preparing
  the Cloudflare dialog setback entry. The timestamp subcommand failed, no
  provider or filesystem mutation depended on it, and the documented .NET UTC
  API immediately returned a valid timestamp.
- **2026-07-27T20:46:34Z:** The unsupported flag was used again while logging
  the restore-retry specification formatting recurrence. No mutation depended
  on the failed timestamp. The correction used
  `(Get-Date).ToUniversalTime().ToString(...)`, which returned a valid UTC
  timestamp.
- **2026-07-28T00:25:50Z:** The unsupported flag was used again while preparing
  Task 2 implementation setback timestamps. No mutation depended on the failed
  timestamp. The documented `[DateTime]::UtcNow.ToString(...)` correction
  immediately returned a valid UTC timestamp.
- **2026-07-28T01:13:37.0861005Z:** The unsupported flag was used again while
  recording the Task 3 handoff setback. The read-only index search completed,
  no mutation depended on the failed timestamp, and the documented
  `[DateTime]::UtcNow.ToString(...)` correction immediately returned a valid
  UTC timestamp.
- **2026-07-28T02:50:34Z:** The unsupported flag was used again while checking
  the safe live report's modification time. The file metadata check completed,
  no mutation depended on the failed timestamp, and the documented
  `[DateTime]::UtcNow.ToString(...)` correction immediately returned a valid
  UTC timestamp.
- **2026-07-28T18:43:28.7660518Z:** The unsupported flag was used again while
  checking the new ripgrep incident timestamp. The incident lookup completed,
  no mutation depended on the failed timestamp, and the documented
  `[DateTime]::UtcNow.ToString(...)` correction immediately returned a valid
  UTC timestamp.
- **2026-07-28T22:23:26.3813087Z:** The unsupported flag was used again while
  preparing the Task 3 privilege-helper incident. No mutation depended on the
  failed timestamp, and `[DateTime]::UtcNow.ToString(...)` immediately returned
  a valid UTC timestamp.

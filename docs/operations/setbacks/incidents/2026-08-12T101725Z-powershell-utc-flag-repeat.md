# SB-20260812-101725 — Unsupported PowerShell UTC flag repeated during diagnosis

- **Status:** contained
- **Detected:** 2026-08-12T10:17:25Z
- **Last observed:** 2026-08-13T00:32:26Z
- **Area:** Phase B maintenance observer diagnosis
- **Symptom:** A diagnostic command used the unsupported `Get-Date -AsUTC` parameter on this PowerShell version and stopped before reading any project or provider state.
- **Impact:** No external action or file mutation occurred; the time probe had to be corrected.
- **Root cause:** The earlier supported `[DateTime]::UtcNow` form was not reused.
- **Next action:** Use `[DateTime]::UtcNow` for UTC timestamps on this host and avoid the unsupported parameter.

- **Recurrence:** 2026-08-13T00:32:26Z, the same read-only probe again used
  `Get-Date -AsUTC` and stopped before producing a timestamp. The supported
  `[DateTime]::UtcNow` form then returned the canonical UTC time; no state
  changed.

# SB-20260730-020233-get-date-asutc-unsupported: Windows PowerShell did not support Get-Date AsUTC

- **Status:** closed
- **First observed:** 2026-07-30T02:02:33.1614903Z
- **Last observed:** 2026-07-30T02:02:33.1614903Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 5
- **Environment:** Local Phase B linked worktree under Windows PowerShell
- **Version/commit:** Uncommitted documentation work based on `3b735be`

## Symptom

`Get-Date -AsUTC` failed because the available Windows PowerShell version does
not expose the `AsUTC` parameter.

## Impact

The timestamp read failed before any file or external state changed. It delayed
the incident update by one command only.

## Reproduction conditions and safe evidence

Run `Get-Date -AsUTC` in this worktree's Windows PowerShell host. PowerShell
reports that no parameter named `AsUTC` exists.

## Attempts and outcomes

- The newer `Get-Date -AsUTC` form failed.
- `(Get-Date).ToUniversalTime().ToString(...)` returned the required UTC
  timestamp.

## Cause classification

- **Confirmed cause:** The command assumed a newer PowerShell parameter than
  this host supports.
- **Hypothesis:** The timestamp failure might come from locale or workspace
  permissions.
- **Rejected hypothesis:** Parameter binding failed before locale formatting
  or filesystem access, and the compatible UTC expression succeeded.
- **Known exclusions:** Workspace permissions, locale, and repository contents
  were not involved.

## Correction and prevention

- **Correction:** Use the version-compatible `ToUniversalTime()` expression.
- **Prevention:** Prefer the compatible expression for future timestamps in
  this Windows PowerShell worktree.
- **Owner:** Codex.
- **Next diagnostic step:** None.

## Verification and related work

The compatible expression returned `2026-07-30T02:02:33.1614903Z`.

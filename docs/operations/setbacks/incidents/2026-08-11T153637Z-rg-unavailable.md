# SB-20260811-153637-rg-unavailable

- Incident ID: `SB-20260811-153637-rg-unavailable`
- First observed: `2026-08-11T15:36:37Z`
- Last observed: `2026-08-11T15:36:37Z`
- Status: `contained`
- Phase/task: Phase B live sync diagnosis
- Environment: Windows PowerShell, Phase B linked worktree
- Version/commit: `f31d53c`

## Symptom

The preferred `rg` repository search executable could not be launched because
Windows has no application association for `rg.exe` in this environment.

## Impact

The search returned no evidence and made no repository, provider, database,
secret, key, calendar, or deployment changes.

## Cause classification

- **Confirmed cause:** `rg.exe` is unavailable to the current PowerShell
  execution environment.
- **Rejected hypotheses:** this was not a source-code or live-sync failure.

## Correction and prevention

Use bounded `Select-String` searches for this Windows workspace when `rg` is
not executable, while keeping the same path and exclusion scope.

## Next step

Continue the Phase 1 evidence search with PowerShell and inspect the live sync
status path before proposing any fix.

## Verification

No files or external services were changed by the failed search invocation.

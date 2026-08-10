# SB-20260810-203802-github-run-list-array-probe: Read-only run-list parser flattened JSON arrays

- **Status:** closed
- **First observed:** 2026-08-10T20:38:02.825Z
- **Last observed:** 2026-08-10T20:38:02.825Z
- **Phase/task:** Phase B post-deployment verification
- **Environment:** Windows PowerShell, external read-only GitHub CLI probe
- **Version/commit:** Reviewed Phase B checkout

## Symptom

A safe `gh run list --json` probe treated the captured JSON array as one
PowerShell object, so array-valued fields were flattened into space-separated
strings.

## Impact

The probe's summary was invalidated before any conclusion. No workflow,
provider, repository, credential, or deployment state changed.

## Correction and prevention

Join captured CLI output lines before `ConvertFrom-Json`, then validate that the
result is an array before projecting safe fields. Never use the flattened
summary as deployment evidence.

## Recurrence history

- 2026-08-10T20:38:02.825Z: First observed and corrected immediately with a
  bounded array-aware parser.

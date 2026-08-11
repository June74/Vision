# SB-20260811-162802-restore-branch-absent

- Incident ID: `SB-20260811-162802-restore-branch-absent`
- First observed: `2026-08-11T16:28:02Z`
- Last observed: `2026-08-11T16:28:02Z`
- Status: `contained`
- Phase/task: Phase B encrypted restore-drill preparation
- Environment: Neon preview project and local PowerShell operator session
- Version/commit: `d5b5767`

## Symptom

The current Neon project has no disposable restore branch, although the older
credential ledger described one as retained after the prior restore attempts.
The temporary Cloudflare restore secrets are also absent, so the restore drill
cannot be resumed from the old state.

While preparing this record, the first local timestamp helper used the
unsupported PowerShell `Get-Date -AsUTC` parameter and failed before any file
or provider action.

## Impact

No main preview branch, database row, secret, key, calendar, deployment, or
provider resource was changed. The restore gate remains pending.

## Cause classification

- **Confirmed:** current operator-visible Neon state does not contain the
  disposable branch expected by the historical ledger.
- **Unresolved:** whether the branch was deleted later, is in a different Neon
  project, or the historical cleanup record is stale.
- **Operator mistake:** the first timestamp command was not portable to this
  PowerShell version.

## Correction and prevention

Never point the restore job at the main preview database. Recreate a clearly
named disposable branch in the approved Neon project, re-attest that exact
branch, and use a portable timestamp helper for future records.

## Next step

Owner creates a new disposable branch from the current preview database,
provisions the restore-only attestation, and adds the two temporary Worker
secrets only after the branch identity is confirmed. The branch will be
permanently deleted after verification.

## Verification

The discrepancy was identified before any restore, deployment, secret write,
or database mutation.

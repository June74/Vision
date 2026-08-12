# SB-20260812-083403-wrangler-secret-list-json-flag

- Incident ID: `SB-20260812-083403-wrangler-secret-list-json-flag`
- First observed: `2026-08-12T08:34:03Z`
- Last observed: `2026-08-12T08:35:58Z`
- Status: `closed`
- Phase/task: Phase B live-state reconciliation
- Environment: local PowerShell probe using the saved Wrangler authentication
- Version/commit: `0bcdff921d624f9fa9bfbdb7ee5157545c801abb`

## Symptom

The read-only reconciliation probe requested `--json` from the Wrangler
`secret list` command. The installed Wrangler rejected that flag and the
PowerShell error policy stopped the combined probe before its safe Boolean-only
summary was emitted.

## Impact

The probe produced no accepted state summary. No secret value was read, and no
Cloudflare, Neon, Google, GitHub, database, calendar, schedule, binding, or
deployment state changed.

## Cause classification

- **Confirmed cause:** this installed Wrangler command does not support the
  `--json` option for `secret list`.
- **Rejected hypothesis:** provider authentication failure was not established;
  the probe stopped at argument parsing before the authentication result could
  be summarized.

## Diagnostic attempts

- The combined probe used a public health request, Git branch checks, Wrangler
  authentication, deployment listing, and secret-name listing.
- The only unexpected failure was the unsupported secret-list flag. Raw
  Wrangler output was not retained in the incident or shown to the user.

## Correction and prevention

Use bounded text capture for `secret list` without `--json`, parse only the
allowlisted temporary and backup secret names, and discard all other output.
Keep each provider probe independently bounded so one CLI compatibility error
cannot obscure already-collected safe facts.

## Owner and next step

- Owner: Phase B controller/operator
- Next step: rerun the corrected read-only reconciliation, then continue only
  from its Boolean/count result.

## Verification

The corrected probe exited successfully for Wrangler authentication,
deployment listing, and allowlisted secret-name capture. Both temporary
restore names were absent and the permanent backup-key name was present; no
secret values were read.

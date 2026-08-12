# SB-20260812-083656-health-field-assumption

- Incident ID: `SB-20260812-083656-health-field-assumption`
- First observed: `2026-08-12T08:36:56Z`
- Last observed: `2026-08-12T08:35:58Z`
- Status: `closed`
- Phase/task: Phase B live-state reconciliation
- Environment: public preview health probe
- Version/commit: `0bcdff921d624f9fa9bfbdb7ee5157545c801abb`

## Symptom

The public preview endpoint returned HTTP 200, but the reconciliation probe
classified it as unhealthy because it assumed the JSON body contained a
`status` value equal to `ok`.

## Impact

Only the local interpretation was wrong. No provider, database, calendar,
secret, key, schedule, binding, deployment, or repository state was changed by
the probe.

## Cause classification

- **Confirmed cause:** the probe guessed the response field instead of reading
  the checked-in health contract.
- **Hypothesis:** the preview Worker was unhealthy; this is not supported by
  the HTTP 200 result and remains rejected pending the canonical contract
  check.

## Correction and prevention

Use the repository's exact public health response contract and compare only its
allowlisted safe fields. Do not infer a provider or application failure from a
successful HTTP response with an unfamiliar shape.

## Owner and next step

- Owner: Phase B controller/operator
- Next step: inspect the checked-in health route/test contract, rerun the
  Boolean-only health check, then append the result and close this incident.

## Verification

The canonical `/api/health` probe returned HTTP 200, the exact `{status:
ok, service: vision}` contract, and no extra response keys.

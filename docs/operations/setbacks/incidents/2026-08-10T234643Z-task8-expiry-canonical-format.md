# SB-20260810-234643-task8-expiry-canonical-format

- Incident ID: `SB-20260810-234643-task8-expiry-canonical-format`
- First observed: `2026-08-10T23:46:43Z`
- Last observed: `2026-08-10T23:46:43Z`
- Status: `contained`
- Phase/task: Phase B monitored candidate acceptance
- Environment: Windows PowerShell, frozen Phase B worktree
- Version/commit: `d409da5c`

## Symptom

The refreshed acceptance input used an expiry with seven fractional-second
digits. The controller accepts only an ISO timestamp with exactly three
millisecond digits and therefore returned `failed_closed` during input
validation.

## Impact

The controller stopped before the remote-tip guard, child driver, workflow
dispatch, candidate, rollback, or closure. No provider, deployment, traffic,
secret, key, database, or calendar state changed.

## Cause classification

- **Confirmed cause:** the local expiry-generation probe used `ToString('o')`
  instead of the controller's canonical millisecond representation.
- **Rejected hypotheses:** the remote-tip guard, repository selector, GitHub,
  Cloudflare, and the candidate artifact were not reached by this invocation.

## Correction and prevention

Generate the expiry with `ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')`
and validate the exact input schema before launching the controller. Do not
infer a provider-stage failure from a status emitted during local validation.

## Next step

Refresh the input with the canonical three-digit expiry, confirm the
non-secret repository selector is present, and run the one approved bounded
workflow.

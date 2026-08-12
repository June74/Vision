# SB-20260812-012721-role-probe-rollback-temporary-secrets

- Incident ID: `SB-20260812-012721-role-probe-rollback-temporary-secrets`
- First observed: `2026-08-12T01:27:21Z`
- Last observed: `2026-08-12T01:34:00Z`
- Status: `contained`
- Phase/task: Phase B monitored role-probe acceptance and rollback closure
- Environment: GitHub Actions preview workflow, Cloudflare preview Worker
- Version/commit: `f2018732036d76fdc1e6342e711f6f90a499d4d9`

## Symptom

The monitored controller reached `observer_ready`,
`candidate_dispatched`, `candidate_signal_seen`, and
`rollback_dispatched`, then returned `failed_closed`. The rollback workflow
failed at `Verify normal runtime and temporary-surface absence`.

## Impact

The candidate and rollback provider workflows completed successfully. The
normal preview runtime is healthy and the permanent schedules are present, but
the closure proof was not produced. No secret value, backup key, database,
calendar, or application data was changed by the diagnostic checks.

## Cause classification

- **Confirmed cause:** the normal provider contract is exact and excludes the
  two temporary restore bindings. A safe authenticated Cloudflare read after
  rollback reported 26 bindings, the expected permanent schedules, healthy
  runtime status, and both temporary restore names still present. The
  acceptance scenario binding was absent. Therefore the normal-state validator
  correctly rejected the lingering restore names.
- **Supporting timing evidence:** rollback deployment completed immediately
  before the failed provider check; the check ran in the same second. A later
  read-only provider inspection reached the same healthy state and isolated the
  remaining mismatch to the temporary names.
- **Rejected hypotheses:** missing secrets, wrong secret types, schedule
  mismatch, unhealthy public runtime, authentication failure, and candidate
  deployment failure were not supported by the safe evidence.

## Correction and prevention

The temporary restore secrets must be removed only after the restore window is
no longer needed and after the normal Worker has been redeployed. This cleanup
is an externally destructive credential action and remains owner-approved
manual work unless a separate workflow change is explicitly approved. Do not
relax the normal validator to accept lingering temporary secrets.

## Next step

The owner must decide whether to close the temporary restore window now. If
approved, delete only `PREVIEW_RESTORE_DATABASE_URL` and
`PREVIEW_RESTORE_TARGET_ID` from the `vision-preview` Worker, then perform a
read-only normal-state verification before any new monitored acceptance.

## Verification

The observer, candidate, and rollback workflow jobs completed with provider
success; the rollback provider-state check alone failed. No new acceptance
retry was started after this diagnosis.

## Recurrence

- `2026-08-12T01:29:20Z`: a local Wrangler secret-list probe could not write
  its protected diagnostic log and produced no inventory. A direct read-only
  Cloudflare API inspection was used instead; it exposed only safe counts,
  names-presence flags, and statuses.

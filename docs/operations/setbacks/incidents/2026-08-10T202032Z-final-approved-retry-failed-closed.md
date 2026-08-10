# SB-20260810-202032-final-approved-retry-failed-closed: Final approved controller run failed closed

- **Status:** contained
- **First observed:** 2026-08-10T20:20:32.315Z
- **Last observed:** 2026-08-10T20:23:47.566Z
- **Phase/task:** Phase B monitored candidate deployment
- **Environment:** Windows PowerShell, approved external controller boundary
- **Version/commit:** Reviewed remote `codex/phase-b-foundation` commit; no new implementation change

## Symptom

The one approved monitored `foundation_probe` controller run returned only the
safe status `failed_closed` before any candidate or rollback status was emitted.
Read-only GitHub reconciliation found a successful selection job, one active
observer listener, and all candidate/rollback jobs skipped. The raw child
output was captured and discarded by the controller contract.

## Impact

The run stopped before candidate dispatch. No Cloudflare deployment or
rollback occurred, and no second retry is authorized.

## Cause classification

- **Confirmed cause:** GitHub Actions observer startup exceeded the controller's
  fixed 120-second observer-resolution window. The observer listener was still
  active after the controller failed closed.
- **Rejected hypothesis:** Cloudflare upload failure; candidate and rollback
  jobs were skipped and no Cloudflare mutation was dispatched.
- **Known exclusions:** No candidate/rollback version, binding, schedule,
  secret, key, database, or calendar mutation was attempted by this run.

## Correction and prevention

- **Correction:** Reconciled the workflow run and stopped before any candidate
  action; retained only fixed status/count evidence.
- **Prevention:** Extend or otherwise redesign the local observer-resolution
  window to accommodate the workflow's dependency-install/startup latency,
  then rerun local controller tests and obtain separate approval before a new
  provider mutation. Do not reuse this consumed approval for another run.

## Immediate handling

Do not rerun the controller. Inspect only bounded local state and read-only
GitHub run metadata, retaining no identifiers, payloads, credentials, or raw
logs. Automatic rollback remains governed by the controller if a candidate was
actually attributed.

## Recurrence history

- 2026-08-10T20:20:32.315Z: First observed during the final approved retry.
- 2026-08-10T20:23:47.566Z: Read-only reconciliation confirmed selection
  success, one active observer listener, zero non-skipped candidate/rollback
  jobs, and no Cloudflare mutation. The failure is contained as a local
  observer-resolution timing defect.

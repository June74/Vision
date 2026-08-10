# SB-20260810-233509-task8-driver-repository-env-missing

- Incident ID: `SB-20260810-233509-task8-driver-repository-env-missing`
- First observed: `2026-08-10T23:35:09Z`
- Last observed: `2026-08-10T23:35:09Z`
- Status: `superseded`
- Phase/task: Phase B monitored candidate acceptance
- Environment: Windows PowerShell, frozen Phase B worktree
- Version/commit: `f6b14599`

## Symptom

The monitored acceptance controller returned `failed_closed` before its
`observer_ready` status. The invoking shell also lacked the driver's
non-secret repository selector, so that was initially recorded as the cause.

## Impact

The invocation did not dispatch a workflow. No provider, deployment, traffic,
secret, key, database, or calendar state changed.

## Cause classification

- **Correction:** the acceptance input used a seven-digit fractional expiry,
  while the controller requires an exact three-digit millisecond timestamp.
  Input validation failed before the child driver or remote-tip guard ran, so
  the missing repository selector was not reached on that invocation.
- **Withdrawn diagnosis:** the earlier claim that the missing selector caused
  this failed-closed result was not established and must not be reused.
- **Rejected hypotheses:** no candidate-stage or Cloudflare error was reached.

## Correction and prevention

Use an exact three-digit canonical expiry before starting the controller.
Keep the repository selector preflight as a separate check, and keep secrets
out of command output.

## Next step

Regenerate the input with a canonical expiry, verify the selector is present,
and rerun the same frozen-tip candidate/rollback scope once.

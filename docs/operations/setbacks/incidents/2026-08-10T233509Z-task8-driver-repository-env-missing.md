# SB-20260810-233509-task8-driver-repository-env-missing

- Incident ID: `SB-20260810-233509-task8-driver-repository-env-missing`
- First observed: `2026-08-10T23:35:09Z`
- Last observed: `2026-08-10T23:35:09Z`
- Status: `contained`
- Phase/task: Phase B monitored candidate acceptance
- Environment: Windows PowerShell, frozen Phase B worktree
- Version/commit: `f6b14599`

## Symptom

The monitored acceptance controller returned `failed_closed` before its
`observer_ready` status. No candidate, rollback, or closure status was
emitted.

## Impact

The invocation did not dispatch a workflow. No provider, deployment, traffic,
secret, key, database, or calendar state changed.

## Cause classification

- **Confirmed cause:** the local provider driver requires the non-secret
  `VISION_TASK8_REPOSITORY` selector, but the invoking shell did not provide
  it. The controller's `--repository` argument does not populate the child
  driver's environment.
- **Rejected hypotheses:** the remote-tip guard passed independently, and no
  candidate-stage or Cloudflare error was reached.

## Correction and prevention

Set `VISION_TASK8_REPOSITORY` to the approved repository slug for the bounded
driver invocation, while keeping secrets out of command output. Add an
environment-presence preflight before starting the controller.

## Next step

Re-run the same frozen-tip controller once with the repository selector set;
keep the candidate/rollback scope unchanged.

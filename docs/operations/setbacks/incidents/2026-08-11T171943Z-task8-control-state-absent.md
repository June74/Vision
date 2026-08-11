# SB-20260811-171943-task8-control-state-absent

- Incident ID: `SB-20260811-171943-task8-control-state-absent`
- First observed: `2026-08-11T17:19:43Z`
- Last observed: `2026-08-11T17:19:43Z`
- Status: `contained`
- Phase/task: Phase B monitored acceptance controller preparation
- Environment: Windows PowerShell, ignored Task 8 driver state
- Version/commit: `5fc5a4a`

## Symptom

The expected ignored Task 8 control and state directories were not present when
inspected before starting the acceptance driver.

## Impact

No provider dispatch, deployment, secret, database, key, calendar, or source
change occurred. The driver can recreate these private directories itself.

## Cause classification

- **Confirmed:** the prior local control/state artifacts are absent in the
  current worktree.
- **Unresolved:** whether they were intentionally cleaned up or removed by a
  prior contained run.
- **Rejected hypothesis:** this is not evidence of a Cloudflare or GitHub
  failure.

## Correction and prevention

Use the tracked driver’s own bounded directory creation and never restore or
copy stale control files. Keep these ignored directories out of Git and
reports.

## Next step

Start the controller with the exact driver and allow it to create only its own
private control/state directories.

## Verification

The directory lookup was read-only and completed before any external action.

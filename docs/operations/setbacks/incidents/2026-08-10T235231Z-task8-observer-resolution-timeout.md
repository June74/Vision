# SB-20260810-235231-task8-observer-resolution-timeout

- Incident ID: `SB-20260810-235231-task8-observer-resolution-timeout`
- First observed: `2026-08-10T23:52:31Z`
- Last observed: `2026-08-11T00:29:47.553Z`
- Status: `contained`
- Phase/task: Phase B monitored candidate acceptance
- Environment: Windows PowerShell, frozen Phase B worktree
- Version/commit: `c2c64365`

## Symptom

The canonical-input controller run dispatched and correlated the observer
workflow at the reviewed tip, but returned `failed_closed` while the observer
resolution window was still settling.

## Impact

Read-only reconciliation showed the selection job succeeded and the
`Capture foundation_probe signal` job remained in progress with its
`Print only allowlisted acceptance evidence` listener in progress. No
candidate, rollback, closure, Cloudflare deployment, traffic, secret, key,
database, or calendar mutation ran.

## Cause classification

- **Confirmed cause:** the controller and resolver both allowed only a
  five-second terminal metadata margin beyond the resolver's 120-second
  stable-listener window. GitHub API reads and dependency startup consumed
  that margin, so the outer abort fired before observer readiness could be
  returned.
- **Rejected hypotheses:** branch-tip drift, input schema, repository selector,
  GitHub dispatch, correlation, and Cloudflare upload were not the cause.

## Correction and prevention

Increase the bounded terminal metadata margin in both the observer resolver and
controller, and add a regression assertion that the full window includes the
larger margin. Keep the listener and candidate workflow independently bounded;
do not bypass the remote-tip guard.

## Next step

Write the timing regression first, observe it fail at the old five-second
margin, then apply the minimal shared-margin repair and rerun the local
controller/resolver suites before another live attempt.

## Recurrence

- 2026-08-11T00:29:47.553Z: The next canonical retry reached exactly one
  `workflow_dispatch` observer for the reviewed commit and the foundation
  listener was active, but the controller still returned `failed_closed`
  before `observer_ready`. A later read-only metadata check showed the run and
  listener still active; no candidate, rollback, or provider mutation ran.
  The 30-second terminal margin was not sufficient for this live metadata
  settlement. The margin is being widened in a bounded follow-up repair.

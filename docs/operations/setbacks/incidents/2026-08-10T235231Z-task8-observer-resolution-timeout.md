# SB-20260810-235231-task8-observer-resolution-timeout

- Incident ID: `SB-20260810-235231-task8-observer-resolution-timeout`
- First observed: `2026-08-10T23:52:31Z`
- Last observed: `2026-08-11T00:48:13.125Z`
- Status: `contained`
- Phase/task: Phase B monitored candidate acceptance
- Environment: Windows PowerShell, frozen Phase B worktree
- Version/commit: `a6cd3d95`

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
- **Confirmed live listener cause:** the observer was configured to fail closed
  on any terminal marker, including the normal fifteen-minute
  `calendar.maintenance` signal. That unrelated scheduled event arrived while
  the foundation observer was waiting and terminated the listener before the
  one-minute foundation candidate signal could occur.

## Correction and prevention

Keep the bounded terminal metadata margin in both the observer resolver and
controller, and have the safe-tail listener ignore valid terminal evidence from
other scheduled families. It still fails closed when the expected family's
marker is malformed or its evidence fails validation. The regression stream
must include a normal maintenance terminal before the foundation signal.
Keep the listener and candidate workflow independently bounded; do not bypass
the remote-tip guard.

## Next step

Run the local safe-tail, controller, contract, worker, and documentation suites,
then commit and push the listener repair before another monitored live attempt.

## Recurrence

- 2026-08-11T00:29:47.553Z: The next canonical retry reached exactly one
  `workflow_dispatch` observer for the reviewed commit and the foundation
  listener was active, but the controller still returned `failed_closed`
  before `observer_ready`. A later read-only metadata check showed the run and
  listener still active; no candidate, rollback, or provider mutation ran.
  The 30-second terminal margin was not sufficient for this live metadata
  settlement. The margin is being widened in a bounded follow-up repair.

- 2026-08-11T00:48:13.125Z: The next fresh retry reached and correlated the
  correct observer, but resolver metadata failed immediately before
  `observer_ready`. A captured read-only probe reproduced Node's
  `ERR_OUT_OF_RANGE` because the child-process timeout received a fractional
  millisecond value derived from `performance.now()`. No candidate, rollback,
  or provider mutation ran. The fix is to round that bounded timeout before
  invoking the child process.
- 2026-08-11T00:52:19.679Z: The new regression test reproduced the same
  fractional-timeout `ERR_OUT_OF_RANGE` under the old implementation. This was
  an intentional RED test only; no application, candidate, or provider state
  changed.
- 2026-08-11T01:11:41.136Z: With the timeout-rounding fix deployed locally, a
  fresh retry reached the reviewed observer and its foundation listener was
  active, but the controller still returned `failed_closed` before
  `observer_ready`. No candidate, rollback, or provider mutation ran. A
  read-only resolver probe is being used to separate transient live metadata
  timing from another controller boundary issue.
- 2026-08-11T01:18:00Z: A bounded source search command was malformed and
  failed before reading project files. No application, candidate, provider,
  secret, database, or calendar state changed. The search is being rerun with
  an explicit result collection rather than an empty PowerShell pipeline.
- 2026-08-11T01:20:00Z: A second read-only search used an invalid regular
  expression and failed before reading the installed Wrangler bundle. No
  application, candidate, provider, secret, database, or calendar state
  changed. Subsequent searches use one literal term at a time.
- 2026-08-11T01:21:00Z: A file-inspection call used a nonexistent local tool
  wrapper and failed before reading the installed Wrangler bundle. No
  application, candidate, provider, secret, database, or calendar state
  changed.
- 2026-08-11T01:24:00Z: A bounded error-category formatter used PowerShell's
  `-join` operator in the wrong pipeline position and failed after the
  provider log had already been reduced to memory. No raw log line was
  printed and no application, candidate, provider, secret, database, or
  calendar state changed.
- 2026-08-11T01:31:00Z: The new unit regression intentionally reproduced the
  live failure: a valid unrelated calendar-maintenance terminal caused the
  foundation signal observer to exit before the expected foundation signal.
  This was the TDD RED step; no deployment or provider state changed.
- 2026-08-11T01:41:00Z: The documentation coverage gate rejected the listener
  repair because its two new helper functions lacked the repository's required
  simple and technical reference headings. No application, candidate,
  provider, secret, database, or calendar state changed.
- 2026-08-11T01:42:00Z: The first commit attempt was blocked by Windows
  permission on the linked worktree Git index lock. No files were staged, no
  commit was created, and no application, candidate, provider, secret,
  database, or calendar state changed. The bounded retry will use the normal
  Git worktree outside the restricted sandbox.
- 2026-08-11T01:43:00Z: A candidate-worktree status check hit Git's dubious
  ownership guard under the restricted sandbox identity. No global Git
  configuration was changed and no candidate or provider state changed; the
  next check uses a per-command safe-directory allowance.

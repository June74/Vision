# SB-20260811-161958-disposable-worktree-scan

- Incident ID: `SB-20260811-161958-disposable-worktree-scan`
- First observed: `2026-08-11T16:19:58Z`
- Last observed: `2026-08-13T00:32:26Z`
- Status: `contained`
- Phase/task: Phase B restore-drill preparation
- Environment: Windows PowerShell, Phase B linked worktree
- Version/commit: `b093904`

## Symptom

A broad recursive scan of disposable Superpowers worktrees encountered broken
`node_modules` junctions and emitted path-read errors before it could locate
the requested controller files. A follow-up attempt also assumed a tracked
`scripts/new_setback.py` helper that is not present in this checkout.

## Impact

The scan produced no restore evidence and made no file, database, provider,
secret, key, calendar, or deployment change.

## Cause classification

- **Confirmed cause:** disposable worktrees contain stale dependency paths that
  are not safe for an unbounded recursive PowerShell scan.
- **Confirmed cause:** this checkout does not contain the assumed
  `scripts/new_setback.py` helper; the setback was therefore recorded by
  updating the existing incident directly.
- **Rejected hypotheses:** the restore helper or Neon branch was not changed by
  this read-only failure.

## Correction and prevention

Use known exact paths and bounded file reads; never recurse through disposable
worktree dependency trees when a tracked path is already known. Confirm helper
existence before invoking a repository script and update the existing incident
when the same scan failure recurs.

## Recurrence

- `2026-08-11T21:11:31Z`: targeted plan inspection was preceded by an
  unbounded `Get-ChildItem -Recurse` over the disposable worktree; the command
  stopped on a missing dependency path. The attempted setback helper read then
  stopped because `scripts/new_setback.py` is absent. No external action ran.
- `2026-08-12T18:56:34.344Z`: a bounded read of the ignored local task-state
  paths attempted to open two directory-backed control entries as files and
  was denied by Windows. No external action or state change occurred; inspect
  these entries as directories and use only the known input JSON file.
- `2026-08-13T00:32:26Z`: a direct read of the assumed
  `scripts/new_setback.py` path confirmed that the helper is absent from this
  checkout. No external action or state change occurred; update the existing
  incident directly when the helper is unavailable.

## Next step

Continue restore preparation from the tracked workflow and documented secure
connection-string boundary, without printing or requesting secrets in chat.

## Verification

No external command or provider request was started by either failed local
inspection.

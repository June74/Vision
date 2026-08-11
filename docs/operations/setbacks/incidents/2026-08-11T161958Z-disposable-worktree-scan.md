# SB-20260811-161958-disposable-worktree-scan

- Incident ID: `SB-20260811-161958-disposable-worktree-scan`
- First observed: `2026-08-11T16:19:58Z`
- Last observed: `2026-08-11T16:19:58Z`
- Status: `contained`
- Phase/task: Phase B restore-drill preparation
- Environment: Windows PowerShell, Phase B linked worktree
- Version/commit: `b093904`

## Symptom

A broad recursive scan of disposable Superpowers worktrees encountered broken
`node_modules` junctions and emitted many path-read errors before it could
locate a restore helper.

## Impact

The scan produced no restore evidence and made no file, database, provider,
secret, key, calendar, or deployment change.

## Cause classification

- **Confirmed cause:** disposable worktrees contain stale dependency paths that
  are not safe for an unbounded recursive PowerShell scan.
- **Rejected hypotheses:** the restore helper or Neon branch was not changed by
  this read-only failure.

## Correction and prevention

Use known exact paths and bounded file reads; never recurse through disposable
worktree dependency trees when a tracked path is already known.

## Next step

Continue restore preparation from the tracked workflow and documented secure
connection-string boundary, without printing or requesting secrets in chat.

## Verification

No external command or provider request was started by the failed scan.

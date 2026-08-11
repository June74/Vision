# SB-20260811-171803-superpowers-frozen-search

- Incident ID: `SB-20260811-171803-superpowers-frozen-search`
- First observed: `2026-08-11T17:18:03Z`
- Last observed: `2026-08-11T17:18:03Z`
- Status: `contained`
- Phase/task: Phase B acceptance workflow preparation
- Environment: Windows PowerShell, phase-b-foundation linked worktree
- Version/commit: `636772e`

## Symptom

A broad search across the ignored `.superpowers\\sdd` directory attempted to
read protected frozen-worktree entries and returned multiple access-denied
errors before the search could complete.

## Impact

No source, secret, database, calendar, deployment, or provider state changed.
The search produced no acceptance evidence.

## Cause classification

- **Confirmed cause:** disposable/frozen worktree entries in `.superpowers\\sdd`
  are not safe to enumerate with a wildcard search.
- **Rejected hypotheses:** this was not a workflow, Cloudflare, GitHub, or
  Neon failure.

## Correction and prevention

Use exact tracked paths and bounded reads only. Do not wildcard-scan the
`.superpowers\\sdd` directory or its disposable entries.

## Next step

Continue from the tracked workflow and controller source files without reading
protected disposable artifacts.

## Verification

The command failed during local file discovery and performed no external
operation.

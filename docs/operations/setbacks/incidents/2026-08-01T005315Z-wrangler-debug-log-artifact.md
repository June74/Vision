# Setback SB-20260801-005315-wrangler-debug-log-artifact

- **Status:** closed
- **Detected:** 2026-08-01T00:53:15.9466198Z
- **Scope:** Phase B Gate 0 local verification

## What happened

Gate 0 status inspection found a 396-byte untracked `debug.log` created during
the local verification window. Its contents were not read because debug logs
can contain protected operational context.

## Impact

The untracked file would have made the candidate worktree unclean. It was not
tracked, staged, or shared, and no external state changed.

## Cause classification

- **Confirmed cause:** A local verification tool emitted an untracked debug
  artifact during the Gate 0 run.
- **Hypothesis:** Wrangler emitted the artifact while its preferred user-level
  log location was unavailable.
- **Known exclusion:** The artifact existed only as an untracked local file.

## Correction and prevention

- **Correction:** Delete only the exact verified untracked `debug.log` path
  without reading it.
- **Prevention:** Check status after every Wrangler-backed verification phase
  and reject debug artifacts from candidate evidence.
- **Owner:** Codex.
- **Verification:** The exact path is absent after deletion and remains absent
  before candidate staging.

## Recurrence history

- 2026-08-01T01:30:00.6866222Z: Recurred after the post-repair explicit
  preview/production build matrix. Safe metadata showed one 792-byte untracked
  file created during that verification window. Its contents were not read;
  the exact generated path was deleted and absence rechecked.

# SB-20260727-013115-guessed-worker-entry-path: Worker entry path was guessed

- **Status:** closed
- **First observed:** 2026-07-27T01:31:15Z
- **Last observed:** 2026-07-27T01:31:15Z
- **Phase/task:** Phase B unchanged-key restore design
- **Environment:** Local worktree
- **Version/commit:** `a433912`

## Symptom

A read-only discovery command probed nonexistent `src/worker` paths and ended
nonzero.

## Impact

No source or provider state changed.

## Cause classification

- **Confirmed cause:** The Worker entry location was inferred instead of
  discovered.
- **Known exclusions:** The scheduled-job implementation exists under the
  repository's jobs module.

## Correction and prevention

- **Correction:** Discover the live scheduled path by content search before
  reading or changing it.
- **Prevention:** Trace runtime entry points from actual imports and handlers,
  not directory names.

## Verification and related work

Repository discovery found `src/jobs/scheduled.ts`.


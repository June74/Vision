# SB-20260727-193621-incident-filename-z-omitted: Historical incident filename omitted its timestamp Z

- **Status:** closed
- **First observed:** 2026-07-27T19:36:21Z
- **Last observed:** 2026-07-28T22:38:36.2933763Z
- **Phase/task:** Phase B acceptance instrumentation Task 1 full gate
- **Environment:** Local Phase B worktree
- **Version/commit:** `9bbc4be`

## Symptom

A read-only attempt to open the known full-check timeout incident omitted the
literal `Z` in its timestamped filename and returned path-not-found.

## Impact

No file or provider state changed. The historical recurrence update was briefly
delayed.

## Cause classification

- **Confirmed cause:** The path was reconstructed from the incident ID instead
  of copied from the index, and the filename's `Z` suffix was omitted.
- **Known exclusions:** The actual indexed incident file remained intact.

## Correction and prevention

- **Correction:** Resolve the exact filename from the setback index or directory
  before opening it.
- **Prevention:** Copy indexed paths verbatim; do not infer timestamped
  filenames from display IDs.

## Verification and related work

The exact indexed file was found and read successfully, and the recurrence was
recorded there.

## Recurrence history

- 2026-07-28T19:03:00.1892549Z: Recurred when the known Wrangler-log incident
  path was typed without the index row's literal `Z`. The indexed path was
  then copied verbatim and read successfully. No implementation, runtime,
  provider, or private state changed.
- 2026-07-28T22:38:36.2933763Z: Recurred in the opposite direction when the
  helper-absence incident path was reconstructed with a `Z` not present in its
  historical filename. The exact directory entry was then copied and read;
  no implementation, provider, or private state changed.

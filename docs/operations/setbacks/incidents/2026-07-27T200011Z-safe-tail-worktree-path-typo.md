# SB-20260727-200011-safe-tail-worktree-path-typo: Safe-tail status check used a mistyped worktree path

- **Status:** closed
- **First observed:** 2026-07-27T20:00:11Z
- **Last observed:** 2026-07-27T20:00:11Z
- **Phase/task:** Phase B restore Task 4 safe-tail
- **Environment:** Local Windows worktree
- **Version/commit:** `b9ec10c`

## Symptom

One read-only safe-tail status call used a worktree path with a mistyped user
directory segment and failed locally with an invalid-directory error.

## Impact

The command never reached GitHub. The already running safe-tail workflow was
unaffected and continued observing the deployed Worker.

## Cause classification

- **Confirmed cause:** A single-character manual path transcription error.
- **Known exclusions:** No provider or repository state changed.

## Correction and prevention

- **Correction:** Reuse the exact canonical worktree path from prior successful
  calls.
- **Prevention:** Copy the established workdir verbatim for repeated monitoring
  calls.

## Verification and related work

The next status check uses the canonical worktree path.

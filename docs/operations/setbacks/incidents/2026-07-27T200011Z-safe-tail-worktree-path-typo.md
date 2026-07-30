# SB-20260727-200011-safe-tail-worktree-path-typo: Safe-tail status check used a mistyped worktree path

- **Status:** closed
- **First observed:** 2026-07-27T20:00:11Z
- **Last observed:** 2026-07-30T19:54:17.6284485Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 2
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

## Recurrence history

- 2026-07-29T22:58:24.0691484Z: A focused candidate-deadline test call
  mistyped one character in the established worktree path, so process creation
  failed before the test started. No file, repository, or external state
  changed; the retry copies the canonical path verbatim.
- 2026-07-30T19:54:17.6284485Z: A bounded Task 7 brief read used a mistyped
  worktree path, so process creation failed before execution. No file,
  repository, private-data, provider, or external state changed. The agent
  completed its brief only from already captured safe evidence.

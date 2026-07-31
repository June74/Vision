# SB-20260727-200011-safe-tail-worktree-path-typo: Safe-tail status check used a mistyped worktree path

- **Status:** closed
- **First observed:** 2026-07-27T20:00:11Z
- **Last observed:** 2026-07-31T14:05:00.9419278Z
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
- 2026-07-30T20:42:22.4939631Z: A Task 3 restore pre-audit treated the linked
  worktree name from an unlabeled listing as a repository-root child. The
  filename-only read failed with path-not-found before any closure document,
  source, or private value was read; no state changed. The optional audit was
  not retried.
- 2026-07-31T01:58:45.9187356Z: The isolated Task 3 controller writer
  mistyped one character in its assigned worktree path during a read-only
  symbol inspection. The process failed before execution, printed no protected
  value, and changed no state. All later calls reuse the exact assigned path
  verbatim.
- 2026-07-31T02:16:55.6984524Z: The isolated Task 3 restore writer supplied a
  nonexistent shortened worktree path for a bounded diagnostic. Process
  creation failed before execution and emitted no data. Further diagnosis must
  copy the exact canonical assigned worktree path verbatim.
- 2026-07-31T04:12:39.9400042Z: A finite controller failure classifier omitted
  one character from the canonical user-directory segment, so process creation
  failed before execution. No file, repository, provider, private-data, or
  external state changed. The exact verified controller worktree path is copied
  verbatim for the replacement.
- 2026-07-31T04:16:54.4324095Z: The same one-character omission recurred in a
  read-only rollback-fixture symbol check. Process creation failed before
  execution and changed no state. All subsequent controller calls must copy the
  canonical worktree path directly from the last successful call.
- 2026-07-31T04:20:06.3651997Z: Closed after all replacement controller
  verification calls used the canonical path and completed successfully.
- 2026-07-31T05:56:10.7406518Z: Reopened as contained after the resolver
  writer mistyped the working directory for a bounded RED-classification
  command. The process did not start; four boundary tests remain green and
  three full-list tests retain valid RED collection. No source state was lost
  and no provider or external state changed.
- 2026-07-31T14:05:00.9419278Z: Closed after all replacement resolver
  verification used the exact canonical worktree and completed successfully.

# SB-20260727-205420-guessed-source-search-path: Source search included a nonexistent path

- **Status:** closed
- **First observed:** 2026-07-27T20:54:20Z
- **Last observed:** 2026-07-28T23:00:48.3221588Z
- **Phase/task:** Phase B acceptance instrumentation Task 4 implementation
- **Environment:** Local Phase B worktree
- **Version/commit:** `d27859e`

## Symptom

A read-only content search included the guessed `src/db` directory. PowerShell
reported that the path does not exist while continuing to read the valid,
explicitly listed paths.

## Impact

The search output was noisy and the intended backup-table discovery was
incomplete. No source file, Git state, secret, database, Worker, or provider
state changed.

## Cause classification

- **Confirmed cause:** A source directory was inferred instead of first being
  discovered from the repository tree.
- **Known exclusions:** The valid scheduled-job and environment files were
  read successfully.

## Correction and prevention

- **Correction:** Enumerate existing source files before applying the targeted
  content search.
- **Prevention:** Use only paths returned by repository discovery; do not add
  conventional directory names from memory.

## Verification and related work

Closure is immediate because the failed operation was read-only. Planning
continues using discovered files only.

## Recurrence history

- 2026-07-27T20:54:20Z: First observed and closed after repository discovery.
- 2026-07-28T00:12:55.4064136Z: Recurred when a read-only attestation search
  assumed a conventional `drizzle` migration directory that does not exist in
  this worktree. The search stopped without changing any file or provider
  state. Migration SQL is discovered from the repository file list before the
  search is retried.
- 2026-07-28T02:03:41.8573195Z: Recurred when a read-only inspection inferred
  a temporary clear job filename from the existing adapter name. The other
  requested files were read, no source or provider state changed, and further
  inspection is limited to paths proven by imports or file discovery.
- 2026-07-28T02:36:34.6558608Z: Recurred during independent review when one
  read-only search included a conventional configuration path that does not
  exist and a later discovery search entered dependency directories. Both
  searches were contained without mutation. The reviewer completed tracing
  from the tracked-file inventory and approved the exact staged implementation.
- 2026-07-28T16:05:00Z: Recurred when a read-only planning command guessed
  `0009_ai_usage_diagnostics.sql` after the migration inventory had already
  shown the actual `0009_ai_usage_budget.sql` filename. No file or external
  state changed. The correct file was then read from the discovered inventory;
  future compound inspection commands must be assembled only from captured
  inventory names.
- 2026-07-28T20:23:38.9800016Z: Recurred when a read-only privilege search
  guessed a `drizzle` directory even though tracked migrations live under
  `migrations/`. No file or external state changed. The tracked-file inventory
  then confirmed the exact migration paths before retrying.
- 2026-07-28T20:25:01.9701018Z: Recurred in the same context investigation
  when a read-only event-source search guessed an outdated `src/domain/calendar`
  directory. No file or external state changed. `git ls-files` then supplied
  the exact current event and Google Calendar paths.
- 2026-07-28T23:00:48.3221588Z: Recurred when a compound read-only inspection
  guessed two obsolete reference paths and then recursively searched dependency
  directories while looking for a helper. No file or external state changed.
  Subsequent inspection uses the tracked-file inventory and explicit paths only.

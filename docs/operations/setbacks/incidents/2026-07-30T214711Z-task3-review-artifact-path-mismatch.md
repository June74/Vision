# SB-20260730-214711-task3-review-artifact-path-mismatch: Task 3 repair used guessed artifact paths

- **Status:** closed
- **First observed:** 2026-07-30T21:47:11.724380Z
- **Last observed:** 2026-07-31T02:02:33.7188545Z
- **Phase/task:** Phase B live-acceptance closure Task 3 repair
- **Environment:** Local Phase B worktree
- **Version/commit:** `38bed3e991d5bfb40b1452bd955634e30247c045`;
  `2bfbc23f13c44e60b01bbffcecc9748d322765b5`

## Symptom

A read-only authority check requested nonexistent Task 3 artifact paths before
the exact supplied paths were used.

## Impact

The check returned path-not-found and briefly delayed repair; no file, protected value, provider, or external state was affected.

## Reproduction conditions

Request review artifacts using guessed generic names instead of the actual
Task 3 artifact names already present in the exact-path brief.

## Safe evidence

The shell returned only path-not-found categories. It did not read a provider,
network, environment, protected value, or repository content.

## Attempts and outcomes

- The guessed paths failed read-only.
- The implementer identified the correct artifact names and resumed from those
  exact paths.

## Cause classification

- **Confirmed cause:** The authority check inferred artifact names instead of
  using the exact supplied paths.
- **Hypotheses:** None.
- **Rejected hypotheses:** The review artifacts were not missing.
- **Known exclusions:** No mutation, protected value, provider, network, or
  external state was involved.

## Correction and prevention

- **Correction:** Use only the exact artifact paths supplied in the task brief.
- **Prevention:** Do not infer review-package or source-module filenames. When
  a source path is not explicitly supplied, discover the tracked path from
  bounded Git metadata or a symbol-only search before reading it.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The correct Task 3 artifacts were opened successfully by exact path.

## Recurrence history

- 2026-07-30T21:47:11.724380Z: First observed.
- 2026-07-30T21:51:26.1543725Z: Recurred when the repair guessed a plan
  filename even though the frozen plan's exact repository path was supplied.
  The read returned only path-not-found, changed no state, and was replaced by
  the supplied exact path without directory discovery.
- 2026-07-30T21:53:59.1866247Z: Recurred when the disjoint restore audit
  guessed a backup-store adapter path while mapping composition. The read
  returned only path-not-found, changed no state, and the lane was redirected
  to the exact imports already present in the production restore adapter.
- 2026-07-30T23:47:10.3663822Z: Recurred when the final-repair gate lookup
  included a nonexistent documentation-plan glob while the exact brief and
  frozen plan paths were already known. The read returned the known gate text
  before exiting nonzero, changed no state, and the retry was restricted to
  exact existing paths.
- 2026-07-31T01:31:53.8631356Z: Recurred when the decisive-repair writer
  inferred a context-module filename that is not tracked. The read returned
  only the path-not-found category plus an independently requested existing
  source, changed no state, and the writer was redirected to discover the
  symbol's tracked path before reading.
- 2026-07-31T02:02:33.7188545Z: The isolated controller writer inferred a
  context-module source location from an import basename instead of resolving
  the import first. The bounded read returned only the missing local path
  category, changed no state, and the lane was restricted to already-known
  operation symbols with no further path inference.

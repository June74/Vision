# SB-20260731-174919-git-worktree-index-permission: Sandbox blocked the worktree Git index

- **Status:** closed
- **First observed:** 2026-07-31T17:49:19.1079389Z
- **Last observed:** 2026-08-10T23:27:27Z
- **Phase/task:** Phase B reconnect-recovery Tasks 1-2 exact staging
- **Environment:** Local Git worktree
- **Version/commit:** `94b8810` plus five verified Task 1 paths

## Symptom

The exact two-file setback commit could not create the linked worktree's
`index.lock` because the repository metadata directory is read-only inside the
workspace sandbox.

## Impact

No path was staged or committed. Project code, provider state, network state,
environment values, and secrets were unaffected.

## Cause classification

- **Confirmed cause:** The worktree's Git metadata is stored under the parent
  repository `.git/worktrees` directory, which requires approved write access.
- **Hypotheses:** None remaining.
- **Known exclusions:** This was not a merge conflict, stale lock, or content
  validation failure.

## Correction and prevention

- **Correction:** Retry the identical bounded Git operation with repository
  metadata write authority.
- **Prevention:** Use the established approved Git path for commits from this
  linked worktree.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Recurrence history

- 2026-07-31T17:49:19.1079389Z: Observed and contained before staging.
- 2026-07-31T21:53:19.8105626Z: Recurred when Task 4 ledger staging tried to
  create the linked-worktree index lock inside shared repository metadata.
  Nothing was staged; retry requires the established bounded metadata-write
  approval.
- 2026-07-31T21:54:05.3420661Z: Closed after the approved bounded retry staged
  only the setback index and incident directory and the cached diff audit
  completed without an error.
- 2026-07-31T21:04:30.3155673-05:00: Recurred while staging the Task 7
  continuation ledger paths. The sandbox again denied linked-worktree
  `index.lock` creation before any path staged; the retry uses the established
  bounded metadata-write approval for the exact ledger path set.
- 2026-08-02T06:08:55.3181828Z: Recurred while staging only the owner-approved
  Task 8 reconnect design specification. The sandbox denied index-lock creation
  before any path staged; source, operational records, and external state were
  unchanged. The retry remains bounded to the exact specification path.
- 2026-08-02T17:23:08.8340353Z: Recurred while staging the five verified Task 1
  repository paths. The sandbox denied linked-worktree index-lock creation
  before any path was staged; ledger and credential changes remain unstaged.
- 2026-08-02T17:23:43.7389318Z: Closed after the approved retry staged exactly
  the five Task 1 paths and the cached path/whitespace audit passed; ledger and
  credential changes remained unstaged.
- 2026-08-02T18:34:50.2999657Z: Recurred while staging only the Task 2
  PostgreSQL concurrency proof. The sandbox denied linked-worktree index-lock
  creation before any path was staged; credential, setback, debug, report,
  provider, network, database, and secret state remained outside staging. The
  retry remains bounded to the exact Task 2 test path.
- 2026-08-10T23:27:27Z: Recurred while staging the audited documentation-only
  freeze. The sandbox denied linked-worktree `index.lock` creation before any
  path staged; no source, provider, or external state changed. The retry is
  bounded to `docs/` through the approved metadata-write path.
- 2026-08-12T20:02:55.363Z: Recurred while staging the timestamp-normalization
  fix and its verification ledger. The sandbox denied linked-worktree
  `index.lock` creation before any path staged; no source, provider, or external
  state changed. Retry only with the established bounded metadata-write path.
- 2026-08-12T20:32:07.174Z: Recurred while staging the baseline-admission
  workflow fix and its verification records. The sandbox denied linked-worktree
  `index.lock` creation before any path staged; no source, provider, or external
  state changed. Retry only with the established bounded metadata-write path.

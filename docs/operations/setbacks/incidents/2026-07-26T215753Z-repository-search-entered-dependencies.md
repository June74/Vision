# SB-20260726-215753-repository-search-entered-dependencies: Repository search entered dependencies

- **Status:** closed
- **First observed:** 2026-07-26T21:57:53Z
- **Last observed:** 2026-07-28T00:13:27.8191132Z
- **Phase/task:** Listener-first restore retry clear-job design
- **Environment:** Local PowerShell worktree
- **Version/commit:** `6a14659`

## Symptom

A recursive PowerShell text search entered generated output and `node_modules`,
timed out, and emitted missing-path warnings from dependency links.

## Impact

No project or external state changed. Migration history discovery was delayed
briefly; the live schema verification had already passed.

## Reproduction conditions

Run an unrestricted recursive file enumeration from the worktree root and pipe
every file into `Select-String`.

## Safe evidence

The command timed out after about ten seconds after entering `dist` and
dependency directories.

## Attempts and outcomes

- The unrestricted search failed noisily and was stopped by its timeout.
- The replacement is a source-only search that excludes dependencies and
  generated output.

## Cause classification

- **Confirmed cause:** The search scope was broader than the source scope.
- **Rejected hypotheses:** None.
- **Known exclusions:** No files, database records, or provider resources were
  changed.

## Correction and prevention

- **Correction:** Restrict repository searches to known source, migration, test,
  and documentation paths.
- **Prevention:** Never use an unrestricted recursive `Select-String` from a
  JavaScript worktree root.
- **Owner:** Codex.

## Verification and related work

Closed because the cause is deterministic and the replacement search is
bounded.

## Recurrence history

- 2026-07-26T21:57:53Z: First occurrence.
- 2026-07-28T00:12Z: A read-only design-review search again entered
  `node_modules` and timed out before the reviewer narrowed it to the exact
  known declaration path. No private output or state change occurred.
- 2026-07-28T00:13:27.8191132Z: The controller then used an unrestricted
  recursive file enumeration while discovering migration SQL. It completed
  quickly but crossed the local Wrangler state directory, violating the
  established bounded-search rule. The discovered repository migration path is
  now used explicitly; no file or provider state changed.

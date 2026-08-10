# SB-20260731-195639-task4-assumed-source-helper-paths: Task 4 review assumed two repository paths

- **Status:** closed
- **First observed:** 2026-07-31T19:56:39.6673787Z
- **Last observed:** 2026-08-03T22:40:57.7464711Z
- **Phase/task:** Phase B Task 8 reconnect-recovery design audit
- **Environment:** Shared local worktree; read-only source discovery
- **Version/commit:** 2cf0ff1 with concurrent Task 4 work

## Symptom

A bounded source search named a schema file that does not exist, then the
setback-helper lookup assumed a repository-local helper path that also does not
exist. Both commands exited before the intended reads.

## Impact

The aggregate data-contract review paused briefly. No application, database,
provider, workflow, environment, or Git state changed.

## Reproduction conditions

Run a literal read or search against the two unverified assumed paths.

## Safe evidence

Only missing-path categories and repository-relative paths were observed. No
secret, URI, user data, database value, row, request identity, or provider
identifier was read or emitted.

## Attempts and outcomes

- The initial multi-file search stopped because one literal path was absent.
- The follow-up helper read also stopped because its assumed path was absent.
- A bounded directory inventory confirmed the schema is a directory and that
  the setback folder contains only the index and incident directory.

## Cause classification

- **Confirmed cause:** The review used unverified guessed repository paths.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** Source checkout corruption and missing Task 4 files;
  the relevant data source and tests are present.
- **Known exclusions:** No code, test, provider, database, workflow, environment,
  credential, or Git mutation occurred.

## Correction and prevention

- **Correction:** Inventory exact directories first, then read only discovered
  schema, repository, and incident-helper paths.
- **Prevention:** Never mix one unverified literal into a multi-file read, and
  do not assume the generic skill helper path exists in every repository.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

The corrected directory-first discovery found the exact schema and repository
files, and the bounded lifecycle search completed successfully.

## Recurrence history

- 2026-07-31T19:56:39.6673787Z: First observed and contained with zero project
  or external-state mutation.
- 2026-07-31T19:57:28.4118144Z: Closed after exact-path discovery and the
  corrected lifecycle search both exited zero.
- 2026-07-31T20:34:52.3009197Z: Recurrence during the independent Task 4
  workflow/window review: a multi-file search again included an unverified
  reference path, and a follow-up inventory repeated the same assumption about
  the absent top-level reference directory. Both failed read-only with no
  project or external-state mutation. Root inventory then located the Task 4
  contract documents under `.superpowers/sdd`, verifying the correction and
  closing the recurrence.
- 2026-07-31T20:37:33.0433720Z: Recurred when the workflow/window repair
  assumed a deploy-config test filename before inventorying the script-test
  directory. The read-only search stopped with no source or external change;
  correction is to enumerate the exact test paths before focused inspection.
- 2026-07-31T20:44:09.0860921Z: Recurred when the skill's generic helper path
  was invoked even though this repository has already recorded that it is
  absent. The command made no project or external change; the existing ledger
  entries are updated directly through the approved patch tool.
- 2026-07-31T20:50:37.5421139Z: Closed after exact discovered test and
  reference paths completed all remaining checks.
- 2026-07-31T20:55:20.4941934Z: Recurred when the half-open-boundary repair
  inferred the incident filename from its title instead of copying the exact
  indexed link. The failed read made no source or external change; correction
  is to use the indexed incident path verbatim.
- 2026-07-31T20:55:54.7054190Z: Closed after the exact indexed incident read
  completed successfully.
- 2026-07-31T21:19:36.3552815Z: Recurred when full-check diagnosis assumed a
  cleanup helper under `scripts/` even though the exact cleanup contract lives
  in the security test. The multi-path read stopped after returning the valid
  test excerpt; no implementation or external state changed. The corrected
  inspection now uses only the discovered test path.
- 2026-07-31T21:24:11.7436114Z: Recurred when a wildcard path was passed to
  PowerShell's literal-path parameter during timeout configuration discovery.
  The command returned the needed exact describe locations before failing and
  changed no project or external state. The corrected search uses explicit
  discovered config paths only.
- 2026-07-31T22:02:04.0732670Z: Recurred when a Task 5 progress probe treated
  the not-yet-created browser-helper path as an ordinary file read. The status
  portion was valid and no state changed; optional in-progress artifacts are
  now probed with `Test-Path`.
- 2026-07-31T22:03:21.6722225Z: Recurred when the Task 5 scheduled-evidence
  trace included a guessed root `worker.ts`. The path does not exist and the
  read-only command exited before a usable trace; the lane now enumerates
  actual source files before tracing.
- 2026-07-31T23:00:26.6440980Z: Recurred when the Task 6 cleanup lane assumed
  the setback skill's optional `scripts/new_setback.py` helper existed in this
  repository. The read-only command changed nothing; the incident is created
  manually under the required ledger path instead.
- 2026-08-02T05:16:03.3342303Z: Recurred during Task 8 owner-authentication
  render-state inspection when a multi-file read included one guessed optional
  client filename. The two discovered relevant files were read, but the
  missing optional path made the command exit nonzero. No provider, browser,
  deployment, credential, key, or application state changed; subsequent reads
  use only inventoried paths.
- 2026-08-02T05:41:08.8049896Z: Recurred when the reconnect-recovery schema
  audit guessed a calendar schema filename even though the schema is split
  across inventoried files. The command stopped read-only after Git status; no
  source or external state changed. Directory-first discovery identified the
  exact schema files before the audit resumed.
- 2026-08-02T05:43:28.6846165Z: Recurred when migration discovery guessed a
  conventional directory name instead of using the root inventory. The
  read-only command stopped immediately, and the root inventory identified the
  actual migration directory. No application or external state changed.
- 2026-08-02T05:53:57.5283113Z: Recurred when a Task 8 live-reconciliation
  query preflight included two guessed schema filenames. The read-only search
  stopped before database interaction; no source or external state changed,
  and the controller returned to directory-first discovery.
- 2026-08-03T21:25:23.6971358Z: Recurred when a bounded Wrangler source scan
  used the package root for `cli.js` after an earlier two-directory listing had
  shown it under `wrangler-dist`. Resolution failed and caused local null-reader
  errors only. The verified bundle path then completed the scan; no provider or
  source state changed.
- 2026-08-03T21:39:36.4134641Z: Recurred when a config inventory combined the
  verified root `wrangler.jsonc` read with a guessed `apps` directory. The root
  file was found, but the overall read exited nonzero at the nonexistent path.
  Subsequent inspection used only the verified root config; no external or
  source state changed.
- 2026-08-03T21:59:58.2738957Z: Recurred when the final ledger verification
  used incident filenames without the indexed `incidents/` directory. The
  read-only lookup failed for one path before directory-first discovery found
  the exact indexed files. No application or external state changed.
- 2026-08-03T22:40:57.7464711Z: Final ledger validation found that the closed
  incident retained a stale diagnostic step from its first observation. The
  metadata was corrected to `None`; no application or external state changed.

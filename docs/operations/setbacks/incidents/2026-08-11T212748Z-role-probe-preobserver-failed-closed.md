# SB-20260811-212748-role-probe-preobserver-failed-closed

- Incident ID: `SB-20260811-212748-role-probe-preobserver-failed-closed`
- First observed: `2026-08-11T21:27:48Z`
- Last observed: `2026-08-11T22:41:00Z`
- Status: `contained`
- Phase/task: Phase B monitored role-probe acceptance after correlation-wait repair
- Environment: Windows PowerShell, pushed reviewed branch
- Version/commit: `1a9881ce0bf50435af3cd4ef7ace7dcd60c2382a`

## Symptom

One fresh monitored role-probe controller invocation emitted only the safe
status `failed_closed` and exited nonzero after roughly two seconds. It did
not emit `observer_ready`.

## Impact

The attempt was stopped before a verified observer or candidate deployment
receipt. No deployment, rollback, database, secret, key, calendar, or
application state change was authorized by this run.

## Cause classification

- **Confirmed cause:** the retry set `XDG_CONFIG_HOME` to a fresh empty folder,
  so GitHub CLI could not see the normal saved login; its dispatch call failed
  before a workflow run was created.
- **Confirmed second cause:** the corrected no-XDG retry dispatched a valid
  observer, but the resolver's final five-second sleep crossed its internal
  120-second stable-listener close by a small amount and failed before the
  terminal metadata poll. The active listener topology and run attribution
  were valid; no candidate mapping or candidate-intent artifact exists.
- **Contributing diagnostic issue:** the first comparison wrapper was run in a
  restricted network context and a PowerShell wrapper stopped on native CLI
  stderr before collecting both sides.
- **Rejected hypotheses:** the remote tip, workflow activation, repository
  write permission, local driver self-test, input/commit agreement, and saved
  GitHub authentication all passed safe checks.
- **Correction evidence:** a focused regression failed before the correction,
  then passed after the terminal-sleep margin was applied. A live read-only
  resolver trace against the same active observer resolved successfully in
  about two minutes.
- **Rejected hypotheses:** the five-minute correlation-window regression is
  not exercised by this attempt because observer dispatch did not reach the
  ready status.

## Correction and prevention

Do not retry blindly. Inspect only safe state predicates and bounded command
exit/status evidence. Keep the resolver's internal 120-second discovery close,
but allow only its final poll sleep to use the existing bounded settlement
margin; never extend candidate, rollback, or cleanup windows. Keep all provider
responses, credentials, tokens, URLs, and private payloads out of the incident
record.

## Next diagnostic step

Commit and verify the resolver correction, clear the orphaned observer, refresh
the reviewed tip pin, and run one fresh monitored role-probe acceptance. Do not
start a candidate until `observer_ready` is observed.

## Verification

The failed controller attempt emitted no candidate-intent or deployment status.
The orphaned observer was later cancelled after the live read-only trace
verified the correction; no candidate, deployment, rollback, database, key,
secret, or calendar mutation occurred.

## Recurrence

- `2026-08-11T21:29:29Z`: a PowerShell safe-state wrapper used an empty pipe
  element while collecting pending-journal predicates. It failed before
  reading a record and before any external action; the next probe uses an
  explicit result array.
- `2026-08-11T21:31:02Z`: a read-only GitHub workflow-list probe supplied GET
  filters without explicitly setting `-X GET`, so the CLI attempted a POST and
  received a safe 404. No workflow or provider mutation occurred; subsequent
  probes specify the method explicitly.
- `2026-08-11T21:36:00Z`: a local self-test retry used a nonexistent
  `node_modules\\.bin\\node.exe` path and stopped before the self-test started;
  a PowerShell timestamp probe also used an unsupported parameter. No provider
  action occurred; subsequent local probes use the available Node launcher and
  compatible timestamp syntax.
- `2026-08-11T21:40:30Z`: the diagnostic GitHub wrapper was first tested inside
  the restricted sandbox and classified the network failure at the HTTPS
  endpoint boundary. No provider action occurred; the approved live diagnostic
  uses the normal saved authentication outside that restriction.
- `2026-08-11T21:43:47Z`: the live diagnostic proved the empty XDG override
  hid the saved GitHub CLI login (read-only call failed), while the normal
  config succeeded. No workflow run or provider mutation was created; future
  acceptance runs leave XDG_CONFIG_HOME unset unless the actual saved config is
  explicitly supplied.
- `2026-08-11T21:44:59Z`: a PowerShell cleanup-status probe used an empty pipe
  after a `foreach` statement and stopped before inspection. No files were
  removed by that failed probe; the corrected bounded cleanup removed only the
  temporary diagnostic files created by this retry.
- `2026-08-11T21:57:32Z`: the corrected no-XDG retry created one observer
  mapping, then failed closed before `observer_ready`; the observer job is still
  listening and all candidate/rollback jobs are skipped. A standalone resolver
  probe later succeeded against that run. No candidate, deployment, rollback,
  database, key, secret, or calendar mutation occurred.
- `2026-08-11T21:57:32Z`: two bounded local metadata probes initially used
  incompatible PowerShell quoting/path assumptions and stopped before their
  read-only request; corrected probes completed without provider mutation.
- `2026-08-11T22:17:00Z`: the exact observer run from the corrected retry was
  cancelled after its candidate and rollback jobs were verified skipped. The
  cancellation cleared the single-observer slot; no candidate, deployment,
  rollback, database, key, secret, or calendar mutation occurred.
- `2026-08-11T22:17:30Z`: the first attempt to commit the cleanup note was
  blocked by a permission error creating the worktree Git index lock. No
  repository content or provider state changed; the commit is retried with
  the normal repository permission boundary.
- `2026-08-11T22:18:00Z`: the escalated commit retry used a POSIX `&&`
  separator in PowerShell and stopped before Git ran. No repository or
  provider state changed; the next retry uses separate PowerShell statements.
- `2026-08-11T22:24:00Z`: the fresh no-XDG monitored retry passed preflight and
  dispatched the observer, but returned `failed_closed` before observer-ready.
  No candidate-intent, deployment, rollback, database, key, secret, or
  calendar mutation is recorded; the remaining observer boundary is under
  diagnosis and no blind retry will be made.
- `2026-08-11T22:27:00Z`: the first targeted regression command used
  `pnpm exec vitest`, but this checkout exposes the runner through its local
  Windows launcher instead. It stopped before tests ran; no repository or
  provider state changed.
- `2026-08-11T22:29:00Z`: a documentation search was pointed at a malformed
  worktree path and the process could not start. No files or provider state
  changed; the next read uses the verified worktree path.
- `2026-08-11T22:32:47Z`: a bounded read-only trace reproduced the remaining
  failure: the resolver's final five-second sleep crossed its internal
  120-second close by a small amount and rejected before the terminal metadata
  poll. The active observer topology was valid throughout. A regression test
  failed before the correction; after allowing only that final sleep to use
  the existing 60-second settlement margin, the test and a live read-only
  trace resolved the observer successfully. No candidate, deployment,
  rollback, database, key, secret, or calendar mutation occurred.
- `2026-08-11T22:34:00Z`: a local process-status probe used a restricted WMI
  query and received access denied. It did not alter processes, files, or
  provider state; test verification continues through the test runner itself.
- `2026-08-11T22:40:00Z`: after the live resolver trace verified the fix, the
  orphaned observer from the failed controller retry was cancelled and its
  completed/cancelled state was confirmed. Candidate and rollback jobs had
  remained skipped; no other provider or application state changed.
- `2026-08-11T22:41:00Z`: an attempted incident-section patch used a duplicated
  worktree path and an empty patch, so no edit was applied. No repository or
  provider state changed; the section update is retried with the verified path.
- `2026-08-11T22:43:00Z`: refreshing the ignored acceptance input initially
  wrote a 41-character reviewed-commit value instead of the 40-character
  branch tip. The mismatch was caught by a local length/equality check before
  any dispatch; no provider action occurred.
- `2026-08-11T23:00:55Z`: the final monitored retry reached `observer_ready`,
  candidate dispatch, and `rollback_dispatched`, then returned
  `failed_closed` before closure verification. Candidate and rollback mappings
  exist; the exact post-rollback boundary is under diagnosis. No blind retry
  will be made and no additional candidate will be dispatched.
- `2026-08-11T23:01:30Z`: a source search passed the `scripts` directory as a
  file path and stopped after the workflow results were collected. No files,
  provider state, or secrets were changed or exposed.
- `2026-08-11T23:03:20Z`: a local public-health request ran inside the
  restricted network context and could not connect; its follow-on parser saw
  no response. No provider state or files changed, and no private response was
  exposed.
- `2026-08-11T23:03:40Z`: an attempted log patch used an incorrect date in its
  context and applied nothing. No repository or provider state changed.
- `2026-08-11T23:05:45Z`: safe workflow inspection confirmed the candidate
  failed before mutation at `Verify live preview is normal before candidate
  deployment`; its candidate-intent artifact was therefore never created.
  Rollback then failed closed at `Verify rollback targets the latest candidate
  intent`, with no deployment or restore mutation. The public preview health
  endpoint independently returned HTTP 200/`ok`; the remaining predicate is
  the authenticated schedule/binding restore-pair check. The orphaned observer
  was cancelled and cancellation settled successfully.
- `2026-08-11T23:06:20Z`: a local `rg.exe` lookup could not launch in this
  Windows environment. No files or provider state changed; repository searches
  use the available PowerShell fallback.
- `2026-08-11T23:29:58Z`: the next monitored retry again failed at
  `Verify live preview is normal before candidate deployment` with the generic
  temporary restore-pair provider-state error. The candidate-intent artifact
  count and candidate-run matches were both zero, so no candidate mutation or
  restore mutation occurred; rollback then failed closed at its missing-intent
  guard. The observer was cancelled and settled as completed/cancelled.
- `2026-08-11T23:30:20Z`: an attempted follow-up log patch used an incorrect
  date in its context and applied nothing. No repository or provider state
  changed; the corrected entry is applied above.
- `2026-08-11T23:31:00Z`: a local PowerShell range probe used an invalid loop
  assignment and stopped before reading the incident file. No repository,
  provider, or secret state changed; the corrected read succeeded.
- `2026-08-11T23:32:00Z`: a local `rg.exe` search could not launch in this
  Windows environment. No files or provider state changed; the available
  PowerShell search was used instead.
- `2026-08-11T23:34:40Z`: a read-only Wrangler probe supplied `--env preview`
  with the already suffixed Worker name and targeted the nonexistent
  `vision-preview-preview` script. It changed no provider state; the corrected
  default-Worker probe succeeded.
- `2026-08-11T23:35:29Z`: the corrected read-only secret-name probe against the
  actual `vision-preview` Worker found twelve secrets but neither
  `PREVIEW_RESTORE_DATABASE_URL` nor `PREVIEW_RESTORE_TARGET_ID`. Only names
  and presence flags were inspected; secret values were never read or printed.
- `2026-08-11T23:36:59Z`: the first attempt to stage this ledger update was
  blocked by Windows permission on the linked worktree index lock. No files or
  provider state were lost or changed; the same stage/commit is retried with
  the required repository permission.

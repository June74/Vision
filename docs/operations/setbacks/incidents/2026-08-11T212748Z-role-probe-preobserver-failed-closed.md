# SB-20260811-212748-role-probe-preobserver-failed-closed

- Incident ID: `SB-20260811-212748-role-probe-preobserver-failed-closed`
- First observed: `2026-08-11T21:27:48Z`
- Last observed: `2026-08-11T21:27:48Z`
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
- **Latest confirmed boundary:** after removing that override, the observer
  dispatch and local mapping succeeded, but the controller still failed before
  `observer_ready`; no candidate mapping or candidate-intent artifact exists.
  The observer run remains a read-only listener.
- **Contributing diagnostic issue:** the first comparison wrapper was run in a
  restricted network context and a PowerShell wrapper stopped on native CLI
  stderr before collecting both sides.
- **Rejected hypotheses:** the remote tip, workflow activation, repository
  write permission, local driver self-test, input/commit agreement, and saved
  GitHub authentication all passed safe checks.
- **Remaining hypothesis:** the real observer-resolution boundary is too tight
  or hit a transient metadata timing failure after the observer was admitted.
  A later standalone read-only resolver against the same run succeeded and
  reported the listener still active, so no application or deployment failure
  was reached.
- **Rejected hypotheses:** the five-minute correlation-window regression is
  not exercised by this attempt because observer dispatch did not reach the
  ready status.

## Correction and prevention

Do not retry blindly. Inspect only safe state predicates and bounded command
exit/status evidence, then correct the single confirmed boundary. Keep all
provider responses, credentials, tokens, URLs, and private payloads out of the
incident record.

## Next diagnostic step

Check pending-journal and mapping counts, input/remote-tip agreement, driver
executable availability, and the controller's safe status file. If the cause
is local invocation, rerun one read-only driver self-test before another
monitored acceptance.

## Verification

The attempt emitted no candidate-intent or deployment status and was contained
before any external mutation was confirmed.

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

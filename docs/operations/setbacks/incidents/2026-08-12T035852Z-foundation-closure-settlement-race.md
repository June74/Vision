# SB-20260812-035852-foundation-closure-settlement-race

- Incident ID: `SB-20260812-035852-foundation-closure-settlement-race`
- First observed: `2026-08-12T03:58:52Z`
- Last observed: `2026-08-12T04:15:37Z`
- Status: `closed`
- Phase/task: Phase B foundation-probe monitored acceptance and rollback closure
- Environment: local acceptance controller and GitHub Actions preview workflow
- Version/commit: `584859aa9c63e3a88faac20e59a4f04a8de172dc`

## Symptom

The fresh foundation probe dispatched the observer, candidate, rollback, and
closure workflows. Candidate and rollback completed successfully. The local
controller then returned `failed_closed` while the closure workflow was still
`in_progress`; that closure workflow later completed successfully.

## Impact

The controller did not emit `closure_verified`, so its terminal status was not
usable as acceptance evidence. The provider-side rollback and closure proofs
were produced, the preview was restored, and the exact closure-chain validator
passed. No secret, database, calendar, or application data was changed.

## Cause classification

- **Confirmed cause:** the controller dispatches `close_rollback` and then
  invokes the driver `verify-closure` immediately. The driver requires both
  referenced workflow runs to already be completed successfully; it does not
  wait for the newly dispatched closure run to settle. The closure run was
  still in progress at the first check and succeeded later.
- **Rejected hypothesis:** the earlier wrong redirect-variable key was not
  involved; the corrected closure workflow completed successfully.
- **Rejected hypothesis:** candidate or rollback provider failure was not
  involved; both jobs completed successfully and the exact closure-chain
  validator passed.

## Diagnostic attempts

- Safe workflow metadata showed one observer failure from the expected
  no-signal capture boundary, one successful candidate run, one successful
  rollback run, and one closure run that was initially in progress and later
  successful.
- The repository lifecycle validator verified the candidate-intent,
  rollback-restored, and rollback-closed proof chain at the reviewed commit.
- A first standalone driver-verifier invocation used a PowerShell automatic
  variable name and exited before a valid input reached the driver; a corrected
  invocation still returned only the driver's value-free failure. No provider
  mutation occurred. The repository validator supplied the independent proof.
- The first repository docs-coverage check after the controller fix reported
  that the new `expectClosureOk` helper lacked the required simple and
  technical reference headings. No provider or workflow state changed.
- The first post-push branch-tip check passed the arguments to `git
  ls-remote` in the wrong order and therefore failed locally before reading
  the remote. The corrected read-only check is still required; no provider or
  repository state changed.

## Correction and prevention

Add a bounded rollback-settlement wait before closure verification, matching the
existing candidate and rollback settlement boundaries. Add a regression test
that keeps closure verification pending until the workflow reaches completed
success, then rerun the focused controller suite and repository checks.

## Verification

The bounded retry was implemented in the tracked controller and covered by a
regression test. The reviewed provider proof chain remains valid for commit
`584859aa9c63e3a88faac20e59a4f04a8de172dc`; no additional candidate mutation
was required after the race was diagnosed.

- Focused controller suite: 76 passed.
- Full unit suite: 1,768 passed and 6 skipped.
- Contract suite: 183 passed.
- TypeScript check, documentation coverage, and production build: passed.
- Exact candidate-intent, rollback-restored, and rollback-closed lifecycle
  validation: passed.

The local Wrangler log warning about a permissions-restricted local log file
was non-blocking and did not affect the build or provider proof.

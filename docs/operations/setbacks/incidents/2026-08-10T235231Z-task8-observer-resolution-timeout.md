# SB-20260810-235231-task8-observer-resolution-timeout

- Incident ID: `SB-20260810-235231-task8-observer-resolution-timeout`
- First observed: `2026-08-10T23:52:31Z`
- Last observed: `2026-08-11T00:48:13.125Z`
- Status: `contained`
- Phase/task: Phase B monitored candidate acceptance
- Environment: Windows PowerShell, frozen Phase B worktree
- Version/commit: `a6cd3d95`

## Symptom

The canonical-input controller run dispatched and correlated the observer
workflow at the reviewed tip, but returned `failed_closed` while the observer
resolution window was still settling.

## Impact

Read-only reconciliation showed the selection job succeeded and the
`Capture foundation_probe signal` job remained in progress with its
`Print only allowlisted acceptance evidence` listener in progress. No
candidate, rollback, closure, Cloudflare deployment, traffic, secret, key,
database, or calendar mutation ran.

## Cause classification

- **Confirmed cause:** the controller and resolver both allowed only a
  five-second terminal metadata margin beyond the resolver's 120-second
  stable-listener window. GitHub API reads and dependency startup consumed
  that margin, so the outer abort fired before observer readiness could be
  returned.
- **Rejected hypotheses:** branch-tip drift, input schema, repository selector,
  GitHub dispatch, correlation, and Cloudflare upload were not the cause.
- **Confirmed live listener cause:** the observer was configured to fail closed
  on any terminal marker, including the normal fifteen-minute
  `calendar.maintenance` signal. That unrelated scheduled event arrived while
  the foundation observer was waiting and terminated the listener before the
  one-minute foundation candidate signal could occur.

## Correction and prevention

Keep the bounded terminal metadata margin in both the observer resolver and
controller, and have the safe-tail listener ignore valid terminal evidence from
other scheduled families. It still fails closed when the expected family's
marker is malformed or its evidence fails validation. The regression stream
must include a normal maintenance terminal before the foundation signal.
Keep the listener and candidate workflow independently bounded; do not bypass
the remote-tip guard.

## Next step

Run the local safe-tail, controller, contract, worker, and documentation suites,
then commit and push the listener repair before another monitored live attempt.

## Recurrence

- 2026-08-11T00:29:47.553Z: The next canonical retry reached exactly one
  `workflow_dispatch` observer for the reviewed commit and the foundation
  listener was active, but the controller still returned `failed_closed`
  before `observer_ready`. A later read-only metadata check showed the run and
  listener still active; no candidate, rollback, or provider mutation ran.
  The 30-second terminal margin was not sufficient for this live metadata
  settlement. The margin is being widened in a bounded follow-up repair.

- 2026-08-11T00:48:13.125Z: The next fresh retry reached and correlated the
  correct observer, but resolver metadata failed immediately before
  `observer_ready`. A captured read-only probe reproduced Node's
  `ERR_OUT_OF_RANGE` because the child-process timeout received a fractional
  millisecond value derived from `performance.now()`. No candidate, rollback,
  or provider mutation ran. The fix is to round that bounded timeout before
  invoking the child process.
- 2026-08-11T00:52:19.679Z: The new regression test reproduced the same
  fractional-timeout `ERR_OUT_OF_RANGE` under the old implementation. This was
  an intentional RED test only; no application, candidate, or provider state
  changed.
- 2026-08-11T01:11:41.136Z: With the timeout-rounding fix deployed locally, a
  fresh retry reached the reviewed observer and its foundation listener was
  active, but the controller still returned `failed_closed` before
  `observer_ready`. No candidate, rollback, or provider mutation ran. A
  read-only resolver probe is being used to separate transient live metadata
  timing from another controller boundary issue.
- 2026-08-11T01:18:00Z: A bounded source search command was malformed and
  failed before reading project files. No application, candidate, provider,
  secret, database, or calendar state changed. The search is being rerun with
  an explicit result collection rather than an empty PowerShell pipeline.
- 2026-08-11T01:20:00Z: A second read-only search used an invalid regular
  expression and failed before reading the installed Wrangler bundle. No
  application, candidate, provider, secret, database, or calendar state
  changed. Subsequent searches use one literal term at a time.
- 2026-08-11T01:21:00Z: A file-inspection call used a nonexistent local tool
  wrapper and failed before reading the installed Wrangler bundle. No
  application, candidate, provider, secret, database, or calendar state
  changed.
- 2026-08-11T01:24:00Z: A bounded error-category formatter used PowerShell's
  `-join` operator in the wrong pipeline position and failed after the
  provider log had already been reduced to memory. No raw log line was
  printed and no application, candidate, provider, secret, database, or
  calendar state changed.
- 2026-08-11T01:31:00Z: The new unit regression intentionally reproduced the
  live failure: a valid unrelated calendar-maintenance terminal caused the
  foundation signal observer to exit before the expected foundation signal.
  This was the TDD RED step; no deployment or provider state changed.
- 2026-08-11T01:41:00Z: The documentation coverage gate rejected the listener
  repair because its two new helper functions lacked the repository's required
  simple and technical reference headings. No application, candidate,
  provider, secret, database, or calendar state changed.
- 2026-08-11T01:42:00Z: The first commit attempt was blocked by Windows
  permission on the linked worktree Git index lock. No files were staged, no
  commit was created, and no application, candidate, provider, secret,
  database, or calendar state changed. The bounded retry will use the normal
  Git worktree outside the restricted sandbox.
- 2026-08-11T01:43:00Z: A candidate-worktree status check hit Git's dubious
  ownership guard under the restricted sandbox identity. No global Git
  configuration was changed and no candidate or provider state changed; the
  next check uses a per-command safe-directory allowance.
- 2026-08-11T01:48:00Z: The first fresh monitored retry after the unrelated
  terminal-family repair returned `failed_closed`. A safe workflow/job
  reconciliation is required to identify the exact stage; no further retry is
  being started until that evidence is classified.
- 2026-08-11T01:52:00Z: A read-only mapping inspection omitted the nested
  mappings directory and then attempted to read a null path. No provider,
  candidate, repository, secret, database, or calendar state changed.
- 2026-08-11T01:54:00Z: A bounded source inspection used invalid PowerShell
  variable interpolation and failed before reading project files. No
  application, candidate, provider, secret, database, or calendar state
  changed.
- 2026-08-11T01:55:00Z: A follow-up inspection initially targeted the parent
  checkout instead of the Phase B linked worktree and found no incident file.
  No files were changed and no application, candidate, provider, secret,
  database, or calendar state changed.
- 2026-08-11T01:56:00Z: A bounded test inspection used an invalid PowerShell
  `for` initializer and failed before reading the test file. No application,
  candidate, provider, secret, database, or calendar state changed.
- 2026-08-11T01:58:00Z: A read-only GitHub workflow metadata probe returned no
  usable result in the current shell before any provider data was displayed.
  No run identifier, payload, secret, application, candidate, provider,
  database, or calendar state changed; the existing repository resolver path
  remains the source of truth for the diagnosis.
- 2026-08-11T02:00:00Z: A read-only executable-availability check used an
  empty PowerShell pipeline after a loop and failed before invoking anything.
  No application, candidate, provider, secret, database, or calendar state
  changed.
- 2026-08-11T02:02:00Z: A read-only controller-test inspection guessed a
  nonexistent filename and failed before reading project files. No
  application, candidate, provider, secret, database, or calendar state
  changed.
- 2026-08-11T02:04:00Z: A bounded source search passed an unsupported
  PowerShell `Select-String` option and failed before reading source files.
  No application, candidate, provider, secret, database, or calendar state
  changed.
- 2026-08-11T02:06:00Z: A local candidate-config summary used an empty
  PowerShell pipeline after a loop and failed before reading config files. No
  application, candidate, provider, secret, database, or calendar state
  changed.
- 2026-08-11T02:08:00Z: A read-only live resolver reproduction did not return
  a usable reduced result through the shell wrapper, so its outcome is
  treated as inconclusive. No command output, provider payload, application,
  candidate, provider, secret, database, or calendar state was exposed or
  changed.
- 2026-08-11T02:10:00Z: A safe public-clock comparison measured the local
  machine approximately 1.33 seconds ahead of GitHub's API clock. The
  resolver's 999-millisecond provider-second allowance is therefore too small
  to cover the observed dispatch timestamp skew. No application, candidate,
  provider, secret, database, or calendar state changed; a local regression is
  being added before any live retry.
- 2026-08-11T02:12:00Z: The direct `pnpm exec vitest` shortcut was unavailable
  in the linked worktree and failed before running the new regression. No
  application, candidate, provider, secret, database, or calendar state
  changed; the repository's existing test script will be used instead.
- 2026-08-11T02:14:00Z: The full unit-suite wrapper returned only the Vitest
  startup banner, and a follow-up Windows process inspection was denied by
  local permissions. No test result is inferred from that incomplete capture;
  no application, candidate, provider, secret, database, or calendar state
  changed.
- 2026-08-11T02:18:00Z: The complete unit suite provided a valid RED result
  for the new provider-clock-skew regression, and also exposed a regression
  in the prior safe-tail repair: calendar-maintenance-only mode rejected its
  own valid maintenance evidence. No application, candidate, provider,
  secret, database, or calendar state changed; both failures are being fixed
  locally before any live retry.
- 2026-08-11T02:20:00Z: After adding the bounded clock-skew allowance, one
  existing stale-run fixture became valid because it was only one second
  before dispatch. The fixture was moved outside the new four-second envelope
  so the stale-run fail-closed contract remains explicit; no application,
  candidate, provider, secret, database, or calendar state changed.
- 2026-08-11T02:23:00Z: The worker suite passed, while Wrangler again emitted
  its known local log-file EPERM and linked-worktree static-analysis warnings.
  The warnings were non-fatal and no application, candidate, provider, secret,
  database, or calendar state changed.
- 2026-08-11T02:24:00Z: The preview build and deploy-configuration check
  passed; the build again emitted only the known Wrangler local log-file EPERM
  warning. No application, candidate, provider, secret, database, or calendar
  state changed.
- 2026-08-11T02:26:00Z: While repinning the disposable acceptance controller
  after commit `40d026c`, I initially typed an incorrect full SHA into the two
  ignored local pin files. Verification caught the mismatch before any
  dispatch; the pins are being corrected to the exact repository SHA. No
  application, candidate, provider, secret, database, or calendar state
  changed.
- 2026-08-11T02:28:00Z: A bounded cleanup-path search traversed a broken
  linked-worktree dependency path and failed before reading the requested
  scripts. No application, candidate, provider, secret, database, or calendar
  state changed; the search is being rerun against explicit tracked files.
- 2026-08-11T02:30:00Z: A short read-only cancellation-settlement poll used a
  malformed local worktree path and failed before invoking GitHub. No
  application, candidate, provider, secret, database, or calendar state
  changed.
- 2026-08-11T02:36:00Z: The first monitored retry at the final frozen tip,
  after the bounded clock-skew repair and stale-observer cleanup, returned
  `failed_closed` with no candidate status. Safe workflow reconciliation is
  required before another retry; no candidate, rollback, Cloudflare, traffic,
  secret, database, or calendar mutation ran.
- 2026-08-11T02:41:00Z: A local resolver probe using the package-runner alias
  failed before executing because the Windows `tsx` executable was not
  resolved. No application, candidate, provider, secret, database, or
  calendar state changed; use the repository's explicit executable path for
  the probe.
- 2026-08-11T02:46:25Z: Safe reconciliation of the newest observer showed
  exact workflow identity, one active foundation listener, a present
  correlation artifact, and ample GitHub API quota. The same metadata resolved
  successfully through the resolver when replayed locally, so the live
  `failed_closed` result is classified as a transient bounded provider-metadata
  read failure or timing race, not an identity, topology, candidate, or
  Cloudflare failure. The still-running observer was cancelled and settled as
  cancelled; no candidate, rollback, traffic, secret, database, or calendar
  mutation ran.
- 2026-08-11T02:47:40Z: The new resolver regression test correctly failed before
  implementation because one provider metadata command was still fatal on its
  first transient error. This intentional RED result confirms the test is
  exercising the live adapter boundary; no application, candidate, provider,
  secret, database, or calendar state changed.
- 2026-08-11T02:49:05Z: The first retry implementation caused two existing
  deadline/outer-cancellation contract tests to hang because a timed-out child
  command was indistinguishable from a retryable process failure. The change
  is being narrowed so deadline and cancellation errors remain fail-closed and
  only an early settled provider failure is retried; no application, candidate,
  provider, secret, database, or calendar state changed.
- 2026-08-11T02:49:52Z: A recursive documentation search used an invalid
  PowerShell parameter and stopped before reading files. No application,
  candidate, provider, secret, database, or calendar state changed; use an
  explicit Markdown file list for the search.
- 2026-08-11T02:56:34Z: The first full unit-suite invocation produced no output
  for the local polling window and was stopped; the same suite was rerun with
  a verbose reporter and completed green with 1,760 passed and 6 skipped tests.
  The delay was test-runner output scheduling, not a product failure; no
  application, candidate, provider, secret, database, or calendar state changed.
- 2026-08-11T03:00:11Z: The first staging attempt was blocked by Windows
  permission on the linked worktree's Git index lock. No files were staged and
  no commit or provider action ran; the same explicit staging operation must be
  retried through the approved elevated Git boundary.
- 2026-08-11T03:01:04Z: The first disposable-candidate status read was blocked
  by Git's dubious-ownership guard in the sandbox identity. No candidate files
  or provider state changed; candidate inspection and refresh must use the
  exact disposable path with an explicit temporary safe-directory option.
- 2026-08-11T03:03:38Z: While repinning the ignored local controller and input
  after the candidate refresh, I initially wrote the abbreviated tip instead
  of the required full commit SHA. Pin verification caught the mismatch before
  any dispatch; the exact full SHA is being written now. No candidate,
  provider, secret, database, or calendar state changed.
- 2026-08-11T03:11:40Z: The fresh monitored retry after the bounded provider-
  metadata retry repair again returned `failed_closed` before any candidate
  status. Safe workflow metadata showed the foundation listener had started,
  the candidate job was skipped, and no mutation job ran. The observer was
  cancelled and settled as cancelled; no candidate, rollback, traffic,
  Cloudflare, secret, database, or calendar state changed. The repeated
  boundary is being diagnosed before another retry.
- 2026-08-11T03:15:00Z: A read-only deployments-list probe was not executed
  because the local PowerShell version rejected the null-coalescing operator
  used in the probe wrapper. No provider command ran and no state changed; the
  wrapper is being rewritten with syntax supported by this host.
- 2026-08-11T03:18:10Z: The corrected Wrangler deployments-list probe reached
  the CLI but returned a nonzero command result with undecodable output. The
  bounded classifier found only the generic command marker, not a safe
  provider category; no deployment or other provider state changed. This
  probe is not being used as evidence for the observer failure.
- 2026-08-11T03:19:06Z: Read-only GitHub job reconciliation narrowed the newest
  monitored failure to the `Print only allowlisted acceptance evidence` step:
  the observer listener had started, the candidate job was skipped, and all
  mutation jobs were skipped. The failed step exposed no allowlisted
  foundation evidence marker or category, so the earlier metadata-race theory
  is not sufficient; the next diagnosis targets the scheduled probe/tail
  boundary before any retry.
- 2026-08-11T03:20:20Z: A read-only deployment-response shape probe assumed a
  nonempty collection and attempted to inspect a null first record. The
  corrected deployments-list command itself succeeded, but this follow-up
  probe stopped before reading any provider value; no state changed.
- 2026-08-11T03:22:29Z: The bounded local tail-capture probe stopped before
  starting because its ignored helper imported the tracked classifier through
  one parent path too many. No Wrangler tail or provider action ran and no
  state changed; the helper import path is being corrected.
- 2026-08-11T03:25:28Z: A read-only Wrangler versions-list wrapper used
  `try` as an expression inside a PowerShell cast, so the wrapper failed before
  inspecting the CLI response. No version or provider state changed; the
  JSON parse check is being rewritten with an explicit catch block.
- 2026-08-11T03:35:00Z: A bounded local tail capture completed without seeing
  any foundation evidence during its window. Source and workflow inspection
  confirmed that the committed preview configuration has only the normal
  fifteen-minute and daily schedules, while the generated acceptance
  configuration adds the one-minute acceptance cron and selector. The
  observer operation runs before the separate candidate-deployment operation,
  so an active normal Worker cannot emit a foundation acceptance signal during
  that observer window. The active provider schedule is still unconfirmed;
  this is a sequencing risk, not yet a provider-state conclusion. No
  deployment, traffic, rollback, secret, key, database, or calendar mutation
  ran.
- 2026-08-11T03:37:51Z: A local source-inspection wrapper contained a malformed
  orchestration expression and failed before reading the observer resolver.
  No repository command, provider request, or application state changed; the
  inspection is being rerun with a corrected wrapper.
- 2026-08-11T03:42:56Z: A bounded disposable-worktree status wrapper left an
  empty PowerShell pipeline after its loop and failed before reading either
  worktree. No files, candidate artifacts, provider state, secrets, keys,
  database, or calendar state changed; the status check is being rerun with an
  explicit result collection.
- 2026-08-11T03:43:43Z: A follow-up disposable-worktree path inspection repeated
  the same empty-pipeline wrapper mistake and stopped before reading the
  worktree metadata. No files or external state changed; subsequent checks use
  a single-object command without a trailing pipeline.
- 2026-08-11T03:45:04Z: The approved read-only baseline controller invocation
  used the PowerShell Core executable name, which is not installed on this
  host, and stopped before the controller started. No Wrangler/provider request
  or state change occurred; the native Windows PowerShell executable is being
  used for the contained retry.
- 2026-08-11T03:45:39Z: The native read-only baseline controller started but
  failed closed at `candidate_artifact_invalid` because the ignored disposable
  candidate pin still referenced an older tip after later documentation
  commits. The provider was not reached and no state changed; the candidate
  and rollback artifacts must be refreshed at the final frozen tip before
  baseline validation can be meaningful.
- 2026-08-11T03:46:19Z: A read-only local/remote tip probe supplied a malformed
  Windows working-directory string and the host rejected process creation
  before Git ran. No repository or provider state changed; the probe is being
  rerun with the explicit validated worktree path.
- 2026-08-11T03:51:05Z: A follow-up disposable-artifact hash probe repeated a
  malformed working-directory string and failed during process creation before
  reading Git or artifact bytes. No files or external state changed; the
  comparison is being rerun only after the path is validated.
- 2026-08-11T03:54:05Z: The first fresh-disposable-worktree creation emitted
  Git's normal preparation message on stderr while PowerShell was configured
  to stop on native stderr, so the wrapper stopped after the first worktree
  was created. No provider state changed; the existing created path is being
  reused and the second path will be added with stderr handled as informational.
- 2026-08-11T03:56:06Z: Locked dependency installation in the two fresh
  disposable worktrees could not read/download packages under the restricted
  local boundary (`EACCES`/registry metadata failure). No source, provider,
  secret, key, database, or calendar state changed; the same locked install is
  being retried through the approved external package boundary.
- 2026-08-11T04:00:41Z: The fresh rollback worktree still lacked a complete
  dependency tree after the first install boundary, so its build command
  attempted the locked package install and failed again on registry fetch
  permissions (`EACCES`/fetch failed). The build did not run and no source,
  provider, secret, key, database, or calendar state changed; the install is
  being retried explicitly through the approved external package boundary.
- 2026-08-11T04:01:31Z: A follow-up status/checkout probe for the fresh
  disposable worktrees was rejected by Git's ownership safety check because
  those paths are owned by the interactive Windows account while this local
  probe runs under the sandbox account. No files, provider state, secrets,
  keys, database, or calendar state changed; the retry will use an explicit
  per-command safe-directory allowance without changing global Git settings.
- 2026-08-11T04:02:12Z: The explicit safe-directory checkout still could not
  create the shared worktree administrative lock under the sandbox account
  (`index.lock` permission denied). The checkout stopped before changing either
  worktree; no files, provider state, secrets, keys, database, or calendar
  state changed. The same read-only-to-local-repair step is being retried only
  through the approved external boundary.
- 2026-08-11T13:16:08Z: The fresh candidate artifact passed typechecking and
  build/config checks, but the full unit suite recorded 1 failure in
  `preview-rollback-lifecycle.test.ts` (101 files passed, 1 skipped). The
  file-based closure-chain child-process test exceeded Vitest's 5-second test
  timeout while launching its local verifier; no provider, deployment, secret,
  key, database, or calendar state changed. A bounded targeted rerun with a
  larger test timeout is being used to distinguish local startup slowness from
  a functional regression.
- 2026-08-11T13:27:02Z: The approved read-only baseline controller failed
  closed at `candidate_ci_evidence_invalid` after validating the freshly pinned
  candidate and rollback artifacts. No provider request reached a mutation
  boundary and no deployment, traffic, rollback, secret, key, database, or
  calendar state changed; the CI-evidence contract is being inspected before
  any retry.
- 2026-08-11T13:29:47Z: The first local wrapper for the durable full-CI result
  contained an unescaped PowerShell backtick inside the JavaScript command
  string and failed before starting CI. No files, provider, secret, key,
  database, or calendar state changed; the wrapper is being rerun with a
  newline expression that does not cross the host-language quoting boundary.
- 2026-08-11T13:31:34Z: The corrected wrapper initially invoked `pnpm ci`,
  which this pnpm version treats as its install alias rather than the package
  script named `ci`; the safe result was therefore invalidated before it could
  be used. No source, provider, deployment, secret, key, database, or calendar
  state changed. The actual script is being rerun explicitly as `pnpm run ci`.
- 2026-08-11T13:38:11Z: With the fresh full-CI result accepted, the read-only
  baseline controller stopped at `candidate_artifact_invalid` while checking
  the pinned disposable artifact. No provider request reached a mutation
  boundary and no deployment, traffic, rollback, secret, key, database, or
  calendar state changed; the local artifact identity/build checks are being
  inspected before another retry.
- 2026-08-11T13:54:56Z: After the artifact and exact full-CI gates passed, the
  approved read-only baseline waited its full bounded live window and failed at
  `live_schedule_evidence_timeout`. No deployment, traffic, rollback, secret,
  key, database, or calendar state changed; the challenge/evidence path is
  being inspected against the active normal schedule before any mutation.
- 2026-08-11T14:02:38Z: A bounded post-CI artifact summary wrapper built a
  malformed Git argument expression and printed Git's command error before the
  safe config/result fields were read. No files, provider, secret, key,
  database, or calendar state changed; subsequent summaries use separate
  argument variables rather than string concatenation.

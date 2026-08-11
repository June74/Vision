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

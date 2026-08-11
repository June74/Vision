# SB-20260726-191141-wrangler-log-path-sandbox-warning: Wrangler log path was blocked by sandbox

- **Status:** closed
- **First observed:** 2026-07-26T19:11:41.029672Z
- **Last observed:** 2026-08-11T21:19:07Z
- **Phase/task:** Phase B Task 8 owner authentication diagnosis through reconnect-recovery Task 4 focused verification
- **Environment:** Local managed sandbox
- **Version/commit:** `a4376ab` plus the uncommitted Task 2 PostgreSQL proof
- **Latest recurrence:** 2026-08-02T17:58:18.244Z — closed after the identical
  19-test Worker gate passed with the approved task-local diagnostic path and
  filesystem access; neither sandbox warning recurred. No provider,
  credential, repository, deployment, or private-data state changed.

## Symptom

A successful local build emitted a Wrangler log-file permission error for its user-profile logging directory.

## Impact

The build completed, but diagnostic output was noisy and the local log file was unavailable.

## Reproduction conditions

Run a Vite build while Wrangler uses its default user-profile log directory.

## Safe evidence

The build completed, but the sandbox denied the optional Wrangler log write.

## Recurrence history

- 2026-08-07T19:43:54Z: The sandbox-only log-path boundary recurred during a
  local Wrangler-version probe. The first invocation was discarded; a
  task-local configuration directory then allowed all three artifact/root
  binaries to report the same version without provider access.

## Attempts and outcomes

- The first build emitted a log-path permission warning.
- A second build used a workspace-local `XDG_CONFIG_HOME` and completed without
  the warning.

## Cause classification

- **Confirmed cause:** The default sandbox does not permit Wrangler to write its
  user-profile diagnostic directory.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** Build output and generated configuration were valid.

## Correction and prevention

- **Correction:** Routed only Wrangler's local diagnostic files to a
  workspace-local temporary directory.
- **Prevention:** Set a workspace-local `XDG_CONFIG_HOME` for local Wrangler
  diagnostics in this managed environment.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The follow-up build and preview validator both exited zero without the log-path
warning. The latest recurrence was warning-only: the complete repository check
exited zero with 694 unit/integration tests passed and one skipped, 179 contract
tests passed, 75 Worker tests passed, and build, documentation, typecheck, and
security validation passed.

The reconnect-recovery Task 4 focused rerun also passed all 19 Worker tests
with the approved task-local diagnostic path and filesystem access; neither the
optional log-path warning nor static export-analysis warning recurred.

## Recurrence history

- 2026-07-26T19:11:41.029672Z: First observed.
- 2026-07-26T19:41:17.2340348Z: Recurred during the temporary preview
  artifact build after the known workspace-local diagnostic setting was
  omitted. The next check restores that setting.
- 2026-07-26T20:51:35.3688189Z: Recurred during split clean-room Worker and
  build stages after the same local diagnostic setting was omitted. Both
  stages exited successfully; future final verification must restore the
  workspace-local setting before invocation.
- 2026-07-26T22:03:47.5841722Z: Recurred during the temporary backup
  acceptance build after the diagnostic setting was omitted. Build and preview
  configuration validation both exited successfully; the follow-up uses a
  task-specific temporary diagnostic directory.
- 2026-07-26T22:58:14Z: Recurred while rebuilding the normal backup schedule
  after the diagnostic setting was omitted. The focused tests, build, and
  preview artifact validation all exited successfully.
- 2026-07-27T00:22:25Z: Recurred during the AI Gateway identifier full gate
  because the workspace-local diagnostic setting was omitted. The remaining
  checks are rerun separately with that setting restored.
- 2026-07-27T01:40:05Z: Recurred during the fresh Phase B Worker gate after
  the workspace-local diagnostic setting was again omitted. All 75 Worker
  assertions passed; remaining commands restore the setting.
- 2026-07-27T02:38:35Z: Recurred during the unchanged-key restore baseline
  because the workspace-local diagnostic setting was omitted. The complete
  repository gate and all 29 browser tests still exited successfully; future
  restore checks set a task-local `XDG_CONFIG_HOME`.
- 2026-07-27T19:43:48Z: Recurred during the corrected full Worker suite after
  the task-local diagnostic setting was again omitted. All 75 Worker
  assertions passed with a zero exit.
- 2026-07-27T21:10:21Z: Recurred during the listener-first execution baseline
  after the workspace-local diagnostic setting was omitted. Worker tests,
  build, documentation, and security gates all completed successfully.
- 2026-07-28T01:00:14.2508518Z: Recurred during listener-first restore retry
  Task 2 verification after the workspace-local diagnostic setting was omitted.
  The complete repository check exited zero: 694 unit/integration tests passed
  with one skip, 179 contract tests passed, 75 Worker tests passed, and build,
  documentation, typecheck, and security validation passed. No provider state
  or private data was affected.
- 2026-07-28T02:21:26.5488258Z: Recurred during the preview role-probe Worker
  gate because the task-local diagnostic setting was omitted. All 75 Worker
  assertions passed; the enclosing gate later stopped at documentation
  coverage.
- 2026-07-28T14:43:50Z: Recurred during the resumed complete repository gate
  because the task-local diagnostic setting was omitted. The command exited
  zero after 720 unit/integration tests passed with one intentional skip, 179
  contract tests passed, 75 Worker tests passed, and documentation, build, and
  security validation passed.
- 2026-07-28T19:03:00.1892549Z: Recurred during the Task 1 complete repository
  gate. The command exited zero after 755 unit/integration tests passed with
  one intentional skip, 179 contract tests passed, 75 Worker tests passed, and
  typecheck, documentation, build, and security validation passed. The
  optional user-profile log write and static export analysis remained
  sandbox-limited; generated artifacts and all executable gates were valid.
- 2026-07-28T19:15:35.3439513Z: The final Task 1 gate routed Wrangler's
  optional log to a task-local temporary path, eliminating the log-write
  error. Static export analysis remained sandbox-limited, while all 75 Worker
  tests and the build passed. The complete gate again exited zero with 755
  unit/integration tests, one intentional skip, 179 contract tests,
  documentation, typecheck, build, and security validation passing.
- 2026-07-28T19:53:23.7015526Z: Recurred during the Task 2 focused Worker
  gate because the task-local diagnostic setting was omitted. All 11
  diagnostics assertions passed. The user-profile log write and static export
  analysis were sandbox-limited; the follow-up restores local XDG and Wrangler
  directories before accepting the result.
- 2026-07-28T20:03:59.2816903Z: The Task 2 complete gate used task-local
  Wrangler logging, so no log-write error recurred. Static export analysis
  remained sandbox-limited. The gate exited zero with 791 unit/integration
  tests passed and one intentional skip, 179 contract tests passed, 77 Worker
  tests passed, and typecheck, documentation, build, and security validation
  passing.
- 2026-07-29T02:50:00Z: Recurred during Task 4 review-fix verification after
  the task-local diagnostic setting was omitted. Both production bundles and
  the crypto-boundary validator completed with exit zero; the follow-up build
  restores a task-local temporary `XDG_CONFIG_HOME`.
- 2026-07-29T02:51:00Z: The Task 4 follow-up build used the task-local
  temporary diagnostic directory and completed both bundles plus the
  crypto-boundary validator with no log-write warning.
- 2026-07-29T03:27:04Z: Recurred during Task 5 Worker RED/GREEN verification
  because the task-local diagnostic setting was omitted. The focused Worker
  assertions passed after implementation; the next Worker command restores a
  workspace-local `XDG_CONFIG_HOME`.
- 2026-07-29T04:11:29Z: Task 5 verification left an untracked workspace-root
  `debug.log`. Metadata and pattern-only inspection confirmed the exact
  workspace-contained target; it was removed before staging, and the final
  gates use the task-local diagnostic directory.
- 2026-07-29T04:28:42.0694275Z: The final Task 5 gate recreated the
  workspace-root `debug.log` even with task-local Wrangler paths, alongside
  the expected task-local diagnostic directory. Both exact worktree-contained
  targets were verified from metadata and removed before staging. All
  executable gates exited zero.
- 2026-07-29T16:50:49Z: Recurred during Task 6 build verification because the
  task-local diagnostic setting was omitted. Both bundles, the crypto-boundary
  validator, and the normal preview artifact validator exited zero. Remaining
  Task 6 build gates restore a temporary `XDG_CONFIG_HOME`.
- 2026-07-30T00:32:15.7041949Z: Recurred during the wave-3 aggregate gate
  because the task-local diagnostic setting was omitted. The optional log
  write was denied, while the aggregate command still exited zero with 1,179
  unit/integration/security tests passed and one intentional skip, 179
  contract tests passed, 94 Worker tests passed, and typecheck,
  documentation, build, and release security validation passing.
- 2026-07-30T01:27:57.1549724Z: Recurred during the wave-4 aggregate gate
  because the task-local diagnostic setting was omitted. The optional log
  writes were denied, while the command still exited zero with 1,180
  unit/integration/security tests passed and one intentional skip, 179
  contract tests passed, 94 Worker tests passed, and typecheck, documentation,
  build, and release security validation passing.
- 2026-07-30T02:10:46.3155513Z: Recurred during the wave-5 aggregate gate
  because the task-local diagnostic setting was omitted. The optional log
  writes were denied, while the command still exited zero with 1,181
  unit/integration/security tests passed and one intentional skip, 179
  contract tests passed, 94 Worker tests passed, and typecheck, documentation,
  build, and release security validation passing.
- 2026-07-30T02:28:21.0621287Z: Recurred during the fresh hardened wave-5
  aggregate because the task-local diagnostic setting was omitted. The
  optional log writes were denied, while the command still exited zero with
  1,181 unit/integration/security tests passed and one intentional skip, 179
  contract tests passed, 94 Worker tests passed, and typecheck, documentation,
  build, and release security validation passing.
- 2026-07-30T02:36:01.8815351Z: Recurred during the final path-scoped wave-5
  aggregate because the task-local diagnostic setting was omitted. The
  optional log writes were denied, while the command still exited zero with
  1,181 unit/integration/security tests passed and one intentional skip, 179
  contract tests passed, 94 Worker tests passed, and typecheck, documentation,
  build, and release security validation passing.
- 2026-07-30T02:41:31.5864131Z: Recurred during the definitive post-review
  wave-5 aggregate because the task-local diagnostic setting was omitted. The
  optional log writes were denied, while the command still exited zero with
  1,181 unit/integration/security tests passed and one intentional skip, 179
  contract tests passed, 94 Worker tests passed, and typecheck, documentation,
  build, and release security validation passing.
- 2026-07-31T00:29:23.4847341Z: Recurred during the final bounded Task 3 build
  because Wrangler used its default user-profile debug-log path. The build
  exited zero and produced both expected artifacts; the clean rerun routes only
  optional diagnostics to an approved temporary path.
- 2026-07-31T03:36:10.9872703Z: Recurred during the integrated resolver and
  restore build because the approved task-local Wrangler log path was omitted.
  The build and production crypto boundary still exited zero; no provider,
  credential, repository, or private-data state changed. A clean rerun must
  use the approved worktree-local temporary log path.
- 2026-07-31T03:37:02.9850425Z: Closed after the identical build and
  production crypto-boundary validation passed with the approved
  worktree-local Wrangler log path and no sandbox warning.
- 2026-07-31T20:07:23.9884666Z: Recurred during Task 4 diagnostics RED because
  the task-local Wrangler diagnostic setting was omitted. The focused Worker
  run still collected one file and 33 tests, with eight expected feature RED
  failures and 25 passes; no provider, credential, repository, or private-data
  state changed.
- 2026-07-31T20:14:00.4865884Z: Closed after the Task 4 diagnostics Worker
  rerun used the approved worktree-local diagnostic path and passed all 33
  tests without the optional debug-log permission warning. The separate known
  static export-analysis sandbox warning remained warning-only.
- 2026-07-31T22:28:15.2681194Z: Recurred during the frozen Task 5 Worker
  focused command; Wrangler could not write its optional user-level log, while
  the command exited zero with all 11 route-contract tests passing.
- 2026-07-31T22:29:31.1562918Z: Recurred during the Task 5 production build;
  both Worker and client builds completed successfully despite the optional
  user-level log warning.
- 2026-07-31T22:41:29.9852547Z: Recurred during the final complete Task 5 gate;
  the full command still exited zero and both production builds passed.
- 2026-08-01T00:27:49.9551896Z: Recurred during the final Task 6 complete gate.
  Wrangler could not write two optional user-level debug logs, while the full
  command exited zero with 1,693 unit, 179 contract, and 110 Worker tests plus
  both builds, documentation, and release security passing.
- 2026-08-01T00:39:33.3812929Z: Recurred during three Gate 0 focused Worker
  slices. The commands exited zero with 34 webhook, 33 diagnostics, and 11 AI
  route tests passing. Only Wrangler's optional user-level diagnostic location
  was reported; no provider, credential, deployment, or candidate state changed.
- 2026-08-01T00:49:13.6609802Z: Recurred during the Gate 0 exact Worker and
  aggregate checks. Both commands exited zero; the Worker gate passed 110 tests
  and the aggregate check completed its full test, build, documentation, and
  security sequence. No provider, credential, deployment, or candidate state
  changed.
- 2026-08-01T00:50:03.2308020Z: Recurred during the Gate 0 preview build. The
  build exited zero; only Wrangler's optional user-level log location was
  reported, and no deployment occurred.
- 2026-08-01T00:50:50.6070000Z: Recurred during the Gate 0 production build.
  The build exited zero; only Wrangler's optional user-level log location was
  reported, and no deployment occurred.
- 2026-08-01T01:21:28.6021019Z: Recurred during the post-review safe-push
  repair aggregate check. The command exited zero and completed its full test,
  build, documentation, and release-security sequence. No worktree debug log,
  deployment, provider mutation, or key change resulted.
- 2026-08-01T01:30:00.6866222Z: Recurred during both post-repair explicit
  candidate builds. Browser, preview build/check, and production build/check
  all exited zero. A separate generated-debug-artifact recurrence was safely
  removed without reading it.
- 2026-08-02T03:28:54.9085762Z: Recurred before the filtered Task 8 live
  authentication tail connected because the workspace-local diagnostic
  setting was omitted. The tail stopped before reading a Worker event, and no
  application, account, provider, credential, or private-data state changed.
  The retry must set a task-local `XDG_CONFIG_HOME` before Wrangler starts.
- 2026-08-02T17:03:04.5416381Z: Recurred during the corrected reconnect
  baseline because the task-local Wrangler diagnostic setting was omitted.
  The complete repository CI script still exited zero with 1,730 unit and
  integration tests plus one intentional skip, 179 contract tests, 110 Worker
  tests, 36 browser tests, typecheck, documentation, both production builds,
  and release security passing. The Worker pool also repeated its known
  sandbox-only static export-analysis warning. No external or private state
  changed; focused Worker and build reruns use the approved local diagnostic
  path with elevated filesystem access.
- 2026-08-02T17:04:00.3746920Z: Closed after the focused Worker suite passed
  all 110 tests and both production builds plus the crypto-boundary validator
  passed with a task-local diagnostic path and approved filesystem access;
  neither warning recurred.
- 2026-08-02T17:35:47.724Z: Recurred during reconnect-recovery Task 3's
  expected RED Worker run because the task-local Wrangler diagnostic setting
  was omitted. The intended test process still ran: 13 pre-existing tests
  passed and exactly six new recovery assertions failed for the expected
  missing behavior. No provider, credential, repository staging, or private
  data changed. Subsequent Worker runs use a task-local diagnostic path.
- 2026-08-02T17:56:17.357Z: Recurred during reconnect-recovery Task 4 focused
  verification because the task-local Wrangler diagnostic setting was
  omitted. The command exited zero with all 19 callback assertions passing;
  only the optional user-profile log and static export analysis were
  sandbox-limited. The clean rerun restores the approved task-local diagnostic
  path and elevated filesystem access. No external or private state changed.
- 2026-08-02T17:58:18.244Z: Closed after the identical 19-test Worker gate
  passed with the approved task-local diagnostic path and filesystem access;
  neither sandbox warning recurred.
- 2026-08-03T00:36:28.2471845Z: Recurred during corrected-redeploy read-only
  Wrangler inspection when an exact untracked worktree `debug.log` was
  created. Its path, untracked status, and byte count were verified without
  opening it. No deployment occurred; the exact log is quarantined for
  immediate deletion because it may contain provider metadata.
- 2026-08-03T00:40:32.3834308Z: Closed after the exact path was proven inside
  the worktree and exactly untracked, then the 396-byte log was permanently
  deleted without opening it. It is not recoverable from the worktree.
- 2026-08-07T18:14:57.499Z and 2026-08-07T18:15:19.827Z: Recurred during
  the complete local `pnpm check` when Wrangler used its default external
  profile log path. The unit, contract, Worker, documentation, build, and
  security stages still exited zero; no provider or private-data state
  changed. The warning is classified as known environment noise and remains
  closed.
- 2026-08-10T01:22:00.707Z: Recurred during the complete local `pnpm check`
  when the sandbox denied Wrangler's optional user-profile log write and
  static export analysis. The contract and Worker suites, build, documentation,
  and release security stages continued; no provider, credential, deployment,
  or private-data state changed. The warning remains environment-only.
- 2026-08-10T19:00:33.232Z: Recurred during the bounded `pnpm build` because
  Wrangler used its default user-profile log path. Both Vite bundles and the
  production crypto-boundary validator still exited zero; no provider,
  credential, deployment, or private-data state changed. The clean retry must
  set the known worktree-local Wrangler diagnostic path.
- 2026-08-11T21:19:07Z: Recurred during the correlation-wait repair build
  because the default user-profile Wrangler log path was used. The Vite
  bundles were generated and the production crypto-boundary validator ran, but
  the optional log write was denied. No provider, credential, deployment, or
  private-data state changed.
- 2026-08-11T21:20:48Z: Closed after the same build and production
  crypto-boundary validation were rerun with a worktree-local diagnostic
  directory; both exited zero without the optional log-write warning.
- 2026-08-11T22:12:40Z: Recurred during the full Worker suite because the
  task-local Wrangler diagnostic setting was omitted. All 116 Worker tests
  still passed; the warning and static export-analysis message were
  environment-only, with no provider or private-data change.
- 2026-08-11T22:13:32Z: Closed after rerunning all 116 Worker tests with a
  worktree-local Wrangler diagnostic directory. The optional log-write warning
  did not recur; the remaining static export-analysis warning is the known
  sandbox filesystem limitation and the suite still exited zero.

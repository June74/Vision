# SB-20260726-191141-wrangler-log-path-sandbox-warning: Wrangler log path was blocked by sandbox

- **Status:** closed
- **First observed:** 2026-07-26T19:11:41.029672Z
- **Last observed:** 2026-07-31T22:41:29.9852547Z
- **Phase/task:** Phase B Tasks 4 and 5 Worker verification
- **Environment:** Local managed sandbox
- **Version/commit:** Uncommitted Task 2 worktree based on `ff6a767`; `6ebabd1`
- **Latest recurrence:** 2026-07-30T03:32:34.1083650Z — the segmented Gate 0
  Worker run omitted the task-local diagnostic setting. The optional log write
  was denied, while all 94 Worker assertions passed with a zero exit. No
  provider, credential, repository, or private-data state changed.

## Symptom

A successful local build emitted a Wrangler log-file permission error for its user-profile logging directory.

## Impact

The build completed, but diagnostic output was noisy and the local log file was unavailable.

## Reproduction conditions

Run a Vite build while Wrangler uses its default user-profile log directory.

## Safe evidence

The build completed, but the sandbox denied the optional Wrangler log write.

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

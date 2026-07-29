# SB-20260726-191141-wrangler-log-path-sandbox-warning: Wrangler log path was blocked by sandbox

- **Status:** closed
- **First observed:** 2026-07-26T19:11:41.029672Z
- **Last observed:** 2026-07-29T16:50:49Z
- **Phase/task:** Phase B acceptance instrumentation Task 6 build verification
- **Environment:** Local managed sandbox
- **Version/commit:** Uncommitted Task 2 worktree based on `ff6a767`

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

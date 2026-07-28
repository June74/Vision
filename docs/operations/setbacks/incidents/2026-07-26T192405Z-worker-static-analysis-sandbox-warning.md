# SB-20260726-192405-worker-static-analysis-sandbox-warning: Worker static analysis hit sandbox boundary

- **Status:** closed
- **First observed:** 2026-07-26T19:24:05.647183Z
- **Last observed:** 2026-07-28T02:21:26.5488258Z
- **Phase/task:** Preview database role probe Task 1 full gate
- **Environment:** Local managed sandbox Worker test pool
- **Version/commit:** Uncommitted Task 2 worktree based on `ff6a767`

## Symptom

The full Worker test gate emitted repeated static-analysis access warnings before all Worker assertions passed.

## Impact

No test failed, but warning noise could be mistaken for a product defect unless final exit evidence is recorded separately.

## Reproduction conditions

Run the full Worker test project while its optional static analyzer attempts to
traverse beyond the allowed workspace boundary.

## Safe evidence

The warnings named only local source paths and access denial. The Worker test
process continued and returned a successful exit.

## Attempts and outcomes

- The warning repeated during static export analysis.
- All 75 Worker assertions passed.
- The complete `pnpm check` process exited zero after documentation, build, and
  security validation also passed.

## Cause classification

- **Confirmed cause:** Optional static analysis attempted filesystem traversal
  denied by the managed sandbox.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** Worker runtime behavior and application tests were not
  failing.

## Correction and prevention

- **Correction:** Preserved the warnings alongside the distinct successful test
  and process exits.
- **Prevention:** Judge this known environment warning separately from Worker
  assertion results and retain exact final exit evidence.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Latest full gate result: 694 unit/integration passed with one skip, 179 contract
passed, 75 Worker passed, and the overall command exited zero after build,
documentation, typecheck, and security validation also passed.

## Recurrence history

- 2026-07-26T19:24:05.647183Z: First observed.
- 2026-07-26T23:14:06Z: Recurred during the normal-schedule release-gate
  retry. All 75 Worker tests and the complete repository gate passed.
- 2026-07-26T23:40:19Z: Recurred during the AI Gateway operator-path gate.
  All 75 Worker tests and the complete repository gate passed.
- 2026-07-27T00:22:25Z: Recurred while the AI Gateway identifier Worker suite
  started. The enclosing command timed out before final Worker assertion
  evidence, so the suite is rerun independently.
- 2026-07-27T00:24:17Z: The segmented retry emitted the same warning and all 75
  Worker assertions passed with a zero exit.
- 2026-07-27T01:40:05Z: The fresh Phase B Worker gate emitted the same
  sandbox-only analyzer warnings and passed all 75 assertions with a zero exit.
- 2026-07-27T02:38:35Z: The unchanged-key restore baseline emitted the same
  sandbox-only analyzer warnings and passed all 75 Worker assertions; the
  complete repository gate and all 29 browser tests exited successfully.
- 2026-07-27T03:37:34Z: The Task 2 Worker gate used a task-local
  `XDG_CONFIG_HOME`, emitted the same sandbox-only analyzer warning, and passed
  all 75 Worker assertions with a zero exit.
- 2026-07-27T03:43:22Z: The fresh Task 2 completion rerun used the same local
  configuration boundary, repeated the known warning, and passed all 75
  Worker assertions with a zero exit.
- 2026-07-27T04:56:36Z: The Task 3 Worker gate used the task-local
  configuration boundary, repeated the same sandbox-only analyzer warning,
  and passed all 75 assertions with a zero exit.
- 2026-07-27T19:43:48Z: The corrected full Worker suite repeated the same
  sandbox-only analyzer warning and passed all 75 assertions with a zero exit.
- 2026-07-27T21:10:21Z: The listener-first execution baseline repeated the
  same sandbox-only analyzer warning and passed all 75 Worker assertions; the
  complete check exited zero.
- 2026-07-28T01:00:14.2508518Z: Listener-first restore retry Task 2
  verification repeated the same sandbox-only analyzer warning. The complete
  repository check exited zero: 694 unit/integration tests passed with one
  skip, 179 contract tests passed, 75 Worker tests passed, and build,
  documentation, typecheck, and security validation passed. No provider state
  or private data was affected.
- 2026-07-28T02:21:26.5488258Z: Preview role-probe Task 1 verification
  repeated the same sandbox-only analyzer warning and passed all 75 Worker
  assertions. The enclosing gate later stopped at documentation coverage, not
  Worker behavior.

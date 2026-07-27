# SB-20260726-192405-worker-static-analysis-sandbox-warning: Worker static analysis hit sandbox boundary

- **Status:** closed
- **First observed:** 2026-07-26T19:24:05.647183Z
- **Last observed:** 2026-07-27T01:40:05Z
- **Phase/task:** Phase B deployment fix verification
- **Environment:** Local managed sandbox Worker test pool
- **Version/commit:** `codex/phase-b-foundation`

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

Latest full gate result: 617 unit/integration passed with one skip, 179 contract
passed, 75 Worker passed, and the overall command exited zero.

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

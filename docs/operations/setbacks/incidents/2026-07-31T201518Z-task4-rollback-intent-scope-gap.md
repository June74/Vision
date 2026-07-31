# SB-20260731-201518-task4-rollback-intent-scope-gap: Task 4 allowlist omitted the exact candidate-intent consumer

- **Status:** closed
- **First observed:** 2026-07-31T20:15:18.1495782Z
- **Last observed:** 2026-07-31T20:40:33.6641273Z
- **Phase/task:** Phase B Task 4 workflow/window integration
- **Environment:** Local source and live-call-path inspection
- **Version/commit:** 2cf0ff1 plus concurrent Task 4 edits

## Symptom

Task 4 adds one AI-only generated binding, but the frozen Task 4 path allowlist
omits `scripts/validate-preview-rollback-lifecycle.ts`. That existing Task 3
boundary exact-reads and revalidates candidate acceptance bindings for the
immutable v2 candidate intent.

## Impact

Without a bounded integration repair, AI candidate intent generation or
verification will reject the legitimate scheduled-at binding or omit it from
the immutable rollback proof. No failing live mutation has occurred.

## Cause classification

- **Confirmed cause:** The frozen plan accounted for candidate generation and
  deploy-config validation but not the downstream exact candidate-intent
  consumer introduced by accepted Task 3 hardening.
- **Hypotheses:** None remaining.
- **Known exclusions:** No provider, network, database, secret, workflow,
  staging state, or commit changed during discovery.

## Correction and prevention

- **Correction:** Add the scheduled-at field to the AI-only exact acceptance
  binding shape, its validation/reconstruction path, focused rollback tests,
  and matching references without changing non-AI intent shapes.
- **Prevention:** Trace every exact generated-config consumer when adding a
  binding, even if the frozen source list predates the consumer hardening.
- **Owner:** Codex.
- **Next diagnostic step:** Reproduce the rejection in the focused rollback
  lifecycle suite after the primary Task 4 lanes settle, then implement the
  smallest path-scoped repair.

The repair is verified by 53 passing focused rollback/workflow tests plus
passing TypeScript and documentation coverage. AI intent uses exact v3 while
historical v1/v2, non-AI v2, and downstream proof versions remain unchanged.

## Recurrence history

- 2026-07-31T20:15:18.1495782Z: Confirmed by tracing generated candidate vars
  into the accepted v2 candidate-intent parser and validator.
- 2026-07-31T20:36:50.0966198Z: The first post-implementation focused run
  remained red. Output was captured and not rendered; the repair is contained
  pending safe failure-category classification.
- 2026-07-31T20:40:33.6641273Z: Closed after normalizing the domain parser's
  failure into the lifecycle category and passing focused, TypeScript, and
  documentation verification.

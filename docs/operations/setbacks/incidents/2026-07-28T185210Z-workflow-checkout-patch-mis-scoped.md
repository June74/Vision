# SB-20260728-185210-workflow-checkout-patch-mis-scoped: Workflow checkout patch was mis-scoped

- **Status:** closed
- **First observed:** 2026-07-28T18:52:10.388684Z
- **Last observed:** 2026-07-28T18:52:15.8199394Z
- **Phase/task:** Phase B acceptance instrumentation Task 1 observer implementation
- **Environment:** Local Phase B worktree
- **Version/commit:** `f3873fe` plus uncommitted Task 1 changes

## Symptom

A generic checkout patch duplicated the verify ref instead of adding the immutable ref to the observer checkout.

## Impact

The malformed workflow remained only in the local uncommitted worktree and was detected by immediate bounded inspection. No workflow, deployment, provider, or private state changed.

## Reproduction conditions

Apply a context-light patch to one of several identical checkout steps.

## Safe evidence

Bounded line inspection showed two consecutive `with` mappings in the verify
checkout and no `with` mapping in the observer checkout.

## Attempts and outcomes

- Immediate bounded inspection detected the duplicate before any verification
  or commit.
- A job-specific patch removed the duplicate and added the supplied ref only
  to the observer checkout.

## Cause classification

- **Confirmed cause:** The patch context matched the first identical checkout
  step instead of the observer job's checkout step.
- **Hypotheses:** None.
- **Rejected hypotheses:** The approved workflow structure was not ambiguous
  after including the `tail` job context.
- **Known exclusions:** No workflow run, deployment, provider, or private state
  changed.

## Correction and prevention

- **Correction:** Patch checkout steps with their containing job context.
- **Prevention:** Inspect every repeated workflow anchor immediately after
  editing and before running tests.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The focused workflow test verifies the observer checkout ref, separate
concurrency, non-mutating command surface, and bounded timeouts.

## Recurrence history

- 2026-07-28T18:52:10.388684Z: First observed.

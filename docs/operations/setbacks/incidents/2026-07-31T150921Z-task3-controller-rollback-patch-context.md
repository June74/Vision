# SB-20260731-150921-task3-controller-rollback-patch-context: Rollback lifecycle patch missed its exact function context

- **Status:** closed
- **First observed:** 2026-07-31T15:09:21.7768683Z
- **Last observed:** 2026-07-31T15:30:50.5669463Z
- **Phase/task:** Phase B Task 3 final controller review repair
- **Environment:** Shared worktree; rollback lifecycle production patch
- **Version/commit:** 73191b7 plus unstaged TDD repairs and setback records

## Symptom

A controller production patch expected a local type-cast context that no longer
matched the current rollback function, so exact patch verification failed.

## Impact

No part of that rollback patch applied. Earlier controller constant, deadline,
and dispatch edits remain on disk and must be integrated carefully.

## Reproduction conditions

Apply the multi-hunk rollback change using inferred context after nearby
parallel test and contract edits have changed the local function shape.

## Safe evidence

Only the patch-context category and bounded function range were reported. No
source payload, URI, credential, protected identifier, provider value, runtime
stream, argument, environment value, or external action occurred.

## Attempts and outcomes

- The failed patch was atomic.
- Existing earlier controller edits were not rolled back or overwritten.

## Cause classification

- **Confirmed cause:** Stale local patch context.
- **Hypotheses:** None required before an exact function-local correction.
- **Rejected hypotheses:** No TypeScript or runtime finding is implied by the
  patch failure itself.
- **Known exclusions:** Resolver, restore, Git, provider, and external state
  were untouched by the failed patch.

## Correction and prevention

- **Correction:** Re-read only the exact rollback function range and apply
  smaller uniquely anchored changes, including the nullable close contract.
- **Prevention:** Avoid multi-hunk patches across actively evolving shared
  integration points.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Complete the exact rollback function and port-type
  edits, then run the controller RED suite through the direct test binary.

## Verification and related work

Exact function-local patches completed rollback reconciliation and fresh
workflow-aware deadlines. Controller and combined repository verification pass.

## Recurrence history

- 2026-07-31T15:09:21.7768683Z: First observed and contained with zero change
  from the failed patch.
- 2026-07-31T15:30:50.5669463Z: Closed after the smaller anchored repair and
  all controller/integration gates passed.

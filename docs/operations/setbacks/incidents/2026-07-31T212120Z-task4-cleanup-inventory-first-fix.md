# SB-20260731-212120-task4-cleanup-inventory-first-fix: Task 4 cleanup inventory repair retained stale representative text and order

- **Status:** closed
- **First observed:** 2026-07-31T21:21:20.8759029Z
- **Last observed:** 2026-07-31T21:23:03.5485336Z
- **Phase/task:** Phase B Task 4 full-check cleanup-contract repair
- **Environment:** Local security test
- **Version/commit:** 2cf0ff1 plus uncommitted Task 4 implementation

## Symptom

The first cleanup-test repair updated the active pattern and expected paths but
left one representative fixture on the old selector count. It also inserted
the two new reference paths in an order different from the deterministic scan.

## Impact

The focused cleanup test still failed two assertions. No product source or
external state changed.

## Cause classification

- **Confirmed cause:** The repair changed the classifier but not its separate
  representative fixture, and reconstructed list order instead of following
  the actual stable scan order.
- **Hypotheses:** None remaining.
- **Known exclusions:** No provider, network, database, secret, workflow,
  staging state, or commit changed.

## Correction and prevention

- **Correction:** Update the representative to the current eleven-selector
  sentence and place new simple/technical paths in exact scan order.
- **Prevention:** Search all literal copies when updating a classifier marker
  and copy deterministic order from the safe path-only diff.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Recurrence history

- 2026-07-31T21:21:20.8759029Z: First repair remained RED with two assertions.
- 2026-07-31T21:23:03.5485336Z: Closed after the current representative and
  deterministic reference order passed all eight cleanup-contract tests with
  empty captured error output.

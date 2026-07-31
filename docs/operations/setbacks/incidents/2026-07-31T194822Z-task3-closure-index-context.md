# SB-20260731-194822-task3-closure-index-context: Task 3 closure patch assumed nonadjacent index rows were contiguous

- **Status:** closed
- **First observed:** 2026-07-31T19:48:22.4653742Z
- **Last observed:** 2026-07-31T20:25:06.8283361Z
- **Phase/task:** Phase B Task 3 review-incident closure
- **Environment:** Local setback-ledger edit
- **Version/commit:** 6549b66 plus accepted Task 3 implementation/report commits

## Symptom

A multi-file closure patch represented two older setback-index rows as one
contiguous block even though other rows separate them. Patch verification
failed atomically.

## Impact

No incident or index file changed in the failed attempt. Task 3 acceptance
evidence is unaffected; only ledger closure was delayed.

## Cause classification

- **Confirmed cause:** The patch context was assembled from individually found
  rows without preserving their actual index separation.
- **Hypotheses:** None remaining.
- **Known exclusions:** No implementation, provider, network, environment,
  secret, staging, or commit changed.

## Correction and prevention

- **Correction:** Update each exact index row in a separate patch hunk and keep
  incident-file edits independent.
- **Prevention:** Never combine nonadjacent ledger rows into one context block.
- **Owner:** Codex.
- **Next diagnostic step:** None; the exact rows are known.

## Recurrence history

- 2026-07-31T19:48:22.4653742Z: Observed, corrected, and closed before any
  partial write.
- 2026-07-31T20:25:06.8283361Z: Recurred when two nonadjacent setback-index
  rows were ordered differently from their multi-file patch hunks. The patch
  failed atomically. Closed by returning to independent incident and index
  updates.

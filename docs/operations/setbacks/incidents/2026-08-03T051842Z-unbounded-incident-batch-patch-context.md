# SB-20260803-051842-unbounded-incident-batch-patch-context: Incident batch patches used stale context

- **Status:** closed
- **First observed:** 2026-08-03T05:18:42.6108879Z
- **Last observed:** 2026-08-03T17:53:34.9839818Z
- **Phase/task:** Phase B deployment setback maintenance
- **Environment:** Local setback ledger
- **Version/commit:** Candidate `c1911f8`; no mutation associated

## Symptom

Two multi-file setback patches failed because expected incident/index sentences
did not match the current files.

## Impact

Both failed patches made no changes. Operational recovery continued, and no
runtime, provider, credential, database, calendar, or key state changed.

## Safe evidence

The patch tool returned only unmatched local ledger text. It contained no
secret, identifier, URL, or protected content.

## Cause classification

- **Confirmed cause:** Batch patches were composed from summarized context
  instead of fresh exact bounded reads of every target.
- **Known exclusions:** No source or external state was partially changed by
  either failed patch.

## Correction and prevention

- **Correction:** Read the exact incident and index tail, then apply small
  independent patches.
- **Prevention:** For concurrently growing setback records, reread every exact
  target immediately before patching and separate additions from updates.
- **Owner:** Codex.

## Verification and related work

The smaller exact patches succeeded. This record closes both maintenance
failures.

## Recurrence history

- 2026-08-03T05:18:42.6108879Z: First batch patch failed without changes.
- 2026-08-03T05:20:43.7132920Z: Second batch patch failed; bounded reread and
  smaller patches corrected the process.
- 2026-08-03T17:53:34.9839818Z: Controller-repair closeout again grouped
  nonadjacent INDEX rows into one patch hunk. The patch failed atomically and
  changed nothing; closeout resumed with one exact row per hunk.

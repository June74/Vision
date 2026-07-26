# SB-20260726-201749-incorrect-live-migration-range: Initial live migration range was incomplete

- **Status:** closed
- **First observed:** 2026-07-26T20:17:49.341717Z
- **Last observed:** 2026-07-26T20:18:31.4381230Z
- **Phase/task:** Phase B live database recovery
- **Environment:** Live preview schema inspection
- **Version/commit:** Repository migrations 0004 through 0009

## Symptom

The first approval request named only migrations 0007 through 0009 even though the confirmed missing-table set also maps to migrations 0004 and 0005.

## Impact

No migration ran, but the approval scope had to be corrected before any live database change.

## Reproduction conditions

Infer migration state from only a subset of missing tables without checking
each migration's table and column signatures.

## Safe evidence

The missing-table query mapped to migrations 0004, 0005, 0007, 0008, and 0009.
A second read-only column-signature query showed that migrations 0004 through
0007 are all absent, establishing the dependency-safe range 0004 through 0009.

## Attempts and outcomes

- The first approval wording named only migrations 0007 through 0009.
- No migration ran.
- Exact migration files and live column signatures were compared read-only.

## Cause classification

- **Confirmed cause:** The first scope was inferred before mapping every
  missing table and migration signature.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No live schema or data changed.

## Correction and prevention

- **Correction:** Withdraw the narrow range and request approval for the exact
  dependency-safe sequence 0004 through 0009.
- **Prevention:** Map all absent tables and signature columns to numbered
  migrations before describing a live migration scope.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Await approval, then apply the reviewed sequence in
  order and verify all signatures.

## Verification and related work

The final required sequence is confirmed as 0004, 0005, 0006, 0007, 0008, and
0009.

## Recurrence history

- 2026-07-26T20:17:49.341717Z: First observed.

# SB-20260731-201137-task4-ledger-concurrent-context: Task 4 ledger patch raced a new index row

- **Status:** closed
- **First observed:** 2026-07-31T20:11:37.6525266Z
- **Last observed:** 2026-07-31T20:11:37.6525266Z
- **Phase/task:** Phase B Task 4 setback-ledger maintenance
- **Environment:** Shared local worktree
- **Version/commit:** 2cf0ff1 plus concurrent Task 4 edits

## Symptom

The first attempt to record the diagnostics documentation incident included a
previously read first index row. A concurrent lane inserted a newer row before
the patch ran, so the atomic patch found no matching context.

## Impact

No ledger or implementation file changed in the failed attempt. Durable
incident logging was delayed by one retry.

## Cause classification

- **Confirmed cause:** The patch unnecessarily coupled new-file creation to a
  mutable neighboring index row.
- **Hypotheses:** None remaining.
- **Known exclusions:** No source, test, provider, environment, network,
  staging state, or commit changed.

## Correction and prevention

- **Correction:** Anchor the index insertion only to its stable table header.
- **Prevention:** While lanes are concurrent, do not include the current first
  data row in index insertion context.
- **Owner:** Codex.
- **Next diagnostic step:** None; retry against the stable header.

## Recurrence history

- 2026-07-31T20:11:37.6525266Z: Observed, corrected, and closed before any
  partial write.

# SB-20260727-201732-neon-result-grid-not-table-ancestor: Neon result header had no table ancestor

- **Status:** closed
- **First observed:** 2026-07-27T20:17:32Z
- **Last observed:** 2026-07-27T20:28:07Z
- **Phase/task:** Phase B restore Task 4 diagnosis
- **Environment:** Neon SQL Editor result grid
- **Version/commit:** normal runtime ref `40872a5`

## Symptom

The retained-target aggregate query returned all five expected column headers,
but the first parser found no enclosing HTML table or grid ancestor.

## Impact

The SQL query itself succeeded. The five closed result values were not yet read
because Neon renders the result through a virtualized structure.

## Cause classification

- **Confirmed cause:** The apparent header matches were SQL editor tokens, and
  Neon exposes only a one-row result indicator in the accessible DOM; the
  virtual result values are not DOM cells.
- **Known exclusions:** There was no SQL alert, and the editor reported one
  result row.

## Correction and prevention

- **Correction:** Inspect the verified header's safe ancestor roles and
  section-local cells, then parse only the one result row.
- **Prevention:** Do not assume provider result grids use native table
  ancestry.

## Verification and related work

The browser result renderer could not provide cell values. The same read-only
query was run through the private direct database path and returned one exact
validated row: all 29 authoritative tables were present, 13 were non-empty,
the aggregate contained 51 rows, events contained zero rows, and the
database-owned attestation remained valid.

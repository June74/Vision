# SB-20260802-042601-task8-neon-count-result-shape: Neon count parser rejected the row-number column

- **Status:** closed
- **First observed:** 2026-08-02T04:26:01.7336240Z
- **Last observed:** 2026-08-02T05:32:26.8942986Z
- **Phase/task:** Phase B Task 8 signed-in reconnect-state diagnosis
- **Environment:** Signed-in Neon SQL editor
- **Version/commit:** `4420f6d`

## Symptom

A read-only count query succeeded and produced one result table, but the first
strict parser rejected the table because two cells contained zero-or-one shaped
text instead of exactly one.

## Impact

The safe source-row count was not accepted on the first read. No Google
subject, database value, connection information, credential, or provider
identifier was returned, and no database or provider state changed.

## Reproduction conditions

Parse a Neon result table by counting every zero-or-one text cell without first
excluding the presentation-only row-number column.

## Safe evidence

- Exactly one result table was present.
- The table had two header cells and two data cells.
- Two cells matched the closed zero-or-one text shape.
- No query error was present.

## Attempts and outcomes

- The query itself completed without an error signal.
- The first parser failed closed and returned no value.
- A structural-only check identified Neon’s extra presentation column without
  returning any cell content.

## Cause classification

- **Confirmed cause:** The parser treated the presentation-only row-number cell
  as a candidate result value.
- **Hypotheses:** None.
- **Rejected hypotheses:** The SQL query did not fail, and the result table was
  not absent or duplicated.
- **Known exclusions:** No subject, email, token, secret, database URL, key,
  callback value, or provider identifier was returned.

## Correction and prevention

- **Correction:** Resolve the exact header index for `source_row_count`, then
  admit only the matching body cell when it is the single integer `0` or `1`.
- **Prevention:** Parse provider result tables by named-column position rather
  than by value shape across presentation columns.
- **Owner:** Codex.
- **Next diagnostic step:** Rerun the closed named-column parser and record only
  the admitted count.

## Verification and related work

The named-column parser admitted exactly one safe source-row count and returned
no database content. A follow-up private result query produced exactly one
result row in the user's Neon tab without the value entering tool output.

## Recurrence history

- 2026-08-02T04:26:01.7336240Z: First observed and contained before any raw
  result text left the browser boundary.
- 2026-08-02T04:27:02.8071644Z: Closed after the named-column parser admitted
  one source row and the prepared private query produced one result row without
  returning its value.
- 2026-08-02T05:32:26.8942986Z: Recurred when the reconnect-state parser
  initially required exactly seven cells, while Neon added a presentation-only
  row-number column and rendered database Booleans in their compact form. The
  parser failed closed before returning data. A named-column parser then
  admitted only fixed Booleans and allowlisted categories; no row, identifier,
  token, event, credential, or key value left the browser boundary.

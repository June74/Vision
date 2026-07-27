# SB-20260726-201358-neon-sql-editor-textarea-hidden: Neon SQL editor textarea was not fillable

- **Status:** closed
- **First observed:** 2026-07-26T20:13:58.409352Z
- **Last observed:** 2026-07-27T18:43:04Z
- **Phase/task:** Phase B live database diagnostics
- **Environment:** Signed-in Neon SQL editor
- **Version/commit:** Live preview database diagnosis

## Symptom

The browser tool found a textarea but timed out trying to fill it because it was not the visible editor control.

## Impact

The read-only schema query was not submitted and no database state changed.

## Reproduction conditions

Select the editor's hidden textarea instead of its visible content-editable
CodeMirror surface.

## Safe evidence

The initial fill timed out before submission. The visible content-editable
control accepted the same read-only schema query.

## Attempts and outcomes

- The hidden textarea fill failed without submitting SQL.
- The visible content-editable control was discovered.
- Read-only table and column checks then completed.

## Cause classification

- **Confirmed cause:** Neon renders a hidden textarea plus a separate visible
  CodeMirror editing surface.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** The failed attempt did not query or modify the
  database.

## Correction and prevention

- **Correction:** Filled the visible content-editable editor.
- **Prevention:** Confirm visibility/editor surface before filling embedded
  code editors.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The safe schema diagnosis completed and returned only fixed table/column
evidence.

## Recurrence history

- 2026-07-26T20:13:58.409352Z: First observed.
- 2026-07-27T18:43:04Z: Recurred during the retained-branch emptiness
  re-attestation. The hidden textarea timed out before submission, so no query
  ran and no database state changed. The documented visible content-editable
  path was selected.

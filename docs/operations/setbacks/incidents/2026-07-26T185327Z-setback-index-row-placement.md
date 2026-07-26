# SB-20260726-185327-setback-index-row-placement: Setback index row appended outside table

- **Status:** closed
- **First observed:** 2026-07-26T18:53:27.936691Z
- **Last observed:** 2026-07-26T18:53:27.936691Z
- **Phase/task:** Phase B release operations
- **Environment:** Local Codex workspace
- **Version/commit:** `codex/phase-b-foundation`

## Symptom

The setback helper appended a valid incident row after a trailing documentation section instead of within the index table.

## Impact

The incident remained trackable but the index layout was malformed until manually repaired.

## Reproduction conditions

Run the helper against an index that contains a table followed by a
`Legacy history` section.

## Safe evidence

The helper uses append mode for every row and does not locate the end of the
Markdown table.

## Attempts and outcomes

- The helper created both incident files correctly but placed both new rows
  after the trailing documentation section.
- The rows were moved into the table manually.

## Cause classification

- **Confirmed cause:** `new_setback.py` unconditionally appends to the end of
  `INDEX.md`.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** Incident content and privacy validation were unaffected.

## Correction and prevention

- **Correction:** Moved the generated rows into the index table and restored the
  document structure.
- **Prevention:** Update the helper to insert after the last table row instead of
  appending at end of file.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The repaired index now keeps one contiguous table followed by the legacy link.
The global helper was patched and a temporary end-to-end run verified that a
new row is inserted before the trailing `Legacy history` section.

## Recurrence history

- 2026-07-26T18:53:27.936691Z: First observed.

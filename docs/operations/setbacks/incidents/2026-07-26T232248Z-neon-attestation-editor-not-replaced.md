# SB-20260726-232248-neon-attestation-editor-not-replaced: Neon attestation editor was not replaced

- **Status:** contained
- **First observed:** 2026-07-26T23:22:48Z
- **Last observed:** 2026-07-27T22:10:58Z
- **Phase/task:** Listener-first restore retry Task 2
- **Environment:** Neon SQL editor on the disposable schema-only branch
- **Version/commit:** `d7da15d`

## Symptom

The keyboard select-all and paste sequence appended the restore-attestation SQL
to an earlier editor buffer instead of replacing that buffer.

## Impact

Execution was stopped. No SQL ran and no disposable-branch database state
changed.

## Reproduction conditions

Focus the CodeMirror contenteditable after a previously retained editor
session, then rely on browser-level select-all and paste to replace the buffer.

## Safe evidence

The staged script expected 1,127 characters, while copy-back returned 12,652
characters. No SQL text, branch identifier, or connection detail was printed.

## Attempts and outcomes

- Keyboard replacement did not produce an exact buffer.
- The mandatory copy-back equality check prevented execution.
- The recovery path uses direct contenteditable replacement, followed by a
  second exact copy-back comparison.
- The final corrected submission selected 1,325 characters against an expected
  4,166-character transaction. The selected text did not match the editor or
  the reviewed source, so execution was not attempted.

## Cause classification

- **Confirmed cause:** The browser-level select-all did not select the complete
  retained CodeMirror document.
- **Hypotheses:** Focus remained within one editor selection scope rather than
  the whole document.
- **Rejected hypotheses:** The SQL was not executed and the database was not
  modified.
- **Known exclusions:** No secret or SQL body appeared in captured output.

## Correction and prevention

- **Correction:** Replace the contenteditable directly and require exact
  equality before enabling execution.
- **Prevention:** Never infer editor replacement from visible length; always
  copy the full buffer back and compare it byte-for-byte with the reviewed
  source.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** In a separately authorized diagnostic, determine
  which browser-local CodeMirror API can prove the full model selection without
  exposing SQL text.

## Verification and related work

Direct contenteditable replacement copied back exactly at 1,127 characters.
The attestation transaction then executed, and a separate assertion-only query
completed with one success line and zero query-error lines.

## Recurrence history

- 2026-07-26T23:22:48Z: First observed and contained before execution.
- 2026-07-26T23:40:19Z: Closed after exact replacement and an independent
  database assertion succeeded.
- 2026-07-27T18:44:27Z: Recurred during retained-branch emptiness
  re-attestation. The visible editor copy-back was 43 characters shorter than
  the reviewed query, so execution was blocked. No SQL ran and the direct
  replacement plus exact copy-back path remained mandatory.
- 2026-07-27T19:00:19Z: Closed after clipboard copy-back proved the complete
  editor buffer exactly before both the attestation transaction and the
  independent read-only ready check executed.
- 2026-07-27T22:10:58Z: Recurred during the final corrected listener-first
  clearing submission. Browser-local selection introspection exposed only
  1,325 of 4,166 expected characters, so the mandatory proof gate stopped the
  task before execution. No SQL or provider mutation occurred.

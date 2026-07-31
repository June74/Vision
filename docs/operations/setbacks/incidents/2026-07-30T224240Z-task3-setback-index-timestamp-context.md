# SB-20260730-224240-task3-setback-index-timestamp-context: Task 3 setback closure guessed the generated index timestamp

- **Status:** closed
- **First observed:** 2026-07-30T22:42:40.594828Z
- **Last observed:** 2026-07-30T22:42:40.594828Z
- **Phase/task:** Phase B live-acceptance closure Task 3 setback logging
- **Environment:** Local setback-ledger patch
- **Version/commit:** Task 3 repair working tree after `38bed3e`

## Symptom

An apply_patch closure attempted to match an inferred incident-index timestamp and failed verification because the generated row used a different exact timestamp.

## Impact

Only the bookkeeping patch failed; no implementation, test, provider, protected value, or external state changed.

## Reproduction conditions

Patch an auto-generated index row using an inferred fractional-second
timestamp instead of first reading the exact row.

## Safe evidence

Patch verification failed before any hunk was applied.

## Attempts and outcomes

- The inferred index timestamp did not match the generated timestamp.
- The exact incident files and index tail were read, then patched by literal
  context.

## Cause classification

- **Confirmed cause:** The patch guessed an auto-generated timestamp.
- **Hypotheses:** None.
- **Rejected hypotheses:** No ledger corruption or concurrent overwrite
  occurred.
- **Known exclusions:** No implementation, test, provider, protected value,
  external state, or Git mutation was involved.

## Correction and prevention

- **Correction:** Read generated index rows before constructing exact-context
  patches.
- **Prevention:** Never infer fractional-second timestamps from filenames.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The follow-up literal-context patch applied successfully.

## Recurrence history

- 2026-07-30T22:42:40.594828Z: First observed.

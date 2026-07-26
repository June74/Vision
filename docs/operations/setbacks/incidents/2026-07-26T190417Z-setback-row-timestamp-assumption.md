# SB-20260726-190417-setback-row-timestamp-assumption: Setback row timestamp was assumed

- **Status:** closed
- **First observed:** 2026-07-26T19:04:17.387008Z
- **Last observed:** 2026-07-26T19:04:17.387008Z
- **Phase/task:** Phase B release operations
- **Environment:** Local Phase B worktree
- **Version/commit:** `codex/phase-b-foundation`

## Symptom

A documentation patch assumed the incident row timestamp instead of reading its exact stored value, so verification rejected the patch.

## Impact

No file changed; closing the incident was delayed until the authoritative row was read.

## Reproduction conditions

Patch an index row using a manually copied timestamp without first reading the
row from `INDEX.md`.

## Safe evidence

The patch tool rejected the edit because the expected timestamp differed from
the stored value. It made no partial changes.

## Attempts and outcomes

- The first patch was rejected safely.
- The exact row was read from the index.
- A context-safe patch then closed both relevant incidents.

## Cause classification

- **Confirmed cause:** The edit used an assumed fractional timestamp rather than
  the incident's authoritative stored timestamp.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No project behavior or provider state changed.

## Correction and prevention

- **Correction:** Read the exact row and reapplied the edit using authoritative
  context.
- **Prevention:** Never hand-copy generated timestamps into patch context;
  inspect the target row immediately before editing.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Both incident rows and files were updated successfully after reading exact
context.

## Recurrence history

- 2026-07-26T19:04:17.387008Z: First observed.

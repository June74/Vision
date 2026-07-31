# SB-20260731-002956-wrangler-ledger-encoding-context: Wrangler setback update missed an encoding-sensitive context line

- **Status:** closed
- **First observed:** 2026-07-31T00:29:56.640284Z
- **Last observed:** 2026-07-31T00:29:56.640284Z
- **Phase/task:** Phase B live-acceptance closure Task 3 setback logging
- **Environment:** Local setback-ledger update
- **Version/commit:** Task 3 final bounded repair working tree

## Symptom

An apply_patch update matched the rendered em-dash text rather than the incident file exact encoding, so verification failed.

## Impact

The bookkeeping patch applied no hunks; implementation, tests, provider state, and protected values were unaffected.

## Reproduction conditions

Patch a previously rendered encoding-sensitive summary line instead of using
stable incident metadata and recurrence-history anchors.

## Safe evidence

Patch verification failed before applying any hunk.

## Attempts and outcomes

- The first patch changed nothing.
- The retry used only encoding-stable metadata and recurrence lines.

## Cause classification

- **Confirmed cause:** The rendered em-dash text did not match the file's exact
  stored encoding.
- **Hypotheses:** None.
- **Rejected hypotheses:** No concurrent edit or missing incident caused the
  mismatch.
- **Known exclusions:** No implementation, test, provider, protected value,
  network, Git history, or external state changed.

## Correction and prevention

- **Correction:** Update stable metadata and append the recurrence without
  matching the encoding-sensitive summary.
- **Prevention:** Avoid exact-context patches against mojibake-rendered lines.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The stable-context retry applied successfully.

## Recurrence history

- 2026-07-31T00:29:56.640284Z: First observed.

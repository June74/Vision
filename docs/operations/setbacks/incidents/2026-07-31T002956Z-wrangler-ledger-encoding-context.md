# SB-20260731-002956-wrangler-ledger-encoding-context: Wrangler setback update missed an encoding-sensitive context line

- **Status:** closed
- **First observed:** 2026-07-31T00:29:56.640284Z
- **Last observed:** 2026-08-02T17:57:18.310Z
- **Phase/task:** Phase B live-acceptance closure and reconnect-recovery bookkeeping
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
- 2026-07-31T20:07:23.9884666Z: Recurred when the Task 4 diagnostics lane
  matched rendered encoding instead of stable metadata while updating the
  Wrangler log-path incident. The patch applied nothing; this stable-context
  update closed the bookkeeping recurrence.
- 2026-08-02T02:53:38.1616357Z: Recurred when the Task 8 readiness report was
  patched against a rendered dash sequence instead of stable ASCII context.
  Verification rejected the patch before any hunk applied. The retry appends
  through an encoding-stable file boundary and keeps the evidence edit local.
- 2026-08-02T17:07:37.4969923Z: Recurred when the reconnect progress section
  matched an encoding-sensitive rendered dash line at the end of the ignored
  ledger. Verification rejected the patch before any hunk applied. The retry
  uses the final stable ASCII continuation line and changes no tracked or
  external state.
- 2026-08-02T17:57:18.310Z: Recurred while the reconnect-focused verification
  tried to replace a previously rendered em-dash summary. Patch verification
  rejected every hunk before applying anything. The retry read the file as
  UTF-8 and used its exact stored punctuation; the ledger update then applied
  cleanly without changing implementation or external state.

# SB-20260727-184659-neon-result-scroll-timeout: Neon SQL result scroll timed out

- **Status:** closed
- **First observed:** 2026-07-27T18:46:59Z
- **Last observed:** 2026-07-27T19:00:19Z
- **Phase/task:** Phase B restore Task 4 live retry
- **Environment:** Signed-in Neon SQL editor
- **Version/commit:** `9bbc4be`

## Symptom

A browser scroll command timed out while trying to inspect the read-only query
result area.

## Impact

The result area was not inspected through that path. No additional SQL ran,
no database write occurred, and no credential or provider setting changed.

## Reproduction conditions

Use the page-level browser scroll gesture in the current embedded SQL editor.

## Safe evidence

The browser returned a fixed scroll timeout category. No page content or
private value was copied into the log.

## Attempts and outcomes

- The single scroll gesture timed out.
- Repeating the same gesture was rejected.
- The recovery path uses scoped DOM result controls and safe fixed signals.

## Cause classification

- **Confirmed cause:** The browser scroll gesture did not complete within its
  bounded control window.
- **Hypotheses:** The embedded editor intercepted or delayed the page gesture.
- **Rejected hypotheses:** No database or provider mutation was initiated.
- **Known exclusions:** No secret, branch identifier, URL, or query result was
  exposed.

## Correction and prevention

- **Correction:** Stop using the page-level scroll gesture and inspect only
  scoped result controls.
- **Prevention:** Prefer a unique result container or fixed result signal over
  coordinate or page-level scrolling in embedded provider editors.
- **Owner:** Codex.
- **Next diagnostic step:** Verify the read-only result through a scoped,
  value-safe control.

## Verification and related work

Scoped snapshot markers exposed the fixed SQL error category and later the
fixed target-ready result without any scroll gesture or private result value.

## Recurrence history

- 2026-07-27T18:46:59Z: First observed and contained.
- 2026-07-27T19:00:19Z: Closed after scoped result evidence replaced the
  failed scroll path.

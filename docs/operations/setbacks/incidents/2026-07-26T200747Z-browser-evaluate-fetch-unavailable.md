# SB-20260726-200747-browser-evaluate-fetch-unavailable: Browser evaluation did not expose fetch

- **Status:** closed
- **First observed:** 2026-07-26T20:07:47.009596Z
- **Last observed:** 2026-08-02T05:32:26.8942986Z
- **Phase/task:** Phase B live diagnostics acceptance
- **Environment:** Chrome-control evaluation sandbox
- **Version/commit:** Live preview acceptance

## Symptom

A page-evaluation attempt failed locally because the evaluation sandbox had no fetch function.

## Impact

No request or state change occurred; safe live diagnostic extraction paused for a supported browser path.

## Reproduction conditions

Call `fetch` inside the browser tool's isolated page-evaluation function.

## Safe evidence

The evaluation failed locally before making a request.

## Attempts and outcomes

- The unsupported evaluation made no request.
- The rendered UI supplied the safe unavailable state.
- A separate read-only Neon schema query established the database cause.

## Cause classification

- **Confirmed cause:** The active browser evaluation sandbox did not expose a
  fetch function.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No application, provider, or database state changed.

## Correction and prevention

- **Correction:** Used rendered safe UI plus provider-native read-only tools.
- **Prevention:** Do not assume page network APIs exist inside browser
  evaluation; prefer visible UI or an explicitly supported request method.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The live database mismatch was diagnosed without the unsupported path.

## Recurrence history

- 2026-07-26T20:07:47.009596Z: First observed.
- 2026-08-02T05:17:24.3667063Z: Recurred during Task 8 owner-authenticated
  state reconciliation. The isolated evaluation closure again had no `fetch`
  function, so it failed before any request. No response, session field,
  account data, provider value, credential, or application state was read or
  changed; the supported rendered-state path remains the correction.
- 2026-08-02T05:32:26.8942986Z: A bounded capability check confirmed the same
  evaluation sandbox also exposes no page network-request primitive. No
  request was attempted from that closure. The corrected signed-in Neon query
  returned only the approved closed diagnostic shape.

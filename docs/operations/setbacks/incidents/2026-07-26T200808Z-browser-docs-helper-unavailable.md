# SB-20260726-200808-browser-docs-helper-unavailable: Browser documentation helper was unavailable

- **Status:** closed
- **First observed:** 2026-07-26T20:08:08.449243Z
- **Last observed:** 2026-07-26T20:20:58.8180152Z
- **Phase/task:** Phase B live diagnostics acceptance
- **Environment:** Active Chrome-control object
- **Version/commit:** Live preview acceptance

## Symptom

The assumed browser documentation search helper was not exposed by the active Chrome control object.

## Impact

No application or provider state changed; capability discovery required one additional local step.

## Reproduction conditions

Call an assumed documentation-search property that is not present on the
active browser object.

## Safe evidence

The browser object exposes tab and user control, not that documentation helper.

## Attempts and outcomes

- The unsupported helper call failed locally.
- Available top-level method names were inspected without private page data.
- Work continued through already-read skill guidance and supported controls.

## Cause classification

- **Confirmed cause:** The documentation helper belongs to a different browser
  surface and was not part of this active object.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No page, application, or provider state changed.

## Correction and prevention

- **Correction:** Used only methods exposed by the active Chrome object.
- **Prevention:** Inspect safe capability names before calling optional
  browser helpers.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Subsequent Chrome controls completed through supported tab and Playwright
methods.

## Recurrence history

- 2026-07-26T20:08:08.449243Z: First observed.

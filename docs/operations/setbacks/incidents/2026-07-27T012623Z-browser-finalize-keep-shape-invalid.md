# SB-20260727-012623-browser-finalize-keep-shape-invalid: Browser handoff shape was invalid

- **Status:** closed
- **First observed:** 2026-07-27T01:26:23Z
- **Last observed:** 2026-07-27T01:26:23Z
- **Phase/task:** Phase B dashboard handoff
- **Environment:** In-app browser controller
- **Version/commit:** `567aaae`

## Symptom

The browser finalize helper rejected raw tab identifiers and required entries
containing a tab plus status.

## Impact

No browser tab was finalized or closed. The intended Cloudflare and Neon
handoff pages remain open.

## Cause classification

- **Confirmed cause:** The finalize call used tab identifiers instead of the
  required handoff object shape.
- **Known exclusions:** No page navigation, form submission, or provider
  mutation occurred.

## Correction and prevention

- **Correction:** Use the controller's documented `{ tab, status }` entries.
- **Prevention:** Inspect the exact finalize schema before ending a browser
  session instead of relying on a remembered abbreviated form.

## Verification and related work

The corrected handoff kept the Cloudflare and Neon pages open and released the
unused Chrome session.

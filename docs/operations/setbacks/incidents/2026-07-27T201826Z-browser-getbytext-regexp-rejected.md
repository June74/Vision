# SB-20260727-201826-browser-getbytext-regexp-rejected: Browser getByText rejected a RegExp argument

- **Status:** closed
- **First observed:** 2026-07-27T20:18:26Z
- **Last observed:** 2026-07-27T20:18:26Z
- **Phase/task:** Phase B restore Task 4 diagnosis
- **Environment:** Connected Neon browser runtime
- **Version/commit:** normal runtime ref `40872a5`

## Symptom

A combined closed-signal query failed because this browser runtime rejected a
regular-expression argument passed to `getByText`.

## Impact

No signal counts were returned from that call. No SQL or provider state changed.

## Cause classification

- **Confirmed cause:** Runtime locator compatibility differs from the expected
  Playwright regular-expression surface.
- **Known exclusions:** Exact-string locator queries have already worked in the
  same session.

## Correction and prevention

- **Correction:** Use exact fixed-string candidates and role counts only.
- **Prevention:** Avoid regular-expression text locators in this connected
  browser runtime unless first proven by a bounded count query.

## Verification and related work

Exact-string completion-signal checks succeeded and found the one-row result
indicator with no alert. The result values themselves are not accessible
through the DOM and are handled by a separate incident.

# SB-20260726-225515-cloudflare-r2-route-redirect-assumption: Cloudflare R2 route redirect was not handled

- **Status:** closed
- **First observed:** 2026-07-26T22:55:15Z
- **Last observed:** 2026-07-26T22:55:15Z
- **Phase/task:** Phase B R2 backup acceptance
- **Environment:** Codex in-app browser control
- **Version/commit:** `ffb3c0a`

## Symptom

After opening the authenticated R2 bucket-list route, the follow-up lookup
searched for a tab whose final address exactly matched the requested address.
Cloudflare redirected the page, so that lookup returned no descriptor.

## Impact

The read-only inspection stopped before examining the redirected page. No
Cloudflare state changed and no provider identifier was printed.

## Reproduction conditions

Open a dashboard route that Cloudflare canonicalizes, then locate the resulting
tab by exact requested URL instead of by the tab handle returned by the browser.

## Safe evidence

The browser reported only that the absent descriptor had no `id`.

## Attempts and outcomes

- The exact-address lookup failed after the redirect.
- The recovery path reuses the tab handle or tab ID returned when the page was
  opened, independent of the canonical final address.

## Cause classification

- **Confirmed cause:** The diagnostic assumed the requested and final dashboard
  addresses would be identical.
- **Hypotheses:** Cloudflare canonicalized the R2 route to its current dashboard
  layout.
- **Rejected hypotheses:** The result does not establish that R2 or the bucket
  is unavailable.
- **Known exclusions:** No application code, provider configuration, or secret
  changed.

## Correction and prevention

- **Correction:** Reconnect using the returned browser tab handle or ID.
- **Prevention:** Treat provider dashboard redirects as normal and never use
  exact URL equality as the only tab-selection rule.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Inspect the opened tab through its returned handle
  using fixed safe counts.

## Verification and related work

The browser created the tab before the descriptor lookup failed.

## Recurrence history

- 2026-07-26T22:55:15Z: First observed and closed.

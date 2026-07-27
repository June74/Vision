# SB-20260727-003046-browser-current-url-helper-invalid: Browser current URL helper was invalid

- **Status:** closed
- **First observed:** 2026-07-27T00:30:46Z
- **Last observed:** 2026-07-27T00:30:46Z
- **Phase/task:** Phase B AI Gateway identity diagnostics
- **Environment:** Codex in-app browser control
- **Version/commit:** `ae8f30a`

## Symptom

A read-only route check treated the tab URL accessor as a callable value and
then failed URL parsing.

## Impact

The current route was not classified. No navigation, form, provider, or
repository state changed.

## Reproduction conditions

Call the connected tab's URL field with the wrong accessor shape and pass the
result to the URL parser.

## Safe evidence

The browser returned only a fixed invalid-URL error.

## Attempts and outcomes

- The read-only call failed before producing route content.
- The diagnostic switched to the already stored route string.

## Cause classification

- **Confirmed cause:** The current URL accessor was used with the wrong shape.
- **Hypotheses:** None.
- **Rejected hypotheses:** The error does not indicate a Cloudflare redirect or
  outage.
- **Known exclusions:** No provider URL or identifier was emitted.

## Correction and prevention

- **Correction:** Reuse the previously captured internal route value.
- **Prevention:** Avoid tab-level URL helper guesses; use known locator hrefs
  and fixed boolean comparisons.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The Cloudflare tab remained available and unchanged.

## Recurrence history

- 2026-07-27T00:30:46Z: First observed and closed.

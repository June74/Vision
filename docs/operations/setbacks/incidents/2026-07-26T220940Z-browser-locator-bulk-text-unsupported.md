# SB-20260726-220940-browser-locator-bulk-text-unsupported: Browser locator bulk text unsupported

- **Status:** closed
- **First observed:** 2026-07-26T22:09:40Z
- **Last observed:** 2026-07-26T22:09:40Z
- **Phase/task:** Phase B R2 backup acceptance
- **Environment:** Signed-in Cloudflare browser session
- **Version/commit:** `cab6d4d`

## Symptom

The browser locator did not expose the expected bulk `allInnerTexts` helper.

## Impact

No object name was read or printed and no Cloudflare state changed. The
content-safe object count was delayed by one probe.

## Reproduction conditions

Call the Playwright convenience helper on this constrained browser client.

## Safe evidence

The client returned a method-not-found error before reading link text.

## Attempts and outcomes

- The bulk helper was unavailable.
- The replacement counts links with supported per-element `innerText` calls and
  emits only the aggregate matching count.

## Cause classification

- **Confirmed cause:** The constrained browser locator surface implements only
  a subset of Playwright helpers.
- **Rejected hypotheses:** None.
- **Known exclusions:** No provider mutation or object-key disclosure occurred.

## Correction and prevention

- **Correction:** Iterate bounded locator elements through supported methods.
- **Prevention:** Prefer already-proven locator methods in constrained browser
  sessions.
- **Owner:** Codex.

## Verification and related work

Closed because the fallback is read-only and content-safe.

## Recurrence history

- 2026-07-26T22:09:40Z: First occurrence.

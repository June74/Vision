# SB-20260726-223545-cloudflare-account-id-in-selector-diagnostic: Cloudflare account ID in selector diagnostic

- **Status:** closed
- **First observed:** 2026-07-26T22:35:45Z
- **Last observed:** 2026-07-26T22:44:57Z
- **Phase/task:** Phase B AI Gateway acceptance
- **Environment:** Signed-in Cloudflare browser session
- **Version/commit:** `1862323`

## Symptom

An ambiguous exact-text click produced a browser strict-mode diagnostic that
included the Cloudflare account identifier inside an internal selector path.

## Impact

The identifier appeared once in tool output. No secret value, token, key,
database URL, provider request, or setting was changed. The identifier is not
copied into this incident or any evidence document.

## Reproduction conditions

Use a non-unique exact-text selector for `AI Gateway` while both the sidebar,
page link, and heading are present.

## Safe evidence

The browser reported three matches and included one provider-owned route in its
generated selector explanation.

## Attempts and outcomes

- The ambiguous click failed before navigation or mutation.
- The diagnostic output is not repeated, quoted, or persisted.
- All later Cloudflare navigation uses a unique semantic role and count check.

## Cause classification

- **Confirmed cause:** A text selector was used without first proving
  uniqueness on a dashboard whose generated selector embeds provider metadata.
- **Rejected hypotheses:** None.
- **Known exclusions:** OAuth secrets, tokens, database credentials, email,
  backup material, and provider request bodies were not exposed.

## Correction and prevention

- **Correction:** Use the unique `AI Gateway` navigation link by role.
- **Prevention:** On provider dashboards, count exact role-based targets before
  clicking; never allow strict-mode selector diagnostics to enumerate
  generated routes.
- **Owner:** Codex.
- **Next diagnostic step:** Confirm unique role-link count without emitting
  selector details.

## Verification and related work

The corrected role-link selector resolved exactly once and completed navigation
without another strict-mode diagnostic.

## Recurrence history

- 2026-07-26T22:35:45Z: First occurrence.
- 2026-07-26T22:44:57Z: Closed after unique role-based navigation succeeded
  without repeating provider metadata.

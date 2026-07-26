# SB-20260726-182445-cloudflare-browser-metadata-exposure: Cloudflare browser metadata exposure

- **Status:** contained
- **First observed:** 2026-07-26T18:24:45.816434Z
- **Last observed:** 2026-07-26T18:24:45.816434Z
- **Phase/task:** Phase B recovery
- **Environment:** Cloudflare preview dashboard controlled through the signed-in browser
- **Version/commit:** `d2aea64`

## Symptom

A browser-control summary returned private account metadata that was not needed for verification.

## Impact

Private metadata entered captured tool output and required containment.

## Reproduction conditions

Returning a complete provider tab title or selected snapshot lines to the tool
result instead of evaluating the needed fixed assertion inside the browser
runtime.

## Safe evidence

- Safe project evidence:
  `docs/operations/phase-b-implementation-setbacks.md`
- The first result exposed account metadata in a title.
- A later result exposed an opaque account path segment.
- No private values are reproduced in this incident.

## Attempts and outcomes

1. The initial tab projection returned the full title: private metadata leaked.
2. A snapshot filter returned matching provider lines: an opaque identifier
   remained in a path.
3. Fixed boolean assertions for R2 activation, bucket existence, privacy, and
   storage class returned no provider metadata.

## Cause classification

- **Confirmed cause:** Browser results were projected as provider-controlled
  strings instead of a closed safe result shape.
- **Hypotheses:** None open.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No OAuth code, token, secret, key, database URL, cookie,
  or secret value was returned or written to the repository.

## Correction and prevention

- **Correction:** Return only fixed booleans or explicitly sanitized safe
  categories from provider pages.
- **Prevention:** Use the global `setback-logger` privacy boundary and treat
  titles, URLs, and snapshot lines as private by default.
- **Owner:** Codex.
- **Next diagnostic step:** None while contained; reopen if any browser result
  returns uncontrolled provider text.

## Verification and related work

- Subsequent R2 checks returned only fixed state booleans.
- The private Standard bucket was created and verified without returning its
  account metadata.

## Recurrence history

- 2026-07-26T18:24:45.816434Z: Indexed after containment.
- 2026-07-26: Earlier recurrence in the same Phase B session was preserved in
  the legacy ledger without reproducing the private values.

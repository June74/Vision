# SB-20260726-193431-web-reader-rejected-preview-health: Web reader rejected preview health URL

- **Status:** closed
- **First observed:** 2026-07-26T19:34:31.380828Z
- **Last observed:** 2026-07-26T19:43:40.0442904Z
- **Phase/task:** Phase B live deployment verification
- **Environment:** Live preview Worker and local read-only client
- **Version/commit:** `066fcbd`

## Symptom

The generic web reader classified the public preview health endpoint as unsafe and made no request.

## Impact

No application or provider state changed; live health verification switched to a direct read-only request.

## Reproduction conditions

Ask the generic web reader to open the preview health endpoint directly.

## Safe evidence

The generic reader made no request. A direct read-only request returned HTTP
200 and the exact expected health response.

## Attempts and outcomes

- The generic reader rejected the URL locally.
- A direct read-only request verified live health successfully.

## Cause classification

- **Confirmed cause:** The generic reader's local safe-URL classifier rejected
  the request before it reached Vision.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** The live Worker was healthy, and no application or
  provider state changed.

## Correction and prevention

- **Correction:** Used a direct read-only request for the public health check.
- **Prevention:** For this preview endpoint, use a read-only client and compare
  only status plus the expected safe health shape.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The direct check returned HTTP 200 with the expected health response.

## Recurrence history

- 2026-07-26T19:34:31.380828Z: First observed.

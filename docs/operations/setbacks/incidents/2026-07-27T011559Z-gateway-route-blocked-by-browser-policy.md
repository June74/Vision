# SB-20260727-011559-gateway-route-blocked-by-browser-policy: Gateway route was blocked by browser policy

- **Status:** contained
- **First observed:** 2026-07-27T01:15:59Z
- **Last observed:** 2026-07-27T01:15:59Z
- **Phase/task:** Phase B AI Gateway budget acceptance
- **Environment:** Signed-in Cloudflare dashboard browser
- **Version/commit:** `13badf7`

## Symptom

The browser controller rejected direct navigation to the previously captured
account-scoped AI Gateway dashboard route.

## Impact

The dashboard spend-limit control could not be inspected through that direct
navigation. No dashboard or provider state changed.

## Cause classification

- **Confirmed cause:** The browser URL security policy blocked the navigation.
- **Known exclusions:** This was not an authentication failure or a Cloudflare
  API response.

## Correction and prevention

- **Correction:** Do not retry through another browser surface or indirect
  navigation. Continue only through a permitted API path or a user-performed
  dashboard action.
- **Prevention:** Treat account-scoped saved dashboard routes as potentially
  restricted and avoid depending on them as the only operator path.

## Verification and related work

The blocked action was abandoned without a bypass attempt.


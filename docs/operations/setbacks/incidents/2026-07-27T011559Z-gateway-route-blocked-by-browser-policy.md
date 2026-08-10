# SB-20260727-011559-gateway-route-blocked-by-browser-policy: Gateway route was blocked by browser policy

- **Status:** contained
- **First observed:** 2026-07-27T01:15:59Z
- **Last observed:** 2026-08-02T23:04:57.6278089Z
- **Phase/task:** Phase B AI Gateway budget acceptance and OAuth reconnect rollback verification
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

## Recurrence history

- 2026-08-02T23:04:57.6278089Z: Recurred when the signed-in Chrome session
  attempted read-only navigation to the unique visible Workers destination.
  Browser policy blocked navigation before it occurred. No click, provider
  request, setting, schedule, or repository state changed, and no alternate
  browser route will be used to bypass the block.

# SB-20260727-201308-preview-health-browser-client-block: Chrome blocked preview health navigation by client policy

- **Status:** closed
- **First observed:** 2026-07-27T20:13:08Z
- **Last observed:** 2026-08-02T05:32:26.8942986Z
- **Phase/task:** Phase B Task 8 reconnect-state diagnosis
- **Environment:** Connected Chrome browser
- **Version/commit:** normal runtime ref `40872a5`

## Symptom

Explicit navigation to the known public preview health endpoint was blocked
with `ERR_BLOCKED_BY_CLIENT`.

## Impact

No application response was obtained through Chrome. No request reached the
Worker through this browser path.

## Cause classification

- **Confirmed cause:** Browser client or extension policy blocked navigation.
- **Known exclusions:** This is not an HTTP response or Worker health result.

## Correction and prevention

- **Correction:** Use a direct read-only HTTP request with a closed status/body
  parser.
- **Prevention:** When both web-fetch and Chrome policy reject the public
  preview domain, move immediately to the approved command-line request path.

## Verification and related work

A direct read-only request returned HTTP 200 and an exact two-key response with
the expected healthy status and Vision service identifier. No response body
was printed.

## Recurrence history

- 2026-07-27T20:13:08Z: First observed and corrected through a closed
  command-line request.
- 2026-08-02T05:32:26.8942986Z: Direct authenticated navigation to the safe
  diagnostics route was again rejected by client policy. The rejection was a
  browser-local category, not an application response. Diagnosis continued
  with a signed-in provider-native aggregate query that returned only fixed
  Booleans and allowlisted status categories.

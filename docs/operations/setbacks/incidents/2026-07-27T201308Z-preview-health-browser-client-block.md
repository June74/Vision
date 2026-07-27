# SB-20260727-201308-preview-health-browser-client-block: Chrome blocked preview health navigation by client policy

- **Status:** closed
- **First observed:** 2026-07-27T20:13:08Z
- **Last observed:** 2026-07-27T20:13:08Z
- **Phase/task:** Phase B restore Task 4 rollback verification
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

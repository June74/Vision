# SB-20260727-201028-preview-health-url-policy-block: Web tool rejected preview health URL before request

- **Status:** closed
- **First observed:** 2026-07-27T20:10:28Z
- **Last observed:** 2026-07-27T20:10:28Z
- **Phase/task:** Phase B restore Task 4 rollback verification
- **Environment:** Public web-fetch tool
- **Version/commit:** normal runtime ref `40872a5`

## Symptom

The web-fetch tool rejected the known preview health endpoint as unsafe before
sending a request.

## Impact

No application response was obtained through that tool. No request or provider
mutation occurred.

## Cause classification

- **Confirmed cause:** Tool-level URL safety policy.
- **Known exclusions:** The rejection is not evidence of a Worker health
  failure.

## Correction and prevention

- **Correction:** Use the already connected browser session for a closed status
  check.
- **Prevention:** Prefer the connected browser or approved command-line request
  path for the preview Worker domain when web-fetch policy rejects it.

## Verification and related work

Normal schedules were already verified in the dashboard. Browser health status
verification is the next action.

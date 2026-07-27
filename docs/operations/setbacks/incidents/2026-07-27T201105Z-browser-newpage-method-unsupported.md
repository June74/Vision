# SB-20260727-201105-browser-newpage-method-unsupported: Browser tabs manager did not implement newPage

- **Status:** closed
- **First observed:** 2026-07-27T20:11:05Z
- **Last observed:** 2026-07-27T20:13:08Z
- **Phase/task:** Phase B restore Task 4 rollback verification
- **Environment:** Connected Chrome browser runtime
- **Version/commit:** normal runtime ref `40872a5`

## Symptom

The attempted `browser.tabs.newPage` health-check action was unsupported by the
connected browser runtime.

## Impact

No tab was created and no request was sent. Normal schedule verification remains
valid, but live health status is not yet captured.

## Cause classification

- **Confirmed cause:** The connected tabs manager does not expose a `newPage`
  method.
- **Known exclusions:** No existing tabs were enumerated, navigated, or changed.

## Correction and prevention

- **Correction:** Use the supported browser tab-creation or direct navigation
  action without enumerating existing tabs.
- **Prevention:** Reuse only methods already confirmed by the browser skill or
  runtime documentation.

## Verification and related work

The runtime exposed `tabs.new` and a tab-level `goto` action. The former
created a blank tab and the latter was used for explicit navigation. The
subsequent client-policy block is tracked separately.

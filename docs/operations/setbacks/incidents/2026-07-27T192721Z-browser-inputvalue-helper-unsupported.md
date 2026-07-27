# SB-20260727-192721-browser-inputvalue-helper-unsupported: Browser locator did not implement the expected inputValue helper

- **Status:** closed
- **First observed:** 2026-07-27T19:27:21Z
- **Last observed:** 2026-07-27T19:27:21Z
- **Phase/task:** Phase B restore Task 4 live retry
- **Environment:** Cloudflare preview dashboard through browser automation
- **Version/commit:** `9bbc4be`

## Symptom

After filling the first unsaved temporary secret row, the locator object rejected
the expected `inputValue` helper during closed verification.

## Impact

The secret remains only in the unsaved Cloudflare form. No value was printed,
and no provider change was submitted, but the initial verification expression
could not complete.

## Cause classification

- **Confirmed cause:** This browser runtime's locator surface does not implement
  the Playwright `inputValue` helper.
- **Known exclusions:** Both prior fill operations completed before the helper
  call failed.

## Correction and prevention

- **Immediate containment:** Do not save the form until both rows are verified.
- **Correction:** Read each input's DOM value only inside a boolean/length
  comparison and return no secret material.
- **Prevention:** Prefer locator `evaluate` for closed property checks in this
  browser runtime unless a helper has already been proven available.

## Verification and related work

Closed DOM verification confirmed the exact secret name, the expected value
length, and the Secret type without returning any secret value. Final form
submission remains part of the live restore procedure rather than this
tool-compatibility setback.

# SB-20260726-185631-browser-label-pattern-unsupported: Browser label pattern was unsupported

- **Status:** closed
- **First observed:** 2026-07-26T18:56:31.205139Z
- **Last observed:** 2026-07-26T23:54:52Z
- **Phase/task:** Phase B Cloudflare configuration
- **Environment:** Cloudflare preview dashboard through browser control
- **Version/commit:** `codex/phase-b-foundation`

## Symptom

A read-only form inspection used a label pattern that the browser control layer rejected.

## Impact

No form value was entered or saved; the open dialog remained available for a safe retry.

## Reproduction conditions

Call the browser-control label locator with a pattern rather than the supported
explicit field-label string.

## Safe evidence

The browser-control layer rejected the locator before it read or changed any
field.

## Attempts and outcomes

- The pattern-based inspection failed.
- Explicit role and label locators found the intended fields.
- The secret, R2, and Queue forms were then completed and verified by safe
  binding-name presence checks.

## Cause classification

- **Confirmed cause:** The browser-control layer did not accept that pattern
  argument in this locator path.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No private value was emitted and no partial form value
  was saved by the failed call.

## Correction and prevention

- **Correction:** Used exact accessible names and scoped role locators.
- **Prevention:** Prefer explicit labels for provider forms and use role counts
  before fill or click.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Exact-label form control succeeded, and the resulting secret and both bindings
were safely verified as present.

## Recurrence history

- 2026-07-26T18:56:31.205139Z: First observed.
- 2026-07-26T21:02:48.1034572Z: Recurred during a read-only Cloudflare
  navigation probe that used a regular-expression text locator. The control
  layer rejected it before returning page content; exact strings were used
  next.
- 2026-07-26T23:54:52Z: Recurred during a read-only validation of the
  Cloudflare token permission form. The control layer rejected the pattern
  before returning page content; no data changed or was exposed.

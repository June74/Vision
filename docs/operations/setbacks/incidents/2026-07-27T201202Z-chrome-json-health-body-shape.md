# SB-20260727-201202-chrome-json-health-body-shape: Chrome JSON health response did not expose plain body text

- **Status:** closed
- **First observed:** 2026-07-27T20:12:02Z
- **Last observed:** 2026-07-27T20:12:02Z
- **Phase/task:** Phase B restore Task 4 rollback verification
- **Environment:** Connected Chrome browser JSON viewer
- **Version/commit:** normal runtime ref `40872a5`

## Symptom

The preview health tab opened, but a closed parser of the document body's plain
text did not match the expected two-field health object.

## Impact

The parser result is inconclusive; it does not establish an application health
failure. No response content or provider URL was printed.

## Cause classification

- **Confirmed cause:** `tabs.new` created a blank tab but did not navigate when
  passed the URL string, so the document was genuinely empty.
- **Known exclusions:** No application response had been received or parsed.

## Correction and prevention

- **Correction:** Inspect only content type, body length, fixed-key presence,
  and response-status signals, or use an approved command-line status request.
- **Prevention:** Do not assume raw JSON endpoints are represented as directly
  parseable body text in the connected Chrome renderer.

## Verification and related work

An exact URL equality check proved the blank tab was not at the health
endpoint. Explicit navigation was then attempted and blocked by the browser
client policy, which is tracked separately.

# SB-20260811-153535-browser-tab-stale

- Incident ID: `SB-20260811-153535-browser-tab-stale`
- First observed: `2026-08-11T15:35:35Z`
- Last observed: `2026-08-11T15:35:35Z`
- Status: `contained`
- Phase/task: Phase B live sync diagnosis
- Environment: In-app browser, persistent Node browser runtime
- Version/commit: `f31d53c`

## Symptom

The previously held Vision tab object returned no URL when the diagnostic
probe attempted to normalize it, so the probe failed before reading page
content. The browser tab list was also empty in that runtime call.

## Impact

No navigation or provider request was made. No account value, token, code,
secret, database, calendar, or deployment state was accessed or changed.

## Cause classification

- **Confirmed cause:** the persistent tab handle from the prior browser turn is
  stale or disconnected from the currently visible app tab.
- **Rejected hypotheses:** this does not indicate a Vision API or Google sync
  failure.

## Correction and prevention

Re-select the visible browser page through the supported browser integration
before reading it, and normalize absent metadata without dereferencing it.

## Next step

Reconnect to the current Vision URL and inspect only safe page text and status
labels.

## Verification

The failure happened in the local diagnostic wrapper before any page read.

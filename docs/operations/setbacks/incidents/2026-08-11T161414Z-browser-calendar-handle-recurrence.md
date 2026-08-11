# SB-20260811-161414-browser-calendar-handle-recurrence

- Incident ID: `SB-20260811-161414-browser-calendar-handle-recurrence`
- First observed: `2026-08-11T16:14:14Z`
- Last observed: `2026-08-11T16:14:14Z`
- Status: `contained`
- Phase/task: Phase B OAuth privacy acceptance preparation
- Environment: In-app browser, controlled Google Calendar tab
- Version/commit: `850a381`

## Symptom

The previously held Google Calendar tab handle returned undefined metadata when
reused for a safe status check. No page content was read and no navigation
started from the stale handle.

## Impact

No account, OAuth transaction, event, token, secret, database, calendar,
deployment, or provider state changed.

## Cause classification

- **Confirmed cause:** the browser tab handle expired between browser turns;
  the runtime no longer exposes its URL/title through that object.
- **Rejected hypotheses:** this was not an OAuth or Google Calendar failure.

## Correction and prevention

Re-select the active browser by URL before each phase of a multi-step
interaction, and treat absent tab metadata as a stale-handle condition.

## Next step

Use a newly selected browser tab for the wrong-account/revocation acceptance
exercise, without inspecting cookies or account identifiers.

## Verification

The stale-handle probe completed before any external request or mutation.

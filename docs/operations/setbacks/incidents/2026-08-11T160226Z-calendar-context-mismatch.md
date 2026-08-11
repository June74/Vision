# SB-20260811-160226-calendar-context-mismatch

- Incident ID: `SB-20260811-160226-calendar-context-mismatch`
- First observed: `2026-08-11T16:02:26Z`
- Last observed: `2026-08-11T16:02:26Z`
- Status: `contained`
- Phase/task: Phase B near-real-time synchronization acceptance
- Environment: Controlled Google Calendar browser page
- Version/commit: `5a84a54`

## Symptom

The controlled Google Calendar session was authenticated, but its visible
calendar list did not contain the connected Vision calendar. The page showed
only ordinary account calendars and no safe evidence that the test target was
the same account/context as the Healthy Vision session.

## Impact

No event was created, edited, or deleted. No Google provider mutation, Vision
request, token, account value, event content, database, secret, key, or
deployment state changed.

## Cause classification

- **Confirmed cause:** the browser session available to the controlled page did
  not expose the expected Vision calendar, so the target context could not be
  established safely.
- **Rejected hypotheses:** this does not show that Vision synchronization is
  broken; the authenticated Vision page already reported Healthy and the
  maintenance repair/renewal run succeeded.

## Correction and prevention

Never create a test event until the visible Google Calendar session contains
the exact connected Vision calendar. If the controlled browser lacks it, have
the owner use the same account/context that produced the Healthy Vision page
and perform the disposable event test manually.

## Next step

Ask the owner to open Google Calendar in the Healthy Vision account, create one
temporary event on the Vision calendar, and report when it is saved. Monitor
only safe webhook, Queue, and sync timing evidence, then remove the event.

## Verification

The safety stop occurred before any provider mutation and left all external
state unchanged.

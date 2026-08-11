# SB-20260811-153223-browser-visibility-api-mismatch

- Incident ID: `SB-20260811-153223-browser-visibility-api-mismatch`
- First observed: `2026-08-11T15:32:23Z`
- Last observed: `2026-08-11T15:32:23Z`
- Status: `contained`
- Phase/task: Phase B Google account selection
- Environment: In-app browser, persistent Node browser runtime
- Version/commit: `d8d62c3`

## Symptom

The browser runtime rejected a request to keep the newly opened Google tab
visible because the selected browser object does not expose the attempted
`setVisibility` method.

## Impact

No page navigation, authentication, provider request, secret, token, code,
calendar, database, or deployment state changed. The separate Google tab was
already open and remained available for the user.

## Cause classification

- **Confirmed cause:** visibility is controlled by the host/browser integration,
  not by a `setVisibility` method on this runtime object.
- **Rejected hypotheses:** this was not a Google, OAuth, or Vision failure.

## Correction and prevention

Do not call `browser.setVisibility`. Keep the tab open through the browser
runtime and use the already-established visible browser session for user
interaction.

## Next step

Leave the Google account page open and wait for the user to sign in with the
approved account; keep the original Vision OAuth tab intact.

## Verification

The Google tab is at the generic Google sign-in page. No sensitive account
value was read or recorded.

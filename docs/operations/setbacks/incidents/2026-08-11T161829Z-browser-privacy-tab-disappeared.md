# SB-20260811-161829-browser-privacy-tab-disappeared

- Incident ID: `SB-20260811-161829-browser-privacy-tab-disappeared`
- First observed: `2026-08-11T16:18:29Z`
- Last observed: `2026-08-11T16:18:29Z`
- Status: `contained`
- Phase/task: Phase B wrong-account privacy acceptance
- Environment: In-app browser, controlled OAuth privacy-test tab
- Version/commit: `13f1e54`

## Symptom

The controlled privacy-test tab disappeared from the browser runtime before a
Google account was submitted. A later tab lookup reported no existing tabs.

## Impact

No wrong-account authorization attempt, callback, session, token, account value,
calendar event, database, secret, key, deployment, or provider state changed.

## Cause classification

- **Confirmed cause:** the browser runtime lost the temporary tab between turns.
- **Rejected hypotheses:** the Healthy Vision screenshot is not evidence of a
  wrong-account denial; no privacy result was observed.

## Correction and prevention

Treat disappearing browser tabs as a contained orchestration failure. Recreate
the test only when the owner is ready to enter a non-approved account, and
capture only the final safe denial category.

## Next step

Keep the wrong-account denial gate pending. Reopen a fresh controlled tab or
have the owner perform the denied-account attempt manually without sharing
credentials.

## Verification

The tab lookup failed before any page read or external mutation.

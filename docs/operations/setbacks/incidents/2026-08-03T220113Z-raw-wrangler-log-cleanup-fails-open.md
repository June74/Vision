# SB-20260803-220113-raw-wrangler-log-cleanup-fails-open: Raw Wrangler log cleanup can fail open

- **Status:** closed
- **First observed:** 2026-08-03T22:01:13.1427102Z
- **Last observed:** 2026-08-03T22:21:09.8976426Z
- **Phase/task:** Phase B privacy-safe deployment classifier final review
- **Environment:** Ignored local PowerShell deployment controller and mock tests
- **Version/commit:** controller package based on `8793f88a36718446c012e207aabd82dfd2ef056e`; no tracked change

## Symptom

Final independent review found that failure to delete Wrangler's raw temporary
log is swallowed, allowing the controller to return while provider text may
remain locally.

## Impact

No live run or disclosure occurred, but the classifier is not approved for a
new deployment while its explicit raw-output non-persistence boundary can fail
open.

## Reproduction conditions

Cause the temporary Wrangler log deletion to fail after classification and
observe that the existing cleanup path suppresses the deletion error.

## Safe evidence

Read-only source review found a swallowed cleanup failure. No raw log, provider
payload, identifier, URL, credential, secret, or key was opened or emitted.

## Attempts and outcomes

- The issue was found before a classifier-enabled live retry.
- All provider mutations remain stopped.
- A local-only TDD repair is in progress using synthetic content.

## Cause classification

- **Confirmed cause:** The cleanup catch path does not fail closed when raw-log
  deletion cannot be verified.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** A live classifier run already persisted new raw
  provider output; no classifier-enabled live run has occurred.
- **Known exclusions:** No network, provider, application, credential, key,
  schedule, or deployment state changed.

## Correction and prevention

- **Correction:** Add bounded deletion or truncation retries and return only a
  safe cleanup-uncertain category if non-persistence cannot be verified.
- **Prevention:** Functionally test both successful removal and simulated
  cleanup failure; source-marker assertions are insufficient.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

Bounded delete-or-truncate behavior, simulated fail-closed cleanup, focused
classification, cleanup-deadline, complete native-suite, and final independent
review all passed without raw output disclosure.

## Recurrence history

- 2026-08-03T22:01:13.1427102Z: First observed and contained before a live
  retry.
- 2026-08-03T22:21:09.8976426Z: Closed after functional and independent review
  confirmed verified absence or zero length and safe cleanup uncertainty.

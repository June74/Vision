# SB-20260801-212822-task7-task5-attribution-artifact-liveness: Candidate attribution assumes an artifact exists immediately

- **Status:** closed
- **First observed:** 2026-08-01T21:28:22.1785525Z
- **Last observed:** 2026-08-01T22:36:05.6244377Z
- **Phase/task:** Phase B Task 7 correlation repair Task 5 post-review call-path trace
- **Environment:** Local source trace only
- **Version/commit:** admitted baseline `10b228b`

## Symptom

The live call path dispatches a candidate, receives its opaque reference, and immediately invokes candidate attribution. The ignored driver performs a single candidate-intent artifact download, while the guarded workflow creates and uploads that artifact later inside the candidate job.

## Impact

A real candidate dispatch can be correctly created yet fail attribution merely because the artifact is not available on the first read. This blocks the live acceptance controller before the candidate can be observed or safely rolled back. No live dispatch, provider, network, browser, database, calendar, object storage, authentication, credential, deployment, key, secret, Git, or backup-key action occurred during the trace.

## Reproduction conditions

Trace the registered controller dependency from candidate dispatch return through immediate candidate attribution, then compare it with the workflow ordering of candidate-intent creation and upload.

## Safe evidence

Confirmed path: controller candidate dispatch return -> immediate candidate-attribution dependency -> ignored driver candidate-attribution command -> one-shot artifact download. The workflow upload is a later job step. No run reference, provider identifier, URL, artifact body, account value, or raw output is recorded.

## Attempts and outcomes

- The independent Task 5 review was completed first and did not classify this timing path.
- A bounded exact source trace confirmed the immediate controller call and the driver's lack of polling or retry.
- No implementation or test change has yet been made for this gap.

## Cause classification

- **Confirmed cause:** The contained stub makes artifacts available synchronously, so it did not model real workflow artifact readiness.
- **Hypotheses:** A bounded, empty-stream retry that distinguishes temporary artifact absence from malformed or invalid evidence can preserve attribution without exceeding the controller's existing deadline.
- **Rejected hypotheses:** The candidate workflow uploads the intent before the dispatch API returns; the upload occurs later in the workflow.
- **Known exclusions:** No provider outage, credential issue, workflow dispatch, or live artifact failure was observed.

## Correction and prevention

- **Correction:** Add a contained delayed-artifact RED, implement bounded polling under the existing controller kill boundary, fail closed on expiry or invalid evidence, and rerun the full contained suite.
- **Prevention:** Provider stubs for asynchronous workflows must model delayed availability, not only final success and malformed responses.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Define the shortest fixed polling interval and internal bound that remains below the controller deadline and preserves empty streams.

## Verification and related work

Closed after delayed-artifact and reconciliation polling tests passed under production ceilings longer than the controller's outer budget, with clean privacy/type gates and a zero-finding independent review.

## Recurrence history

- 2026-08-01T21:28:22.1785525Z: First confirmed by the post-review live-call-path trace.
- 2026-08-01T22:36:05.6244377Z: Closed by the final bounded-liveness implementation and zero-finding frozen-v3 review.

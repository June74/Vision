# SB-20260801-205818-task7-task5-first-green-parser-state: Task 5 first GREEN stopped before provider dispatch

- **Status:** closed
- **First observed:** 2026-08-01T20:58:18.7593424Z
- **Last observed:** 2026-08-01T22:36:05.6244377Z
- **Phase/task:** Phase B Task 7 correlation repair Task 5
- **Environment:** Contained local provider-stub self-test
- **Version/commit:** admitted baseline `10b228b`

## Symptom

The first post-implementation GREEN attempt failed 19 of 23 assertions. Direct dispatch stopped before provider-stub invocation or pending-journal creation, so mapping and reconciliation cases failed downstream.

## Impact

Task 5 remains unaccepted while the first internal boundary is isolated. The self-test containment held; no live/provider, network, secret, key, deployment, or tracked-source state changed.

## Reproduction conditions

Run the contained Task 5 self-test after the initial driver implementation with safe diagnostics enabled.

## Safe evidence

The contained summary reported 19 failures out of 23 assertions and confirmed zero provider-stub invocations and zero journal creation on direct dispatch. No raw output, path, identifier, token, digest, or private value is recorded.
After the loader correction, 34 of 38 assertions passed; the four remaining failures reduced to Windows mode reporting and one nonmapping retained-file privacy-scan category.

## Attempts and outcomes

- A valid contained pre-implementation RED failed 17 of 18 cases.
- Initial implementation expanded the self-test to 23 assertions.
- First GREEN failed before the provider boundary; downstream failures were treated as cascading rather than separate causes.
- The earliest loader failure was corrected by passing a file URL to the permanent TypeScript import boundary.
- The next contained run passed 34 of 38 assertions and isolated two residual categories without exposing file contents.

## Cause classification

- **Confirmed cause:** The permanent TypeScript loader received a filesystem path where it required a file URL, causing direct dispatch to fail before journal creation.
- **Hypotheses:** Windows mode reporting needs platform-accurate acceptance while still asserting the requested private creation mode; the retained-file scan is counting an approved harness/state category or a real nonmapping disclosure that must be localized safely.
- **Rejected hypotheses:** Provider-stub containment failed; the provider boundary was never reached.
- **Known exclusions:** No real provider call, private-data exposure, deployment, workflow mutation, or backup-key change occurred.

## Correction and prevention

- **Correction:** Use a file URL for the permanent parser import, apply platform-accurate private-mode assertions, and classify the retained-file hit by safe category before changing the scan or driver.
- **Prevention:** Keep one explicit pre-provider assertion per initialization boundary so cascading failures identify the earliest closed gate.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Resolve the Windows mode assertion and determine whether the nonmapping retained-file hit is approved harness state or an actual disclosure.

## Verification and related work

Closed after the complete contained suite reached 57 of 57, both syntax checks passed, the corrected frozen package passed all privacy counters, and the fresh independent review returned zero findings.

## Recurrence history

- 2026-08-01T20:58:18.7593424Z: First observed and contained during the first GREEN cycle.
- 2026-08-01T21:01:41.2438131Z: File-URL loader correction raised the contained result to 34 of 38; four assertions remained in two privacy/platform categories.
- 2026-08-01T21:51:13.7452170Z: The independent-review repair's first complete GREEN passed 48 of 49 contained assertions. Provider containment held; the sole safe failure category was delayed reconciliation. The implementer stopped broad changes and is tracing only the bounded stub/cycle evidence before correction. No live/provider or default-state key action occurred.
- 2026-08-01T21:52:07.8416148Z: The delayed-reconciliation stub had incorrectly marked its synthetic run terminal during the first absent-artifact cycle. Production correctly failed terminal absence. Changing only the fixture to report a nonterminal first cycle and a later terminal artifact produced 49 of 49 contained assertions with containment and cleanup still proven.
- 2026-08-01T22:36:05.6244377Z: Closed after final contained, syntax, privacy, type, focused-test, and zero-finding independent-review evidence.

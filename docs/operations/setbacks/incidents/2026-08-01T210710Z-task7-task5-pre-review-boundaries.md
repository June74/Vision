# SB-20260801-210710-task7-task5-pre-review-boundaries: Task 5 pre-review inspection found three uncovered boundaries

- **Status:** closed
- **First observed:** 2026-08-01T21:07:10.9302235Z
- **Last observed:** 2026-08-01T22:36:05.6244377Z
- **Phase/task:** Phase B Task 7 correlation repair Task 5
- **Environment:** Contained local provider-stub implementation
- **Version/commit:** admitted baseline `10b228b`

## Symptom

Post-GREEN root inspection found three boundaries not exercised by the 33-case self-test: candidate attribution still inspected obsolete intent field names, provider instants were admitted only with milliseconds, and provider-bound context mapping lookup did not restrict a referenced token to its required operation family.

## Impact

Task 5 cannot enter independent review. Direct dispatch/reconciliation tests are green, but candidate attribution could fail on the current exact artifact schema, legitimate whole-second provider timestamps could be rejected, and a same-commit mapping from the wrong operation could be substituted into a context reference. No live/provider or tracked-source state changed.

## Reproduction conditions

Inspect the final ignored driver against the current permanent candidate-intent schema, the provider timestamp shapes accepted by permanent lifecycle validation, and operation-specific context reference semantics.

## Safe evidence

The current exact candidate schema uses candidate-prefixed binding fields; the local driver checks older names. One canonical-instant validator is reused for both local state and provider timestamps. Context reference resolution supplies no allowed-operation set. No concrete identifier, digest, path, or private value is recorded.

## Attempts and outcomes

- Contained Task 5 self-test passed 33 of 33 assertions and both syntax checks passed.
- Root source inspection stopped review admission before a frozen diff was created.

## Cause classification

- **Confirmed cause:** The rewritten self-test concentrated on dispatch/reconciliation and did not behaviorally exercise current candidate-intent attribution, whole-second provider timestamps, or operation-bound context mapping substitution.
- **Hypotheses:** Focused stub cases will fail the current implementation and can be corrected by permanent intent-parser reuse, separate provider-instant normalization, and field-specific mapping-operation allowlists.
- **Rejected hypotheses:** The provider stub or containment caused these gaps; they are source/test coverage omissions.
- **Known exclusions:** No real provider call, secret exposure, workflow change, deployment, or backup-key change occurred.

## Correction and prevention

- **Correction:** Add focused RED cases for all three boundaries, make the smallest ignored-driver corrections, rerun the complete contained self-test, and repeat syntax checks.
- **Prevention:** Include every downstream opaque-token consumer and permanent artifact schema in the Task 5 review matrix, not only dispatch/reconciliation paths.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Add the three contained adversarial cases and confirm they fail for the identified reasons.

## Verification and related work

Closed after all identified boundaries received adversarial coverage, the contained suite passed 57 of 57, and the final frozen-v3 review returned zero Critical, Important, or Minor findings.

## Recurrence history

- 2026-08-01T21:07:10.9302235Z: First observed and contained before independent review.
- 2026-08-01T22:36:05.6244377Z: Closed by final zero-finding independent review of the byte-verified frozen-v3 package.

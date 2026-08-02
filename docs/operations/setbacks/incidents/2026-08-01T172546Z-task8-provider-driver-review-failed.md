# SB-20260801-172546-task8-provider-driver-review-failed: Task 8 local provider driver failed safety review

- **Status:** contained
- **First observed:** 2026-08-01T17:25:46.6620789Z
- **Last observed:** 2026-08-01T17:45:19.3061456Z
- **Phase/task:** Phase B Task 8 provider-interface preparation
- **Environment:** Ignored local driver and isolated local self-test
- **Version/commit:** admitted Task 7 candidate unchanged

## Symptom

An independent static review found three Critical, three Important, and one
Minor safety issue in the ignored local provider driver. The driver has not
been used for a Task 8 mutation.

## Impact

Task 8 live dispatch and owner-action orchestration are paused. Read-only
reconciliation evidence remains valid, but the driver is not admitted for a
deployment, candidate, rollback, closure, restore, calendar action, revocation,
or AI request. No provider, source, Git, credential, calendar, database, R2, or
AI state changed from the review.

## Reproduction conditions and safe evidence

Compare the ignored driver and self-test against the frozen Task 8 evidence,
attribution, approval, rollback, and ambiguity contracts. Static inspection is
sufficient to reproduce the gaps; no provider execution is required.

## Cause classification

- **Confirmed causes:** Approval/action controls are stable, replayable files
  that are not single-use or candidate-bound; dispatch resolution can select
  one unrelated unseen run before proving exact commit/operation correlation;
  provider run handles are serialized through the driver protocol despite the
  stricter retained-evidence boundary; rollback closure checks two successful
  runs without an exact correlation proof; dispatch context is merely nonempty;
  and the missing-control self-test can pass without proving the child remained
  blocked.
- **Hypotheses:** None required before repair design.
- **Rejected hypotheses:** The existing five passing self-tests are not
  sufficient admission evidence because they do not exercise replay,
  correlation, ambiguity, expiry, or closure substitution.
- **Known exclusions:** The defects were detected before live mutation. No
  secret, provider identifier, URL, account data, event content, object key,
  database row, prompt/response, or raw provider output was displayed or
  retained.

## Attempts and outcomes

1. The local self-test passed five basic approval/action checks.
2. Independent static review rejected live use due to the untested adversarial
   boundaries above.
3. The driver is quarantined from all live mutation paths pending repair and
   re-review.
4. A scoped closed-output provider probe proved that a workflow-run detail does
   not expose its dispatch inputs; only booleans and a zero field count were
   returned.
5. Current official provider documentation shows that a successful dispatch can
   return its exact run identifier. That removes the ordinary success-path race,
   but a lost response after server acceptance remains ambiguous because no
   documented idempotency key or dispatch-input field can correlate the run.

## Correction and prevention

- **Correction:** Design and test single-use nonce-bound owner controls,
  bounded closed context, opaque local run-handle mapping, and isolated
  unconditional self-test cleanup. Use the provider's direct run-id response on
  success. For uncertain dispatches, add one minimal tracked correlation value
  to the canonical context and immutable candidate/rollback evidence so the
  exact run can be recovered without selecting the first unseen run.
- **Prevention:** Require adversarial RED/GREEN evidence and an independent
  zero-Critical/zero-Important review for every ignored live-operation adapter,
  even when the adapter is not tracked source.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Obtain owner approval for the revised minimal
  tracked-correlation plus ignored-driver repair, then implement it test-first,
  rerun the invalidated Task 7 freeze gates, and re-review before Task 8.

## Verification and related work

Pending revised repair approval. The permanent safe Git adapter independently
re-proved the reviewed branch equality and is unaffected. No live dispatch was
used to reach this conclusion.

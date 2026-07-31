# SB-20260730-224042-task3-observer-id-canary-collision: Task 3 observer-ID leak test collided with timestamp digits

- **Status:** closed
- **First observed:** 2026-07-30T22:40:42.860773Z
- **Last observed:** 2026-07-30T22:40:42.860773Z
- **Phase/task:** Phase B live-acceptance closure Task 3 controller repair
- **Environment:** Local focused controller test
- **Version/commit:** Task 3 repair working tree after `38bed3e`

## Symptom

A substring assertion used a short numeric observer canary that also appeared in canonical timestamp text, causing a false leak failure.

## Impact

One focused controller test failed despite the observer handle remaining in process memory; production behavior was unaffected.

## Reproduction conditions

Search every captured closed argument for a short numeric canary that is also a
substring of the canonical year.

## Safe evidence

The suite reached 18 of 19 passing tests; the sole failure was the canary
collision, not an emitted observer handle.

## Attempts and outcomes

- The short canary produced a false match in canonical timestamp text.
- The test was constrained to use a distinctive long numeric canary that cannot
  collide with the fixed closed fields.

## Cause classification

- **Confirmed cause:** The test chose a non-distinctive substring canary.
- **Hypotheses:** None.
- **Rejected hypotheses:** The controller did not serialize the observer
  handle.
- **Known exclusions:** No production behavior, provider, network, protected
  value, file mutation outside the test, or external state was involved.

## Correction and prevention

- **Correction:** Replace the short canary with a distinctive long numeric
  sentinel and rerun the focused suite.
- **Prevention:** Leak tests must prove their canary is absent from all
  legitimate fixed-format fields before asserting nonappearance.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

Closure is contingent on the immediate focused rerun using the distinctive
canary; any further failure must be reported separately.

## Recurrence history

- 2026-07-30T22:40:42.860773Z: First observed.

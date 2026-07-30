# SB-20260730-194337-task1-review-canonicalization-observer-time: Task 1 review found canonicalization and observer-time defects

- **Status:** closed
- **First observed:** 2026-07-30T19:43:37.123449Z
- **Last observed:** 2026-07-30T20:06:07.4481624Z
- **Phase/task:** Phase B live-acceptance closure Task 1 review
- **Environment:** Local Task 1 review package; no live provider execution
- **Version/commit:** `6bd0e450885b3c3aa38f3ba38289e1371b3cbb43`;
  fixed by `7d5ca8aa4dff581cdc1214b5e6ad0091c8d3e0fe`

## Symptom

Independent review found that the context serializer required preordered keys and the observer workflow compared timestamp strings lexically; reference wording was also stale.

## Impact

Task 1 is not accepted and Task 2 implementation is held until regression-tested fixes pass; no deployment or provider state was changed.

## Reproduction conditions

A semantically valid context object is assembled with the right own keys in a
different insertion order, or an observer timestamp uses an equivalent
whole-second UTC representation while the canonical bounds use milliseconds.

## Safe evidence

The independent package review reported zero Critical findings, two Important
findings, and one documentation Minor. It found no later-task ownership leak.

## Attempts and outcomes

- The Task 1 implementation and focused tests passed before review.
- Independent review rejected specification compliance and correctness because
  the missing cases were not covered by those tests.

## Cause classification

- **Confirmed cause:** Serializer validation coupled semantic validity to
  property insertion order, and the workflow compared timestamp text instead
  of parsed instants. Tests covered canonical-order objects and same-format
  timestamps but not these equivalent representations.
- **Hypotheses:** None.
- **Rejected hypotheses:** The reviewer found no production activation,
  later-task ownership leak, or selector/lifetime/configuration defect.
- **Known exclusions:** No deployment, provider call, external mutation,
  credential access, or private-data output occurred.

## Correction and prevention

- **Correction:** Accept exact key membership at the serializer boundary,
  rebuild canonical key order, parse observer timestamps as instants, reject
  reversed intervals, add boundary regressions, and correct reference counts
  and schedule wording.
- **Prevention:** Every canonical serializer test matrix must include reordered
  semantic objects, and every temporal comparison must include equivalent
  timestamp formats plus reversed, zero-width, and boundary intervals.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The fix pass recorded the intended RED, then passed 116 focused unit tests, 41
focused integration tests, typecheck, documentation validation, ten local
workflow-admission outputs, and exact staging. A fresh independent full-range
re-review reported zero Critical, zero Important, and zero Minor findings with
both specification and quality verdicts ready.

## Recurrence history

- 2026-07-30T19:43:37.123449Z: First observed.
- 2026-07-30T20:06:07.4481624Z: Regression-tested fix and final independent
  re-review completed; incident closed.

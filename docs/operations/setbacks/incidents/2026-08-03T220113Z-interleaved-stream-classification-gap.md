# SB-20260803-220113-interleaved-stream-classification-gap: Interleaved output can weaken deployment classification

- **Status:** closed
- **First observed:** 2026-08-03T22:01:13.1427102Z
- **Last observed:** 2026-08-03T22:21:09.8976426Z
- **Phase/task:** Phase B privacy-safe deployment classifier final review
- **Environment:** Ignored local PowerShell deployment controller and mock tests
- **Version/commit:** controller package based on `8793f88a36718446c012e207aabd82dfd2ef056e`; no tracked change

## Symptom

Final independent review found that stdout and stderr chunks share one rolling
classification window. An interleaved chunk from the other stream can separate
two halves of a signature.

## Impact

No live run or disclosure occurred, but a real provider error could be reduced
to `unknown_failure`, losing the safe diagnostic value required for the next
monitored attempt.

## Reproduction conditions

Split one allowlisted signature across consecutive stdout reads and interleave
an unrelated stderr chunk between them.

## Safe evidence

Read-only source and test review showed a single combined rolling window; the
current synthetic test does not exercise cross-stream interleaving.

## Attempts and outcomes

- The issue was found before a classifier-enabled live retry.
- All provider mutations remain stopped.
- A local-only TDD repair is in progress using synthetic output.

## Cause classification

- **Confirmed cause:** Independent streams are flattened before signature
  boundary reconstruction.
- **Hypotheses:** None remaining.
- **Rejected hypotheses:** The existing test proves interleaved split-stream
  reconstruction; it uses adjacent chunks or complete signatures.
- **Known exclusions:** No network, provider, application, credential, key,
  schedule, or deployment state changed.

## Correction and prevention

- **Correction:** Maintain separate bounded windows for stdout, stderr, and
  log input, then aggregate matched allowlisted categories by existing
  precedence.
- **Prevention:** Require a functional interleaved-stream regression.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None.

## Verification and related work

An exact interleaved-stream RED was captured, separate bounded windows were
implemented for stdout, stderr, and log input, and focused, full-suite, and
final independent review passed.

## Recurrence history

- 2026-08-03T22:01:13.1427102Z: First observed and contained before a live
  retry.
- 2026-08-03T22:21:09.8976426Z: Closed after exact behavioral and independent
  verification confirmed the expected allowlisted classification.

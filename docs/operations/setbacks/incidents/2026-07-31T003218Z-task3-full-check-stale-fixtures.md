# SB-20260731-003218-task3-full-check-stale-fixtures: Task 3 aggregate check found a supervisor fixture race and stale cleanup assertions

- **Status:** closed
- **First observed:** 2026-07-31T00:32:18.497208Z
- **Last observed:** 2026-07-31T00:34:55.2362265Z
- **Phase/task:** Phase B live-acceptance closure Task 3 final bounded verification
- **Environment:** Local aggregate unit gate
- **Version/commit:** Final bounded repair working tree after `841bc01`

## Symptom

The full unit phase found a fake-producer termination-handler race and three cleanup assertions that still described the prior surface count and maintenance evidence version.

## Impact

Four of 1,337 unit tests failed while 1,332 passed and one was intentionally skipped; no product, privacy, provider, or external state failed.

## Reproduction conditions

Run the complete unit phase after adding a new temporary supervisor surface and
maintenance v2 semantics.

## Safe evidence

The gate reported four test-only failures after 1,332 passes and one intentional
skip.

## Attempts and outcomes

- The fake producer wrote its ready marker before registering the termination
  handler.
- Cleanup assertions still counted eight surfaces, expected maintenance v1,
  and omitted the new reviewed temporary surface.

## Cause classification

- **Confirmed cause:** Test fixture ordering and deterministic cleanup
  expectations were not refreshed with the bounded repair.
- **Hypotheses:** None.
- **Rejected hypotheses:** No production process-supervision or cleanup
  implementation failed.
- **Known exclusions:** No protected value, provider, network, deployment, Git
  history, or external state was involved.

## Correction and prevention

- **Correction:** Install the fake termination handler before its ready marker
  and update the three cleanup expectations to the reviewed current contract.
- **Prevention:** Run the aggregate cleanup-contract file whenever a temporary
  acceptance surface or evidence version changes.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The two affected files must pass before restarting the complete check.

## Recurrence history

- 2026-07-31T00:32:18.497208Z: First observed.
- 2026-07-31T00:34:55.2362265Z: The focused correction run showed that the
  representative cleanup fixture must intentionally retain the stale word
  `eight` so the regex proves rejection, while only the live documentation
  moves to nine. It also showed that Windows does not reliably execute a Node
  child's SIGTERM handler, so a handler marker cannot prove awaited teardown;
  the test must use a cross-platform injected process seam or direct completion
  observation instead.

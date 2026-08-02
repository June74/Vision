# SB-20260801-214556-task7-task5-controller-red-fixture-side-effects: New controller RED changed unrelated fixture time

- **Status:** closed
- **First observed:** 2026-08-01T21:45:56.1347168Z
- **Last observed:** 2026-08-01T21:46:25.5419335Z
- **Phase/task:** Phase B Task 7 correlation repair Task 5 independent-review repair RED
- **Environment:** Local focused unit test
- **Version/commit:** admitted baseline `10b228b` plus uncommitted test-only RED

## Symptom

The contained driver RED produced the planned 16 safe-category failures with provider containment intact. The focused controller RED then produced two additional fixture-side-effect failures besides the intended deadline assertion because the new test advanced wall time while trying to model a long monotonic child call.

## Impact

The focused controller RED is not yet admissible evidence. No driver or controller implementation change may begin until the new tests fail only for the intended deadline contract. No live/provider, network, browser, database, calendar, object storage, authentication, credential, deployment, secret, key, Git, or backup-key action occurred.

## Reproduction conditions

Run the focused controller test after adding the new long-running attribution and reconciliation deadline fixtures with coupled wall and monotonic advancement.

## Safe evidence

The unexpected RED-shape count was two; one separate failure was the planned deadline assertion. No test names, inputs, time values, child output, path outside the repository, identifier, token, digest, URL, email, or environment value is recorded.

## Attempts and outcomes

- The contained driver RED failed 16 planned categories and preserved provider-shadow containment.
- The first focused controller RED mixed the intended failure with two unrelated fixture outcomes.
- No implementation file has been edited in response.

## Cause classification

- **Confirmed cause:** The new deadline fixture coupled monotonic and wall-clock advancement, allowing unrelated controller expiry rules to fire before the intended assertion.
- **Hypotheses:** Advancing monotonic time only will isolate the boundary contract while preserving the fixed wall-clock acceptance window.
- **Rejected hypotheses:** The existing controller implementation caused all three failures; two arise from the new fixture design.
- **Known exclusions:** No production or provider behavior was exercised.

## Correction and prevention

- **Correction:** Change only the two new tests so their long child simulation advances monotonic time without changing wall time, then rerun the focused RED.
- **Prevention:** Deadline tests must state explicitly whether they advance monotonic time, wall time, or both, and must assert unrelated expiry rules remain unchanged.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Rerun the focused controller RED and require only the planned deadline assertion categories.

## Verification and related work

The corrected focused controller RED passed 69 of 72 assertions, with exactly the three planned deadline assertions failing. The contained driver RED passed 33 of 49 assertions, with exactly 16 planned safe-category failures; provider containment and current-root cleanup remained proven. This fixture-design incident is closed. Implementation GREEN and fresh independent review remain separate Task 5 gates.

## Recurrence history

- 2026-08-01T21:45:56.1347168Z: First observed in the Task 5 controller deadline RED.
- 2026-08-01T21:46:25.5419335Z: Monotonic-only test advancement isolated the three intended deadline failures and closed the fixture side effect.

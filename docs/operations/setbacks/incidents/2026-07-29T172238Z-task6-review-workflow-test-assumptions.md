# SB-20260729-172238-task6-review-workflow-test-assumptions: Review-fix tests retained stale and line-sensitive expectations

- **Status:** closed
- **First observed:** 2026-07-29T17:22:29Z
- **Last observed:** 2026-07-29T17:22:38Z
- **Phase/task:** Phase B acceptance instrumentation Task 6 review fixes
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `fa650ad`

## Symptom

The first workflow GREEN attempt retained three failures after the intended
trust and liveness changes were present.

## Impact

The focused workflow suite did not pass. No provider, database, browser,
runtime, or external state changed.

## Reproduction conditions and safe evidence

One older assertion still required `inputs.ref`, which the Critical correction
must remove. Two new assertions required the opening parenthesis and exact
workflow path comparison on one source line, while the JQ predicate formatted
them on adjacent lines.

## Attempts and outcomes

- The RED run failed for all missing trust/liveness behaviors as intended.
- The first implementation added the dispatch-bound checkout, pre-credential
  equality check, exact path predicate, and deployment-adjacent liveness proof.
- Inspection of the three remaining diffs confirmed only the stale ref
  expectation and whitespace-sensitive predicate expectation remained.

## Cause classification

- **Confirmed cause:** Test assertions encoded the old insecure ref and source
  formatting rather than the new behavior.
- **Hypotheses:** None.
- **Rejected hypotheses:** The observer checkout and final proof were not
  missing.
- **Known exclusions:** No evidence schema, selector, attestation, or provider
  behavior changed.

## Correction and prevention

- **Correction:** Require `github.sha` in the existing observer assertion and
  assert the two exact JQ predicate tokens independently.
- **Prevention:** Policy tests should remain strict about trust inputs and
  operators while avoiding irrelevant line-layout coupling.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The workflow suite will be rerun after the test-only corrections.

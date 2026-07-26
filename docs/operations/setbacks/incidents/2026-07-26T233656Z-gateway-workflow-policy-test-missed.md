# SB-20260726-233656-gateway-workflow-policy-test-missed: Gateway workflow policy test was missed

- **Status:** closed
- **First observed:** 2026-07-26T23:36:56Z
- **Last observed:** 2026-07-26T23:36:56Z
- **Phase/task:** Phase B AI Gateway configuration
- **Environment:** Local complete repository gate
- **Version/commit:** `d7da15d` plus uncommitted Gateway operator path

## Symptom

The focused workflow test passed, but the complete unit suite found an older CI
policy test that still required the previous two-mode workflow condition.

## Impact

The complete release gate stopped before commit or provider action. No
Cloudflare state changed.

## Reproduction conditions

Add a third mutually exclusive preview workflow mode while running only the
new script and routing-focused tests.

## Safe evidence

One CI workflow assertion failed because it expected the original
`safe_tail`-only condition.

## Attempts and outcomes

- Focused script and routing tests passed.
- The full unit project found the stale policy assertion.
- The correction updates that test to require the deployment, tail, and
  Gateway modes to exclude one another.

## Cause classification

- **Confirmed cause:** The initial test scope omitted
  `tests/unit/ci/workflows.test.ts`.
- **Hypotheses:** None.
- **Rejected hypotheses:** The Gateway script itself did not fail.
- **Known exclusions:** No external action or secret access occurred.

## Correction and prevention

- **Correction:** Update the CI policy test and rerun the full gate.
- **Prevention:** Whenever workflow inputs or job conditions change, include
  both routing and CI workflow policy suites in the focused test command.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Run the focused workflow suites, then `pnpm check`.

## Verification and related work

Closed because the missing test scope and exact stale assertion are confirmed;
the corrected full-gate result follows.

## Recurrence history

- 2026-07-26T23:36:56Z: First observed and closed before provider action.

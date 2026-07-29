# SB-20260729-041449-fault-response-fixture-duplicate-keys: Fault response fixture duplicated keys

- **Status:** closed
- **First observed:** 2026-07-29T04:14:49.2919345Z
- **Last observed:** 2026-07-29T04:14:49.2919345Z
- **Phase/task:** Phase B acceptance instrumentation Task 5 typecheck
- **Environment:** Local Phase B worktree
- **Version/commit:** `1880cf9` plus uncommitted Task 5 corrections

## Symptom

TypeScript rejected the exact Worker response fixture because `state` and
`warningCodes` were declared in both a base literal and every table override.

## Impact

The typecheck gate stopped before completion. Runtime tests had already passed;
no provider, database, Queue, object storage, deployment, or private state was
accessed.

## Reproduction conditions

Build a TypeScript object literal with fixed keys followed by a spread whose
inferred union always contains the same keys.

## Safe evidence

TypeScript reported duplicate-property diagnostics at the test-only expected
response construction.

## Attempts and outcomes

- The first typecheck identified exactly two overwritten fixture keys.
- The table remains the source of those scenario-specific fields; the base
  fixture no longer declares them.

## Cause classification

- **Confirmed cause:** The expected-response composition duplicated fields
  present in every typed override.
- **Hypotheses:** None.
- **Rejected hypotheses:** Production response types and runtime overlay
  behavior were not involved.
- **Known exclusions:** No external state or private value was involved.

## Correction and prevention

- **Correction:** Keep invariant response fields in the base object and all
  scenario-dependent fields in the table override.
- **Prevention:** Run typecheck immediately after adding typed table-driven
  fixtures and avoid overlapping literal/spread ownership.
- **Owner:** Codex.
- **Next diagnostic step:** Rerun the full typecheck gate.

## Verification and related work

`pnpm.cmd typecheck` exited zero after the fixture-only correction.

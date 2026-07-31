# SB-20260731-220909-task5-browser-mock-signature-inference: Browser helper test mocks inferred zero-argument signatures

- **Status:** closed
- **First observed:** 2026-07-31T22:09:09.9408747Z
- **Last observed:** 2026-07-31T22:11:01.2451811Z
- **Phase/task:** Phase B Task 5 browser-helper TDD
- **Environment:** Local concurrent TypeScript check
- **Version/commit:** 7e95b61 plus uncommitted Task 5 lanes

## Symptom

The browser-helper behavior suite passed, but TypeScript reported four local
test errors where Vitest inferred zero-argument tuples for the fetch and timer
mocks, making inspected call arguments type `never`.

## Impact

The browser lane is not type-clean yet. Other errors in the same shared check
belong to concurrent incomplete Task 5 lanes and are not attributed here. No
live, provider, network, staging, or external state changed.

## Cause classification

- **Confirmed cause:** Test mocks lacked explicit dependency-function
  signatures before their argument arrays were inspected.
- **Known exclusions:** The 12 browser behavior tests are green; this is not a
  runtime behavior failure.

## Correction and prevention

- **Correction:** Add exact function signatures to only the two affected mocks
  and rerun the focused suite plus typecheck after lane integration.
- **Prevention:** Type dependency mocks before asserting on call tuples.
- **Owner:** Codex.
- **Next diagnostic step:** Apply the bounded test-only typing repair.

## Recurrence history

- 2026-07-31T22:09:09.9408747Z: Logged before any repair.
- 2026-07-31T22:11:01.2451811Z: Closed after explicit dependency-function
  mock signatures removed all four browser-lane type errors. The remaining
  shared typecheck errors are confined to concurrent incomplete lanes.

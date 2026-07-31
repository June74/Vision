# SB-20260731-221415-task5-controller-date-narrowing: Controller test async timestamp did not narrow to Date

- **Status:** closed
- **First observed:** 2026-07-31T22:14:15.9435361Z
- **Last observed:** 2026-07-31T22:26:06.1268586Z
- **Phase/task:** Phase B Task 5 observer/controller GREEN
- **Environment:** Local TypeScript check
- **Version/commit:** 7e95b61 plus uncommitted Task 5 lanes

## Symptom

Five focused observer/workflow files and 219 tests passed, but TypeScript
rejected a direct cast from a `null`-initialized timestamp variable to `Date`
after that variable was mutated asynchronously in a controller test.

## Impact

The observer lane is behavior-green but not type-clean. No production, live,
provider, network, staging, or external state changed.

## Cause classification

- **Confirmed cause:** Control-flow analysis cannot prove the async callback
  assigned the test variable before the assertion.
- **Known exclusions:** No production-source type error was reported.

## Correction and prevention

- **Correction:** Add an explicit runtime non-null assertion/narrowing step in
  the test before reading the timestamp.
- **Prevention:** Narrow asynchronously assigned test captures through a
  runtime assertion instead of a direct incompatible cast.
- **Owner:** Codex.
- **Next diagnostic step:** Rerun focused tests and typecheck.

## Recurrence history

- 2026-07-31T22:14:15.9435361Z: Logged before the test-only repair.
- 2026-07-31T22:17:21.8666260Z: Recurred after a runtime `instanceof` guard;
  TypeScript still treated the callback-assigned capture as statically null.
  All 219 tests remained green; the next repair stores primitive milliseconds
  instead of a cross-callback `Date` object.
- 2026-07-31T22:26:06.1268586Z: Closed after the primitive-millisecond capture
  repair passed 220 focused tests and the integrated TypeScript check.

# SB-20260802-171711-reconnect-recovery-test-types: Reconnect recovery tests failed typecheck

- **Status:** closed
- **First observed:** 2026-08-02T17:17:11.365796Z
- **Last observed:** 2026-08-02T17:18:25.4083517Z
- **Phase/task:** Phase B reconnect-recovery Task 1 GREEN verification
- **Environment:** Local TypeScript 5.9 test project with PGlite fixture
- **Version/commit:** `94b8810` plus uncommitted Task 1 changes

## Symptom

TypeScript rejected one PGlite row helper result and one table-driven async test callback.

## Impact

The required typecheck stopped; runtime recovery tests passed and no production or external state changed.

## Reproduction conditions

Return untyped PGlite query rows from a helper declared as records, and include
an unannotated no-op async callback in a recursive table-driven mutation tuple.

## Safe evidence

The required typecheck reported two diagnostics in the Task 1 integration test:
one `unknown[]` to record-array mismatch and one implicit callback return type.

## Attempts and outcomes

- The focused runtime suite passed all 47 tests.
- The subsequent required typecheck stopped on the two test-only diagnostics.

## Cause classification

- **Confirmed cause:** The PGlite query omitted its record generic, and the
  table-driven no-op async callback omitted an explicit `Promise<void>` return
  type needed by recursive tuple inference.
- **Hypotheses:** None.
- **Rejected hypotheses:** The production repository behavior was not the
  source; all focused runtime recovery cases passed.
- **Known exclusions:** No external request, provider action, database service,
  or private data access occurred.

## Correction and prevention

- **Correction:** Add the record generic to the fixture query and the explicit
  return type to the no-op callback.
- **Prevention:** Type SQL fixture helpers at their query boundary and annotate
  no-op callbacks used beside recursive async table entries.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

After the two type-only corrections, fresh `pnpm.cmd typecheck` completed with
zero diagnostics across both TypeScript projects.

## Recurrence history

- 2026-08-02T17:17:11.365796Z: First observed.

# SB-20260731-185253-concurrent-lifecycle-typecheck-state: Expiry-lane typecheck saw incomplete lifecycle test edits

- **Status:** open
- **First observed:** 2026-07-31T18:52:53.8643852Z
- **Last observed:** 2026-07-31T18:52:53.8643852Z
- **Phase/task:** Phase B Task 3 fifth-review parallel repair
- **Environment:** Local repository-wide TypeScript check
- **Version/commit:** 7dc954b plus three in-progress isolated repair lanes

## Symptom

After the owned legacy-expiry RED cases turned green, its repository-wide
TypeScript check reported five input-shape errors in the separate lifecycle
lane's owned test file. The expiry lane did not edit that file and stopped.

## Impact

The expiry repair is focused-green but cannot claim a combined compile result
until the lifecycle lane finishes its partial edits. No provider, network,
environment, secret, staging, or commit was touched.

## Cause classification

- **Confirmed cause:** A repository-wide check observed another active lane's
  incomplete test-first mutation state.
- **Hypotheses:** The lifecycle lane is adding `candidateIntent` before its
  local input type has been updated or narrowed.
- **Known exclusions:** The two new expiry cases pass and the errors are outside
  the expiry lane's owned paths.

## Correction and prevention

- **Correction:** Let the lifecycle lane complete, then rerun the combined
  TypeScript and focused gates from the root.
- **Prevention:** During parallel TDD, reserve repository-wide compile checks
  for the integration boundary unless every active lane reports a stable
  checkpoint.
- **Owner:** Codex.
- **Next diagnostic step:** Await the lifecycle lane's focused result and exact
  type repair.

## Recurrence history

- 2026-07-31T18:52:53.8643852Z: Observed and contained without out-of-scope
  edits.

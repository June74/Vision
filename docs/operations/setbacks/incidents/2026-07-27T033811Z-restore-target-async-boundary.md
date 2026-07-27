# SB-20260727-033811-restore-target-async-boundary: Restore target factory omitted async wrapper

- **Status:** closed
- **First observed:** 2026-07-27T03:38:11Z
- **Last observed:** 2026-07-27T03:39:49Z
- **Phase/task:** Phase B restore Task 2
- **Environment:** Local Phase B worktree
- **Version/commit:** `e177170`

## Symptom

The first Task 2 type check rejected the production restore factory because
its target callback returned the concrete managed target directly while the
injected engine boundary requires a promise.

## Impact

The scheduler and classifier tests passed, but the task was not type-correct
and was stopped before staging or commit. No provider, database, backup,
secret, or private state changed.

## Reproduction conditions

Connect the synchronous concrete Neon target constructor directly to the
asynchronous `createTarget` dependency and run the TypeScript gate.

## Safe evidence

TypeScript reported one return-type mismatch in the scheduled production
factory. No runtime or provider-controlled value was rendered.

## Attempts and outcomes

- The initial type check failed with one compile-time mismatch.
- The callback was wrapped asynchronously, and the complete type check passed
  after a separate fixture-only diagnostic was corrected.

## Cause classification

- **Confirmed cause:** The production callback omitted an async wrapper around
  a synchronous concrete constructor.
- **Hypotheses:** None.
- **Rejected hypotheses:** The authoritative injected dependency does not need
  to become synchronous.
- **Known exclusions:** Cron routing, restore policy, target identity, and
  evidence parsing were not implicated.

## Correction and prevention

- **Correction:** Wrap only the concrete callback in an async function.
- **Prevention:** Compare callback return types as well as parameter types
  during production-factory interface review.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

`pnpm.cmd typecheck` exited zero after the asynchronous callback wrapper.

## Recurrence history

- 2026-07-27T03:38:11Z: First observed and contained before commit.

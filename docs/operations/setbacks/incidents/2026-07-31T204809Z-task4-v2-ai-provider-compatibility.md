# SB-20260731-204809-task4-v2-ai-provider-compatibility: Task 4 v3 repair broke historical v2 AI provider verification

- **Status:** closed
- **First observed:** 2026-07-31T20:48:09.5029734Z
- **Last observed:** 2026-07-31T20:55:37.1860195Z
- **Phase/task:** Phase B Task 4 rollback-intent independent review
- **Environment:** Local source/test review
- **Version/commit:** 2cf0ff1 plus uncommitted Task 4 implementation

## Symptom

Historical v2 AI candidate intents still parse, but intent details erased the
v2/v3 discriminator before provider-state matching. The matcher therefore
required the new v3 scheduled binding from a historical provider inventory
that legitimately predates it.

## Impact

A historical v2 AI candidate classified as `may_have_started` could fail both
normal-state and candidate-state admission before immutable-normal redeployment,
blocking safe rollback. No live workflow or provider mutation occurred.

## Cause classification

- **Confirmed cause:** Candidate-intent generation was not propagated through
  the details and provider-binding comparison boundary.
- **Contributing cause:** The first v3 test set proved parsing compatibility but
  did not exercise historical v2 AI provider-state verification.
- **Known exclusions:** No provider, network, database, secret, workflow,
  staging state, or commit changed during discovery.

## Correction and prevention

- **Correction:** Preserve intent generation in details; validate the original
  v2 AI binding inventory separately from v3; compare v3 against the exact
  stored scheduled value rather than deriving it again.
- **Prevention:** Compatibility tests for versioned artifacts must traverse the
  full downstream verifier, not stop after parsing.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Recurrence history

- 2026-07-31T20:48:09.5029734Z: Confirmed by independent sanitized source and
  test review; repair assigned before commit or live use.
- 2026-07-31T20:55:37.1860195Z: Closed after version-aware provider matching
  passed 27 rollback lifecycle tests and 104 direct provider-state tests,
  including exact historical v2 and exact/missing/drifted v3 inventories.

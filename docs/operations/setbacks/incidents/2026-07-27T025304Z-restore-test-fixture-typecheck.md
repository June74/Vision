# SB-20260727-025304-restore-test-fixture-typecheck: Restore test fixtures failed TypeScript checks

- **Status:** closed
- **First observed:** 2026-07-27T02:53:04.228543Z
- **Last observed:** 2026-07-27T02:53:57Z
- **Phase/task:** Phase B restore Task 1
- **Environment:** Local managed Windows workspace
- **Version/commit:** `1ce1b889466faf9e6395d7881a29bb1664fc8b13` plus Task 1 working changes

## Symptom

Task 1 focused assertions passed, but test-project type checking reported fixture-only assignability errors.

## Impact

No production behavior failed and no private value was exposed; final verification was delayed until fixture types were corrected.

## Reproduction conditions

Run the Task 1 type-check command after adding the new integration fixtures.

## Safe evidence

The test project reported five assignability diagnostics limited to the new
retention and restore fixture declarations. The runtime project passed.

## Attempts and outcomes

- The focused assertions passed before type checking.
- The metadata fixture was explicitly typed as the shared object-head
  contract and now owns a record-shaped metadata copy.
- The managed-target close spy was narrowed to an asynchronous zero-argument
  mock.

## Cause classification

- **Confirmed cause:** Two fixture declarations were broader or narrower than
  the shared TypeScript ports: the closed metadata interface lacked a string
  index signature, and the generic mock type did not guarantee an asynchronous
  zero-argument call signature.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** Production restore behavior, privacy boundaries, and
  runtime compilation were unaffected.

## Correction and prevention

- **Correction:** Typed the retention head through the shared reader contract
  and narrowed the close spy to `Mock<() => Promise<void>>`.
- **Prevention:** Run test-project type checking immediately after introducing
  new shared-port fixtures.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

`pnpm.cmd typecheck` exited zero after the fixture-only correction.

## Recurrence history

- 2026-07-27T02:53:04.228543Z: First observed.

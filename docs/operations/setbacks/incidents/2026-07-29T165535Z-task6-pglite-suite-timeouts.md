# SB-20260729-165535-task6-pglite-suite-timeouts: Full unit gate hit three PGlite timeouts

- **Status:** closed
- **First observed:** 2026-07-29T16:52:19Z
- **Last observed:** 2026-07-29T16:56:22Z
- **Phase/task:** Phase B acceptance instrumentation Task 6 full gate
- **Environment:** Local Phase B linked worktree
- **Version/commit:** `1c7f89b`

## Symptom

The full unit gate timed out in two existing database-backed backup
interleaving tests and one existing OAuth admission setup hook.

## Impact

`pnpm check` stopped at the unit stage after 1,014 tests passed, two were
skipped, and three timed out. Contract, Worker, build, documentation, and
security stages did not run in that command. No runtime, provider, browser, or
network state changed.

## Reproduction conditions and safe evidence

The failures were all default five- or ten-second test timeouts while the full
79-file suite ran concurrently. Task 6 does not modify the failed backup or
OAuth files.

## Attempts and outcomes

- Typecheck completed before the unit gate.
- The focused Task 6 suite had already passed 185 tests with one intentional
  skip.
- The two failed files passed all 34 tests in isolation in 9.29 seconds,
  confirming the timeout did not reproduce.

## Cause classification

- **Confirmed cause:** The immediate failure was timeout expiration.
- **Hypotheses:** Full-suite PGlite resource contention is likely because three
  unrelated existing database tests timed out together.
- **Rejected hypotheses:** No Task 6 source or test appears in the failure
  stack.
- **Known exclusions:** No live service, migration, secret, or evidence schema
  changed.

## Correction and prevention

- **Correction:** Preserve the tests unchanged and accept the isolated
  reproducibility check as evidence that the first failure was suite-level
  contention; rerun the complete unit gate once.
- **Prevention:** Do not weaken concurrency assertions or raise timeouts without
  a reproducible source-level cause.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Run the two failed files in isolation.

## Verification and related work

The exact two-file rerun passed 34 of 34 tests. The complete unit gate remains
the next verification step.

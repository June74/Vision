# SB-20260726-191224-wrangler-dry-run-probe-failed: Wrangler dry-run diagnostic failed

- **Status:** closed
- **First observed:** 2026-07-26T19:12:24.870591Z
- **Last observed:** 2026-07-26T19:12:24.870591Z
- **Phase/task:** Phase B deployment diagnostics
- **Environment:** Local Windows worktree
- **Version/commit:** `codex/phase-b-foundation`

## Symptom

Both local dry-run deployment probes exited before producing binding metadata, so their absence checks were inconclusive.

## Impact

No deployment occurred; the variable-propagation diagnosis paused for safe error classification.

## Reproduction conditions

Attempt local Wrangler dry runs through the package runner and then directly
against an environment-selected generated artifact.

## Safe evidence

The first invocation did not resolve Wrangler. Direct invocations then failed
because the generated artifact has no named environment and the local bundler
could not traverse a sandbox boundary; one process also crashed.

## Attempts and outcomes

- Two package-runner probes failed before metadata.
- Direct and permission-elevated dry runs remained unreliable.
- The probe was stopped after repeated failure.
- Live state, generated config, focused tests, and current official
  documentation supplied the required evidence instead.

## Cause classification

- **Confirmed cause:** The chosen dry-run path combined Windows executable
  resolution, generated-config environment mismatch, and sandbox traversal.
- **Hypotheses:** None.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No live deployment occurred during any dry run.

## Correction and prevention

- **Correction:** Abandoned the unreliable probe and used independent evidence
  at each source/build/live boundary.
- **Prevention:** Do not use deploy dry-run as the first config oracle for this
  generated Vite artifact in the managed Windows worktree.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The root cause was confirmed without another dry-run retry, and focused tests
plus artifact validation pass.

## Recurrence history

- 2026-07-26T19:12:24.870591Z: First observed.

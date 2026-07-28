# SB-20260728-195015-runtime-env-fixture-thresholds-missing: Runtime environment fixture omitted required thresholds

- **Status:** closed
- **First observed:** 2026-07-28T19:50:15.7074285Z
- **Last observed:** 2026-07-28T19:50:15.7074285Z
- **Phase/task:** Phase B acceptance instrumentation Task 2 GREEN
- **Environment:** Local Phase B worktree
- **Version/commit:** Task 2 patch based on `429124f`

## Symptom

One pre-existing backup-pairing test failed when its otherwise valid preview
runtime fixture was rejected for missing storage warning thresholds.

## Impact

The focused configuration gate failed. No provider or runtime state changed.

## Reproduction conditions

Parse the test's preview runtime fixture after making all three warning
thresholds mandatory outside local.

## Safe evidence

The constant Zod issue named only the missing threshold contract.

## Attempts and outcomes

- The dedicated threshold tests and Wrangler checks passed.
- The valid branch of the backup-pairing fixture lacked the new fields.

## Cause classification

- **Confirmed cause:** The Task 2 test update missed one valid RuntimeEnvSchema
  fixture.
- **Hypotheses:** None.
- **Rejected hypotheses:** Backup key pairing behavior did not regress.
- **Known exclusions:** No secrets or provider details entered diagnostics.

## Correction and prevention

- **Correction:** Add the approved three threshold strings to the shared
  preview runtime fixture.
- **Prevention:** Run the complete environment test file after schema changes.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None while closed.

## Verification and related work

The four-file environment, routing, zeroization, and client-boundary gate is
rerun after the fixture correction.

## Recurrence history

- 2026-07-28T19:50:15.7074285Z: First observed and contained.

# SB-20260731-182610-cleanup-cross-lane-residue-inventory: Cleanup test missed a test file changed by the parallel restore lane

- **Status:** closed
- **First observed:** 2026-07-31T18:26:10.1547348Z
- **Last observed:** 2026-07-31T18:27:33.1690763Z
- **Phase/task:** Phase B Task 3 full-check regression repair
- **Environment:** Local combined focused tests
- **Version/commit:** 476d417 plus lifecycle and two isolated test repairs

## Symptom

The cleanup test passed in its isolated lane, but the subsequent combined suite
reported one additional active-residue path: the restore re-admission test that
the parallel fixture-repair lane had modified.

## Impact

The combined focused suite reported one bookkeeping assertion failure while 32
other tests passed. Product code and provider behavior are unaffected. No
provider, network, environment, secret, staging, or commit was touched.

## Cause classification

- **Confirmed cause:** The strict cleanup residue inventory was verified before
  the independent restore lane added its owned test path to the worktree.
- **Hypotheses:** None remaining.
- **Known exclusions:** Both the cleanup timing assertions and restore fixture
  behaviors pass independently.

## Correction and prevention

- **Correction:** Add the exact restore re-admission test path to the cleanup
  test's shared-residue inventory and rerun the combined suite.
- **Prevention:** Reconcile strict changed-path inventories after parallel lanes
  finish, even when every isolated suite passes.
- **Owner:** Codex.
- **Next diagnostic step:** Rerun the three-file combined focused suite.

## Recurrence history

- 2026-07-31T18:26:10.1547348Z: Observed and contained in local combined
  verification.
- 2026-07-31T18:27:01.4329685Z: The first correction exposed two paired fixed
  length assertions still set to 49; both must move to 50 with the inventory.
- 2026-07-31T18:27:33.1690763Z: Closed after adding the exact path, updating
  both count assertions, and passing the combined three-file suite 33 of 33.

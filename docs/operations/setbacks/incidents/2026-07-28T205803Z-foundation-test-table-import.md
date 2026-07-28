# SB-20260728-205803-foundation-test-table-import: Foundation test imported table contract from the wrong module

- **Status:** closed
- **First observed:** 2026-07-28T20:58:03.3203968Z
- **Last observed:** 2026-07-28T21:05:39.3430100Z
- **Phase/task:** Phase B acceptance instrumentation Task 3 expanded RED
- **Environment:** Local Windows worktree
- **Version/commit:** `36f9df2` plus uncommitted Task 3 tests

## Symptom

The expanded RED run failed some data-source cases before the intended source
API boundary because the synthetic fixture imported `BACKUP_TABLES` from the
new privilege module instead of the production schema contract.

## Impact

Those cases did not yet measure the intended missing implementation. No
production, provider, credential, or private state changed.

## Reproduction conditions

Load the synthetic data fixture while the privilege module does not re-export
the production table list.

## Safe evidence

The production source of truth is
`src/domain/backup/schema-contract.ts`; the fixture import targeted
`src/domain/operations/phase-b-privilege-manifest.ts`.

## Attempts and outcomes

- The expanded RED run exposed the import mismatch together with the intended
  missing comparator, source, job, classifier, and CLI behaviors.
- The fixture import is corrected to the production schema contract before
  GREEN implementation continues.

## Cause classification

- **Confirmed cause:** The test fixture used the new module as a convenience
  import instead of the existing authoritative schema-contract export.
- **Hypotheses:** None.
- **Rejected hypotheses:** The table contract itself was not missing.
- **Known exclusions:** No production or external state changed.

## Correction and prevention

- **Correction:** Import `BACKUP_TABLES` from the production schema contract.
- **Prevention:** Test fixtures derive schema facts from the same production
  contract named in the binding plan.
- **Owner:** Codex.
- **Next diagnostic step:** None while closed.

## Verification and related work

The corrected fixture is included in the next focused Task 3 run.

## Recurrence history

- 2026-07-28T20:58:03.3203968Z: First observed and corrected before GREEN.
- 2026-07-28T21:05:39.3430100Z: The first GREEN run exposed four additional
  test-harness assumptions: an expected R2 size was read before the awaited
  probe completed, quoted privilege names were treated as SQL statements, a
  JavaScript array was compared to a typed array after zeroization, and
  JSON serialization normalized hostile object descriptors. The assertions
  were corrected to test the intended boundaries; production and provider
  state remained unchanged.

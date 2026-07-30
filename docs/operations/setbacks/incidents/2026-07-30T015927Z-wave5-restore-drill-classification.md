# SB-20260730-015927-wave5-restore-drill-classification: Restore evidence was classified as an active cleanup manual

- **Status:** closed
- **First observed:** 2026-07-30T01:59:27.3952449Z
- **Last observed:** 2026-07-30T02:02:33.1614903Z
- **Phase/task:** Phase B acceptance instrumentation Task 7 final-fix wave 5
- **Environment:** Local Phase B linked worktree
- **Version/commit:** Uncommitted cleanup-contract regression based on `3b735be`

## Symptom

The first content-level cleanup regression classified
`docs/operations/restore-drill.md` with four current active-manual paths. The
preliminary count was therefore 60 dedicated and 40 shared paths.

## Impact

The intended RED run named five operations documents instead of the reviewed
four-document active set. No runtime, provider, browser, network, Git metadata,
or external state changed.

## Reproduction conditions and safe evidence

Read the mixed restore drill as an operator manual because it contains
imperative listener and candidate wording, without first applying the cleanup
map's explicit restore-evidence retention boundary.

## Attempts and outcomes

- The default test failed with one inventory assertion and seven passes.
- The strict test failed with the content map plus the two existing residue
  assertions and five passes.
- An independent read-only audit classified the restore drill as retained
  evidence.
- The cleanup map explicitly requires the restore drill to record cleanup
  without erasing historical evidence.

## Cause classification

- **Confirmed cause:** The preliminary classification treated imperative text
  inside a mixed evidence record as proof that the whole document was an active
  manual.
- **Hypothesis:** The restore drill might need shared-modify classification
  because Task 8 updates its completion state.
- **Rejected hypothesis:** Task 8 may update the record, but strict cleanup must
  not force its historical role-probe and candidate facts out.
- **Known exclusions:** The four unequivocal active manuals and permanent
  offline restore documentation remain correctly classified.

## Correction and prevention

- **Correction:** Move the restore drill into the explicit retained-historical
  mapping and narrow content-level cleanup to cost review, environments,
  incident runbook, and active secret inventory.
- **Prevention:** Resolve mixed operations/evidence documents against the
  explicit Task 8 retain/modify map before converting imperative wording into a
  strict-cleanup marker.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** None; the corrected boundary is verified.

## Verification and related work

The corrected default RED produced one failed inventory assertion and seven
passes, naming exactly the four missing shared-modify manuals. The corrected
strict RED produced three failures and five passes: the content-level map named
only those four manuals, while the existing shared and dedicated assertions
remained intentionally RED. The reviewed inventory is 60 dedicated paths and
39 shared paths after the four active manuals are wired in.

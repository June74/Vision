# Listener-Before-Activation Preview Restore Retry Design

**Status:** Approved approach; written-spec review pending

**Approved by:** Project owner

**Approval date:** 2026-07-27

**Environment:** Preview only

## Purpose

Capture the required explicit `vision.preview-restore/v1` success record from one
safe disposable-branch restore while preserving the existing fail-closed restore
controls. This retry must not touch production data, expose credentials, or
change the preview backup encryption key.

## Problem

The previous restore observation started after deployment. GitHub step timing
showed a 127-second gap between completion of the restore-candidate deployment
and the start of the safe-tail step. With the temporary one-minute schedule, two
scheduled opportunities existed during that gap.

The retained disposable target was positively verified empty before deployment.
Afterward, all 29 authoritative tables were present and 51 authoritative rows
existed across 13 tables, with zero event rows. The first scheduled invocation
therefore strongly appears to have completed the import before the listener was
active. The later captured invocation correctly returned
`restore_target_not_empty`, refusing to overwrite the now-populated target.

Indirect database evidence is not a substitute for the Phase B requirement to
capture the explicit allowlisted success record. The retry must eliminate the
observation gap.

## Selected Approach

Start the safe-tail observer first, verify that its allowlisted listener step is
actively running, and only then deploy the temporary restore candidate.

The GitHub workflows will use conditional concurrency groups:

- Safe-tail observer runs use a dedicated observer group.
- Preview deployment, verification, and AI Gateway configuration runs use the
  existing preview-mutation group.
- `cancel-in-progress` can cancel only another run in the same category.

This permits the read-only observer and the reviewed restore deployment to run
at the same time without allowing two preview mutations to overlap.

## Alternatives Not Selected

1. **Write durable restore evidence to R2 or PostgreSQL.** This would add new
   persistent state, retention rules, credentials, and cleanup work solely for
   acceptance evidence.
2. **Accept the database state as proof.** The atomic importer and target state
   strongly support success, but they do not meet the explicit safe-record
   acceptance requirement.
3. **Depend on a local Wrangler tail.** This would rely on local credential
   state and a fragile long-lived local process instead of the existing
   allowlisted CI observer.

## Safety Invariants

- `BACKUP_ENCRYPTION_KEY` remains unchanged at key version 1. It is never
  printed, requested, copied, or rotated.
- Only the exact attested disposable preview restore branch may be cleared or
  deleted. Production and the normal preview database are never mutation
  targets for this procedure.
- The target must pass the existing identity attestation immediately before
  clearing, after clearing, and before deployment.
- Current authoritative table and row counts must be recorded through the
  existing value-safe aggregate inspection before clearing.
- Clearing occurs in one serializable database transaction and covers only the
  29 authoritative application tables on the attested disposable target.
- Deletion order must respect foreign-key dependencies, or use an equivalent
  transaction-safe operation already supported by the target database.
- The transaction must roll back on any statement, count, or attestation
  failure.
- After clearing, every authoritative table must be empty and the target
  attestation must still pass. Otherwise the procedure stops before secrets are
  recreated or any Worker is deployed.
- Secret values, database identifiers, provider-private URLs, object keys, and
  personal data never appear in logs, documentation, commits, or chat output.
- The safe-tail workflow must be in its
  `Print only allowlisted scheduled evidence` step before the restore candidate
  is deployed.
- Safe-tail remains `--restore-only`, with its existing 16-minute observation
  window and 18-minute job timeout.
- The only acceptable result is one schema-valid
  `vision.preview-restore/v1` record with `outcome=succeeded` and all required
  safe evidence fields valid.
- A failed, missing, ambiguous, duplicated, or malformed result triggers normal
  Worker restoration, temporary-secret deletion, and disposable-branch
  retention.
- The disposable branch is permanently deleted only after explicit success,
  normal Worker restoration, temporary-secret deletion, and independent health
  and schedule verification.

## Execution Sequence

1. Implement and test the conditional workflow concurrency change.
2. Independently review the exact workflow change, then commit and push the
   reviewed head.
3. Privately re-attest the retained disposable target.
4. Read and record only its safe aggregate state: authoritative table count,
   non-empty table count, total authoritative row count, and event row count.
5. In one serializable transaction, clear all authoritative application tables
   from that disposable target only.
6. Re-attest the target and verify all authoritative row counts are zero.
7. Recreate only the two temporary restore secrets. Log their names and
   create/delete actions without values.
8. Dispatch the safe-tail workflow.
9. Poll workflow state until the allowlisted evidence-listener step is actively
   running. If it does not become active within the bounded wait, stop without
   deploying.
10. Deploy the exact independently reviewed temporary restore candidate.
11. Accept only one exact-schema `vision.preview-restore/v1` success record from
    the already-running observer.
12. Restore the normal preview Worker from its immutable normal reference.
13. Delete both temporary restore secrets and verify they are absent.
14. Independently verify the normal health response and schedules, including
    absence of the temporary one-minute restore schedule.
15. Remove temporary restore code, configuration, and tests in a cleanup
    commit; run the complete Phase B verification and independent review; then
    deploy the reviewed normal result.
16. Permanently delete the disposable Neon branch only after the success
    evidence and all preceding cleanup checks pass.
17. Update the restore evidence, credential-change log, setback log, and Phase B
    handoff documentation without private values.

## Failure Handling

- **Target attestation or clearing fails:** roll back the transaction and stop
  before secret creation or deployment. Retain the branch.
- **Observer does not reach the active listener step:** cancel or allow the
  observer to expire; do not deploy. Delete any temporary secrets and retain the
  branch.
- **Restore deployment fails:** restore the normal Worker if necessary, let the
  read-only observer end harmlessly, delete temporary secrets, and retain the
  branch.
- **No record, failure record, malformed record, multiple records, or ambiguous
  evidence:** restore the normal Worker, delete temporary secrets, and retain
  the branch for diagnosis.
- **Normal rollback, secret deletion, health check, or schedule check fails:**
  do not delete the disposable branch. Continue fail-closed containment and log
  the setback.
- **Explicit success and all cleanup checks pass:** permanently delete the
  disposable branch and verify deletion.

Every unexpected error, incorrect assumption, or unplanned delay is recorded in
`docs/operations/setbacks/` before work continues.

## Verification

The implementation must prove:

- Safe-tail and preview mutation runs resolve to distinct concurrency groups.
- Repeated safe-tail runs can cancel only another safe-tail run.
- Preview verification, deployment, and Gateway configuration remain mutually
  exclusive in the preview-mutation group.
- Safe-tail retains `--restore-only`, a 16-minute observation window, and an
  18-minute timeout.
- Operator documentation requires listener-active confirmation before
  deployment.
- Target-clear logic fails closed on attestation, table-set, transaction, or
  post-clear count mismatches.
- Secret and diagnostic output remains value-free.
- TypeScript, unit, contract, Worker, documentation, production build, security,
  and end-to-end checks pass.
- An independent review of the exact implementation range reports no unresolved
  findings before live execution.

## Completion Criteria

This retry is complete only when all of the following are true:

- One explicit allowlisted `vision.preview-restore/v1` success record was
  captured.
- Its schema, outcome, counts, and evidence booleans all pass validation.
- The normal preview Worker is restored and healthy.
- The normal schedules are present and the temporary restore schedule is
  absent.
- Both temporary restore secrets are verified absent.
- The disposable Neon restore branch is permanently deleted and deletion is
  verified.
- `BACKUP_ENCRYPTION_KEY` is confirmed unchanged at key version 1.
- Temporary restore code is removed, all Phase B gates pass, the reviewed normal
  build is deployed, and the operational evidence and handoff documentation are
  current.

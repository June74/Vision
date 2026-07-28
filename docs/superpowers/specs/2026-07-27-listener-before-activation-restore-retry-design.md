# Listener-Before-Activation Preview Restore Retry Design

**Status:** Approved one-shot Worker recovery; implementation pending

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

## Approved One-Shot Worker Recovery

The Neon SQL editor is retired for the disposable-target clear. Its history
proved that a reviewed 4,166-character transaction was submitted only
partially, and the subsequent full-selection proof selected only 1,325
characters. No additional editor workaround is permitted. The target remained
unchanged at 29 authoritative tables, 51 total authoritative rows, 13 non-empty
tables, and zero event rows.

The approved temporary Node-backed process also failed closed before SQL
because its network boundary could not reach Neon. Chrome renderer injection is
not supported for database writes, and a shell or clipboard bridge remains
prohibited.

The clear and restore therefore run together in one reviewed, preview-only
Cloudflare scheduled invocation. No HTTP route or public endpoint is added:

1. Recreate only the two already-approved temporary Worker secrets directly
   through signed-in provider controls. The database connection stays within
   the provider/Worker secret boundary and never enters GitHub.
2. Before claiming or touching the database, select, authenticate, decrypt, and
   logically validate the exact backup candidate.
3. Atomically claim one opaque R2 attempt marker outside the `backups/v1/`
   namespace. Only the claimant may open the disposable target. A non-owner
   performs no database call and emits no observer-accepted record.
4. On one `Pool({ max: 1 })` client, begin a serializable transaction, require
   `current_user=vision_app`, validate and lock the exact attestation, lock all
   29 authoritative tables, and require every per-table count to match the
   already-validated backup manifest as well as the safe
   29-table/51-row/13-non-empty/zero-event aggregate.
5. Delete only the 29 authoritative tables in reverse dependency order, require
   29 tables and zero rows, and require the attestation to remain unchanged.
   Commit only if every assertion succeeds.
6. Restore the already-validated candidate into the now-empty target through
   the existing transaction-locked importer. Do not relist or silently select a
   different object.
7. Run the existing independent read-back, checksum, reference, and readable
   event verification. Emit exactly one allowlisted
   `vision.preview-restore/v1` result only after the restore succeeds.
8. Keep the R2 attempt marker while any destructive candidate can run. After
   the immutable normal Worker is restored, the one-minute schedule is absent,
   and both temporary secrets are absent, delete the sole opaque marker through
   the signed-in R2 control without returning its key.

The attempt marker is a safety fence, not restore evidence. It prevents a
delayed old one-minute invocation from clearing the newly restored
29-table/51-row target again. If the owner crashes after claiming the marker,
the attempt is intentionally burned, automatic retry is prohibited, and the
disposable branch is retained for diagnosis.

## Alternatives Not Selected

1. **Write durable restore evidence to R2 or PostgreSQL.** The opaque R2
   one-shot fence is not evidence and stores no result. Durable acceptance
   evidence would add unnecessary retention and privacy surface.
2. **Accept the database state as proof.** The atomic importer and target state
   strongly support success, but they do not meet the explicit safe-record
   acceptance requirement.
3. **Depend on a local Wrangler tail.** This would rely on local credential
   state and a fragile long-lived local process instead of the existing
   allowlisted CI observer.
4. **Continue using the Neon SQL editor.** Two independently measured partial
   submissions made another UI retry unsafe.
5. **Bridge the connection through a file, clipboard, shell environment, or
   command argument.** Each option creates an unnecessary persistence or output
   path for a credential.
6. **Inject the Neon driver into the signed-in dashboard renderer.** The
   browser-control evaluation boundary is read-only, the provider page is not a
   trusted secret-execution context, and renderer cleanup cannot be proven.
7. **Use only the 29/51/13/0 aggregate as a retry gate.** A successful restore
   can recreate the same aggregate, so an old invocation could clear it again.

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
- The private connection value exists only as a masked Cloudflare Worker
  secret. It never enters GitHub, commands, local files, clipboard output,
  logs, documentation, screenshots, or chat.
- Backup authentication, decryption, manifest validation, checksum validation,
  row-count validation, and reference validation finish before the one-shot
  fence is claimed or the database is opened.
- Exactly one invocation may claim the opaque R2 fence. Every non-owner exits
  before database access and emits no accepted restore evidence.
- The locked pre-clear state must match the validated backup's complete
  per-table manifest and the safe 29/51/13/0 aggregate.
- Deletion order must respect foreign-key dependencies, or use an equivalent
  transaction-safe operation already supported by the target database.
- The transaction must roll back on any statement, count, or attestation
  failure.
- After clearing, every authoritative table must be empty and the target
  attestation must still pass before the same owning invocation restores the
  already-validated backup candidate.
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
3. Implement, test, independently review, commit, and push the temporary
   one-shot clear-and-restore candidate and its R2 claim boundary.
4. Recreate only the two temporary restore secrets. Log their names and
   create/delete actions without values.
5. Dispatch the restore-only safe-tail workflow.
6. Poll workflow state until the allowlisted evidence-listener step is actively
   running. If it does not become active within the bounded wait, stop without
   deploying.
7. Deploy the exact independently reviewed one-shot candidate.
8. Permit only the R2 fence owner to validate the backup, clear the attested
   target, restore the same prepared backup, and run independent read-back.
9. Accept only one exact-schema `vision.preview-restore/v1` success record from
    the already-running observer.
10. Restore the normal preview Worker from its immutable normal reference.
11. Delete both temporary restore secrets and verify they are absent.
12. Independently verify the normal health response and schedules, including
    absence of the temporary one-minute restore schedule.
13. Delete the sole opaque R2 attempt marker through the signed-in provider
    control without returning its key.
14. Remove temporary restore code, configuration, and tests in a cleanup
    commit; run the complete Phase B verification and independent review; then
    deploy the reviewed normal result.
15. Permanently delete the disposable Neon branch only after the success
    evidence and all preceding cleanup checks pass.
16. Update the restore evidence, credential-change log, setback log, and Phase B
    handoff documentation without private values.

## Failure Handling

- **Backup validation fails before the fence:** emit only a closed failure,
  perform no database call, and retain the branch.
- **Fence is already owned:** emit no accepted record and perform no database
  call.
- **Fence owner fails during clear or restore:** roll back the active
  transaction, close the client and pool, burn the attempt without automatic
  retry, restore the normal Worker, delete the temporary secrets, and retain the
  branch.
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
- The clear uses one retained `Pool` client for the complete serializable
  transaction, and restore uses the same already-validated backup candidate.
- An atomic R2 create-if-absent test proves exactly one owner; concurrent,
  delayed, and post-restore invocations perform no database work.
- The locked target must match every validated backup-manifest table count, not
  only aggregate totals.
- No connection value or R2 marker key reaches GitHub, disk, shell state, logs,
  returned tool text, screenshots, documentation, or chat.
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

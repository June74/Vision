# Temporary Preview Worker Restore Design

**Status:** Approved
**Approved by:** Project owner  
**Approval date:** 2026-07-27  
**Written-spec approval date:** 2026-07-27
**Environment:** Preview only  
**Purpose:** Complete the Phase B encrypted restore drill without rotating or
exporting the existing backup key.

## Problem

The verified R2 backup is encrypted with the current preview
`BACKUP_ENCRYPTION_KEY`. Cloudflare makes the stored Worker secret available to
the Worker but does not reveal it to the local operator. The local restore
command therefore cannot decrypt the backup, and the user has explicitly
prohibited key rotation.

The approved solution temporarily performs the restore inside the existing
preview Worker, where the unchanged key is already available. It restores only
into the separately attested disposable Neon branch. It never writes to the
normal preview database.

## Considered approaches

### Selected: temporary preview-only scheduled restore

A short-lived scheduled Worker path uses the existing R2 binding and backup
key, plus temporary target-only secrets. This keeps the key inside Cloudflare,
preserves the current encrypted object, and avoids exposing an operator
endpoint.

### Rejected: permanent operator restore endpoint

An authenticated HTTP endpoint would be easier to trigger, but it would leave
a durable destructive surface in the application. The one-time drill does not
justify that attack surface.

### Rejected: local restore or key rotation

The local command cannot use a key it does not possess. Rotating the key and
creating a replacement backup would work technically, but it contradicts the
user's explicit instruction to keep the preview backup key unchanged.

## Safety invariants

- `BACKUP_ENCRYPTION_KEY` and `BACKUP_KEY_VERSION` remain unchanged.
- The normal preview `DATABASE_URL` is never passed to the restore adapter.
- The restore target must independently attest:
  - environment `preview`;
  - `disposable = true`;
  - the exact expected target identity;
  - schema version 9;
  - the reviewed migration checksum and attestation revision.
- The target must be empty. This temporary path never enables replacement of a
  non-empty target.
- Backup metadata, native object checksum, canonical envelope, ciphertext
  digest, authenticated decryption, manifest, schema version, plaintext
  checksum, row counts, and cross-table references must pass before promotion.
- Promotion remains one serializable, lock-protected transaction.
- No branch identifier, object key, database URL, key, token, account
  identifier, OAuth value, protected row, or provider-controlled URL may enter
  logs, documentation, CI output, or chat.
- A failed or uncertain restore leaves the disposable branch in place and
  blocks cleanup.
- The disposable branch is deleted only after restore verification, normal
  Worker redeployment, temporary-secret removal, and live health verification.

## Temporary configuration

Two short-lived Worker secrets are introduced:

- `PREVIEW_RESTORE_DATABASE_URL`: the disposable branch connection using the
  existing least-privileged `vision_app` role.
- `PREVIEW_RESTORE_TARGET_ID`: the independently expected target identity.

Both values are transferred directly between signed-in provider controls and
Cloudflare secret storage. They are never printed or copied into repository
files. Their creation and deletion are recorded in
`docs/operations/credential-change-log.md` without values.

The existing backup key is neither rewritten nor re-entered. No object-key
secret is added. The Worker selects the candidate through the fixed private R2
prefix.

## Components

### Temporary restore job

A focused `src/jobs/temporary-preview-restore.ts` module will:

1. Require `VISION_ENV === "preview"`.
2. Validate the two temporary target secrets without echoing them.
3. List only the fixed `backups/v1/` prefix.
4. Validate every candidate's path and closed metadata shape.
5. Select the newest UTC backup date and require exactly one candidate for
   that date.
6. Reuse `readVerifiedStoredBackup` with the existing backup key.
7. Open the target only after stored-object verification succeeds.
8. Call the existing `importBackup` path with replacement disabled.
9. Close the target connection in `finally`.
10. Run the independent post-restore verification described below.

The module has one injected dependency interface so candidate selection,
restore, verification, logging, and cleanup can be tested without providers.

### Scheduled entry

The temporary candidate adds one exact every-minute preview cron. The
`scheduled` dispatcher routes it only to the restore job. Existing 15-minute
calendar maintenance and daily recovery routes remain unchanged.

The temporary cron is intentionally absent from the final repository state and
final deployed Worker. An unsupported cron continues to fail closed.

### Post-restore verifier

After transaction commit, the Worker reads all 29 authoritative target tables
through the existing repeatable-read snapshot adapter. It then:

- recomputes canonical row counts;
- validates graph and foreign-key references;
- recomputes the canonical plaintext archive SHA-256 and requires equality
  with the authenticated backup manifest;
- exercises the restored event-list query and records only whether it was
  readable plus its aggregate count;
- requires `replacedExisting === false`.

This independent read-back check proves the committed destination, not merely
the staging tables.

### Privacy-safe tail evidence

The safe-tail classifier gains a temporary restore classification. It accepts
only a closed structured result with:

- outcome and allowlisted failure category;
- format, schema version, key version, and authoritative table count;
- aggregate row counts;
- checksum-match, reference-valid, target-empty, and event-list-readable
  booleans;
- aggregate event count;
- `replacedExisting = false`.

It rejects extra keys, malformed counts, identifiers, URLs, free-form errors,
or provider-controlled text. Raw Worker tail output is never returned.

## Error behavior

The restore job maps failures to a small safe vocabulary:

- `restore_configuration_invalid`
- `restore_candidate_invalid`
- `restore_object_verification_failed`
- `restore_backup_validation_failed`
- `restore_target_attestation_failed`
- `restore_target_not_empty`
- `restore_promotion_failed`
- `restore_readback_verification_failed`
- `restore_unknown_failure`

The underlying error text is not logged. Any failure produces a non-success
scheduled outcome, redeployment of the normal Worker, retention of the
disposable branch, and an updated setback record.

Repeated temporary cron delivery is fail-closed: after one successful
promotion, the target is non-empty, so another invocation cannot replace or
duplicate data.

## Deployment and cleanup sequence

1. Implement with test-driven development and independent review.
2. Run focused restore, scheduler, classifier, environment, documentation, and
   security tests, followed by the full local release gates.
3. Commit and push the reviewed temporary candidate.
4. Configure the two temporary Worker secrets without exposing their values.
5. Deploy the exact reviewed commit with the temporary preview cron.
6. Capture one closed safe-tail result.
7. If the result is successful, verify the disposable target independently.
8. Remove the temporary restore code and cron in a cleanup commit.
9. Run the full release gates again and deploy that exact cleanup commit.
10. Delete both temporary Worker secrets and record their deletion.
11. Verify the normal maintenance and daily-recovery schedules, live health,
    and deployment attribution.
12. Permanently delete the disposable Neon branch.
13. Update `restore-drill.md`, `phase-b-evidence.md`, the setback ledger, and
    the credential-change log with safe evidence only.

If steps 5 through 11 do not all pass, step 12 is forbidden.

## Tests

The focused suite must cover:

- production or local environment rejection;
- absent, malformed, or extra temporary configuration;
- empty, malformed, ambiguous, or wrong-key-version backup candidates;
- tampered metadata, object bytes, envelope, manifest, and plaintext checksum;
- target URL role rejection and target identity mismatch;
- missing, production, non-disposable, wrong-schema, or wrong-migration
  attestation;
- non-empty target rejection before promotion;
- exact successful 29-table restore;
- row-count, reference, plaintext-checksum, and event-list read-back failure;
- database rollback on staging or promotion failure;
- repeated cron delivery failing without replacement;
- existing maintenance and daily backup dispatch remaining unchanged;
- safe-tail rejection of raw errors, identifiers, URLs, unexpected fields, and
  protected content;
- no event-level Google write surface;
- no temporary secret name or restore evidence leaking into the client bundle.

Documentation mirrors and JSDoc remain mandatory for every temporary
production module and named function. The cleanup commit removes obsolete
temporary references while preserving the final operational evidence.

## Completion criteria

This design is complete only when:

- the existing backup key has not changed;
- the encrypted backup is restored into the attested disposable branch;
- all cryptographic, schema, row-count, reference, and independent read-back
  checks pass;
- restored event listing is readable;
- the normal Worker is redeployed from an attributable reviewed commit;
- both temporary secrets and the temporary runtime path are removed;
- the disposable Neon branch is permanently deleted;
- safe evidence and credential-change records are committed and pushed.

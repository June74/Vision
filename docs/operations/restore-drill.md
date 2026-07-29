# Phase B encrypted restore drill

**Status:** In progress
**Source:** Private preview R2 bucket
**Target:** Empty disposable Neon branch only
**Live branch overwrite:** Forbidden

This document records only counts, booleans, timestamps, schema versions, and
checksums already defined as safe evidence. It never records object keys,
branch identifiers, credentials, database URLs, encryption keys, tokens,
emails, protected rows, or provider-controlled URLs.

## Approval and boundaries

| Action | Approval | Result |
|---|---|---|
| Create separate backup encryption key and store it as a Worker secret | Granted | Complete |
| Attach private preview R2 bucket and synchronization Queue | Granted | Complete |
| Deploy temporary backup schedule, create one verified encrypted object, restore the daily schedule | Granted | Complete |
| Apply migrations 0004 through 0009 to preview Neon | Granted | Complete |
| Create an empty disposable Neon branch, restore, verify, and permanently delete that branch | Granted | Pending |

The first temporary run was contained without an object after a read-only
schema comparison found the live preview database missing migrations 0004
through 0009. The normal daily cadence was redeployed and verified before the
migration approval is resolved.

## Listener-first retry

Confirm the allowlisted listener step is actively running before deploying the restore candidate.

Safe-tail observers use `vision-preview-observer`; deployment, verification, and Gateway configuration use `vision-preview-mutation`.

Runs in the same category cancel one another. Different categories may overlap.
Do not deploy if the observer never becomes active.

## Temporary read-only role probe

Before the fenced restore can claim its one-shot marker, deploy the separately
reviewed role-probe candidate only after the role-probe-only listener is
actively running. The candidate accepts only the preview environment marker
and `PREVIEW_RESTORE_DATABASE_URL`, opens one max-one retained client, performs
one fixed boolean role check, releases the client, closes the pool, and emits
only `vision.preview-role-probe/v1` evidence.

The probe has no restore, clear, R2, backup-key, target-identity, table, or HTTP
capability. Accept only one unambiguous succeeded record with
`category=none` and `roleMatches=true`. Any failure, malformed result,
duplicate ambiguity, missing result, or attribution mismatch stops the
restore. Immediately redeploy normal preview ref `40872a5` after the terminal
record, whether the probe succeeds or fails. The unchanged key remains at
version 1, and neither `backups/v1/` nor `restore-attempts/v1/` is accessed by
the probe.

## Fenced one-shot candidate

Before any target access, the temporary job verifies the stored encrypted
object and completes authentication, decryption, checksum, all 29 manifest
counts, canonical archive, and reference validation. It then claims one opaque
R2 marker under `restore-attempts/v1/`, outside `backups/v1/`. Pre-claim
rejections are silent. Only the claim owner may open the disposable target or
emit restore evidence; concurrent, delayed, and post-restore non-owners perform
zero database work and log nothing.

The owner uses one retained max-one pool client and one serializable
transaction. It requires `current_user=vision_app`, locks the exact
database-owned attestation and all 29 authoritative tables, rereads unchanged
attestation, and matches every prepared manifest count plus the safe
29-table/51-row/13-non-empty/zero-event aggregate. It deletes in reverse
dependency order, requires every count to be zero and the attestation still
unchanged, then restores the same prepared backup. Existing
`vision.preview-restore/v1` evidence is emitted only after independent count,
checksum, reference, and readable-event verification.

The attempt is burned on any owner failure and is not retried automatically.
The marker remains until the destructive runtime is inactive. The backup
encryption key remains unchanged at key version 1.

## Local migration preflight

Before any live schema change, the exact numbered migration chain was exercised
against a disposable local PostgreSQL-compatible database:

- Migrations 0001 through 0003 established the current live starting shape.
- Migrations 0004 through 0009 applied inside one transaction.
- All 11 previously missing required tables and all nine migration-signature
  columns were present afterward.
- A deliberately failed transaction rolled back both migration-0004 tables.
- The expected `vision_app` privileges matched across 13 affected tables.
- The affected tables exposed zero grants to `PUBLIC`.

The reviewed bundle was then copied into the signed-in Neon SQL editor,
verified against the local source by exact character count and SHA-256, and
executed as one transaction. A post-apply read-only check found zero missing
required tables and zero missing signature columns.

## Drill checklist

- [x] Guarded temporary schedule deployment succeeds.
- [x] One backup for the current UTC date is present.
- [x] Stored object metadata uses format `vision-backup/v1` and key version 1.
- [ ] Stored ciphertext checksum matches the retrieved bytes.
- [ ] Authenticated decryption validates the manifest before any database write.
- [ ] Backup schema version and migration checksum are supported.
- [ ] Raw encrypted object contains no protected sentinel.
- [x] Empty disposable Neon branch is created.
- [ ] All 29 migration-9 tables restore.
- [ ] Row counts and plaintext checksum match the backup manifest.
- [ ] Foreign-key and graph-reference checks pass.
- [ ] Event listing works against restored state.
- [ ] Disposable branch is permanently deleted.
- [x] Normal daily schedule `5 6 * * *` is redeployed and verified.

## Result

Pending. The first live attempt correctly failed closed because the database
did not match the authenticated migration-9 backup contract. Phase B cannot be
declared complete until the schema is current and every checklist item has
fresh live evidence.

# Encrypted backup and preview restore

## Scope and safety

Vision creates a logical backup of all 29 migration-9 tables once per UTC date. The archive preserves already
encrypted application fields as ciphertext, then encrypts the complete manifest and archive again with a separate
backup-only AES-256-GCM key.

Restore is intentionally limited to an independently attested disposable **preview** database. The command requires
a confirmation phrase before external I/O, rejects a missing or non-preview database attestation before staging, and
requires both replacement approval and an exact target-ID assertion when the preview target is not empty.

Never paste or log the backup key, application key, database URL, object body, or a command containing a real secret.

## Required environment configuration

Create two private R2 buckets before the corresponding deployments:

- `vision-preview-backups` is bound only by Wrangler environment `preview`;
- `vision-production-backups` is bound only by Wrangler environment `production`.

Never bind preview and production to the same bucket. Their deterministic same-date object paths are intentionally
safe only inside an environment-isolated store. The preview workflow selects
its Cloudflare environment during the Vite build with `CLOUDFLARE_ENV`; the
production workflow selects its environment during Wrangler deployment.
Neither environment may inherit a generic backup binding.

Configure these values through the normal Cloudflare secret and deployment-variable workflow:

| Binding | Storage | Purpose |
| --- | --- | --- |
| `BACKUP_ENCRYPTION_KEY` | Cloudflare secret | Dedicated canonical 256-bit base64url backup key |
| `BACKUP_KEY_VERSION` | Non-secret variable | Positive integer describing the active backup key |
| `BACKUP_BUCKET` | R2 binding | Private encrypted backup object store |

`BACKUP_ENCRYPTION_KEY` must not equal `KEY_ENCRYPTION_KEY`. Configure distinct backup keys in the preview and
production Cloudflare environments. Keep every historical backup key version in an operator-controlled secret
manager for as long as an object encrypted with that version may need restoration. Do not request, print, or commit
key values.

The restore process additionally reads:

| Process variable | Purpose |
| --- | --- |
| `PREVIEW_RESTORE_DATABASE_URL` | Least-privileged `vision_app` URL for the disposable preview branch |
| `PREVIEW_RESTORE_TARGET_ID` | Stable operator-known identity for that exact preview branch |

These values belong in the operator environment, never in arguments, source control, screenshots, or reports.

## Schedule and object policy

- Calendar maintenance remains `*/15 * * * *`.
- Backup and retention run at `5 6 * * *`, which is 06:05 UTC daily.
- Creation finishes and verifies the daily object before retention starts.
- The key is deterministic and opaque under
  `backups/v1/YYYY/MM/DD/<opaque-digest>.vision-backup`.
- Atomic create-if-absent makes repeated or concurrent same-date runs idempotent.
- Custom metadata contains only format, UTC creation date, ciphertext SHA-256, and key version.
- Post-write verification checks a fresh head, a fresh body read, the native R2 body SHA-256, canonical envelope
  serialization, ciphertext SHA-256, AES-GCM authentication, manifest/schema/date, plaintext archive SHA-256,
  canonical records/references, and all 29 row counts.
- Objects 0 through 29 whole UTC dates old are retained. Valid objects 30 dates old or older are deleted.
- Foreign or malformed objects are ignored rather than deleted.

A backup job is successful only after verification. If verification of a newly created object fails, Vision attempts
to remove it and reports failure. A failed deletion during retention reports failure so the next invocation can retry.

## Preview restore

First create or select a disposable Neon preview branch that has migrations 1 through 9 applied. Using its owner
credential, provision the restore-only attestation below and then grant the application role read-only access to it.
Do not create this table in production.

```sql
create table vision_restore_target_attestation (
  environment text not null check (environment = 'preview'),
  target_id text not null check (target_id <> ''),
  disposable boolean not null check (disposable),
  schema_version integer not null check (schema_version = 9),
  migration_sha256 text not null,
  attestation_revision text not null check (attestation_revision <> '')
);

revoke all on vision_restore_target_attestation from public;
grant select on vision_restore_target_attestation to vision_app;

insert into vision_restore_target_attestation (
  environment,
  target_id,
  disposable,
  schema_version,
  migration_sha256,
  attestation_revision
) values (
  'preview',
  '<exact-preview-target-id>',
  true,
  9,
  '<BACKUP_SCHEMA_MIGRATION_SHA256 from src/domain/backup/schema-contract.ts>',
  '<stable-opaque-attestation-revision>'
);
```

The table must contain exactly one row. Set `PREVIEW_RESTORE_TARGET_ID` to the same target ID; the command treats the
process value only as an expectation and trusts the database row as the source of target identity, disposable policy,
schema, migration digest, and revision. A production URL, unattested database, wrong branch ID, or stale schema fails
before staging.

Run a restore with an object key obtained from the private bucket inventory:

In the operator shell, provide `CLOUDFLARE_ACCOUNT_ID` and a
`CLOUDFLARE_API_TOKEN` that can read objects from the private preview bucket.
Do not print, paste into arguments, or commit either value.

```powershell
pnpm.cmd restore:backup -- --object "backups/v1/YYYY/MM/DD/<opaque-digest>.vision-backup" --target preview --confirm-disposable-target "RESTORE PREVIEW DISPOSABLE TARGET"
```

For a nonempty disposable preview target, replacement requires both extra arguments:

```powershell
pnpm.cmd restore:backup -- --object "backups/v1/YYYY/MM/DD/<opaque-digest>.vision-backup" --target preview --confirm-disposable-target "RESTORE PREVIEW DISPOSABLE TARGET" --replace-disposable-target --assert-target-id "<exact-preview-target-id>"
```

The command reads only `vision-preview-backups`. Before opening the database, it performs independent authenticated
object reads and requires stable identity, exact safe custom metadata, the native R2 SHA-256, the calculated body
SHA-256, canonical encrypted serialization, successful AES-GCM authentication, a matching manifest/date/schema, the
plaintext archive digest, valid references, and all 29 row counts. It then opens one serializable PostgreSQL
transaction, verifies the database-owned attestation, locks all authoritative tables, stages all 29 tables, verifies
references and counts, rereads the attestation, and promotes atomically. Any failure rolls the transaction back.

Successful output contains only:

- the plaintext archive SHA-256;
- row counts for all 29 tables;
- whether existing preview rows were replaced.

It does not print object keys, URLs, credentials, target IDs, ciphertext, or row content. `Backup restore failed.` is
the only process-level failure message.

## Recovery acceptance

After restoring, compare the command's 29 row counts and plaintext checksum with the expected backup evidence. Run
the normal preview application checks against the disposable branch, then delete that branch using the Neon operator
workflow. Do not point the restore command at a long-lived or production database.

No live bucket creation, secret update, deployment, backup, restore, or branch deletion is performed by repository
tests.

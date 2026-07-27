# Credential and key change log

This ledger records credential changes without recording values, identifiers,
URLs, fingerprints, or provider-controlled content. Every future key, token,
password, OAuth-secret, or encryption-key change must be added here with its
authorization and safe verification result.

| Timestamp UTC | Environment | Credential or configuration | Change | Authorization | Safe verification |
|---|---|---|---|---|---|
| 2026-07-26 | Preview | `BACKUP_ENCRYPTION_KEY` | Initial backup-only key stored as a Cloudflare Worker secret; key version 1 | Phase B recovery approval | A migration-9 encrypted backup was created and its value was never printed |
| 2026-07-27 | Preview | `BACKUP_ENCRYPTION_KEY` | **No change. User explicitly prohibited rotation** | Direct user instruction | Worker secret and key version remain unchanged |
| 2026-07-27 | Preview | `CLOUDFLARE_API_TOKEN_PREVIEW` | Token value was not rotated; account-level AI Gateway Read and Edit permissions were added | Phase B Gateway approval | Gateway list/read succeeds and the exact saved budget passes read-only verification |
| 2026-07-27 | Preview | `CLOUDFLARE_ACCOUNT_ID_PREVIEW` | Protected GitHub environment configuration was corrected to the approved preview account; this is an identifier, not a key | Phase B Gateway approval | Gateway lookup resolves exactly one approved preview Gateway |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_DATABASE_URL` | Created as a temporary Worker secret for the one approved restore drill | Direct user approval for Phase B restore Task 4 | The secret name is present in preview and the value remained masked |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_TARGET_ID` | Created as a temporary Worker secret for the one approved restore drill | Direct user approval for Phase B restore Task 4 | The secret name is present in preview and the database-owned attestation was matched without returning the value |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_DATABASE_URL` | Deleted after the restore capture returned `no_scheduled_event` and normal code was redeployed | Direct user approval for Phase B restore Task 4 cleanup | The temporary secret name is absent; the disposable branch remains retained |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_TARGET_ID` | Deleted after the restore capture returned `no_scheduled_event` and normal code was redeployed | Direct user approval for Phase B restore Task 4 cleanup | The temporary secret name is absent; the disposable branch remains retained |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_DATABASE_URL` | Re-created as a temporary Worker secret for the approved restore retry after the safe-tail propagation window was corrected | Direct user approval for Phase B restore Task 4 | The secret name is present in preview, its type is Secret, and the value was never printed |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_TARGET_ID` | Re-created as a temporary Worker secret for the approved restore retry after the disposable target was re-attested | Direct user approval for Phase B restore Task 4 | The secret name is present in preview, its type is Secret, and the database-owned attestation was matched without returning the value |

## Required entry for every future change

Record:

- the UTC date;
- environment;
- secret name only;
- whether it was created, rotated, revoked, or permission-scoped;
- the user authorization;
- a value-free verification result;
- the related setback or incident when the change followed exposure or failure.

Never record the old value, new value, a partial value, hash, fingerprint,
email, account identifier, database URL, branch identifier, or object key.

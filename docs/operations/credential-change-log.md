# Credential and key change log

This ledger records credential changes without recording values, identifiers,
URLs, fingerprints, or provider-controlled content. Every future key, token,
password, OAuth-secret, or encryption-key change must be added here with its
authorization and safe verification result.

| Timestamp UTC | Environment | Credential or configuration | Change | Authorization | Safe verification |
|---|---|---|---|---|---|
| 2026-07-26 | Preview | `BACKUP_ENCRYPTION_KEY` | Initial backup-only key stored as a Cloudflare Worker secret; key version 1 | Phase B recovery approval | A migration-9 encrypted backup was created and its value was never printed |
| 2026-07-27 | Preview | `BACKUP_ENCRYPTION_KEY` | **No change. User explicitly prohibited rotation** | Direct user instruction | Worker secret and key version remain unchanged |
| 2026-07-27 | Preview | `CLOUDFLARE_API_TOKEN_PREVIEW` | Token value was not rotated; account-level AI Gateway Read and Edit permissions were added | Phase B Gateway approval | Historical Gateway list/read and exact-rule verification passed; current permission and rule freshness require re-verification after contradictory UI signals |
| 2026-07-27 | Preview | `CLOUDFLARE_ACCOUNT_ID_PREVIEW` | Protected GitHub environment configuration was corrected to the approved preview account; this is an identifier, not a key | Phase B Gateway approval | Historical lookup resolved one approved Gateway; current identity requires re-verification after exact-name creation was rejected as a duplicate |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_DATABASE_URL` | Created as a temporary Worker secret for the one approved restore drill | Direct user approval for Phase B restore Task 4 | The secret name is present in preview and the value remained masked |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_TARGET_ID` | Created as a temporary Worker secret for the one approved restore drill | Direct user approval for Phase B restore Task 4 | The secret name is present in preview and the database-owned attestation was matched without returning the value |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_DATABASE_URL` | Deleted after the restore capture returned `no_scheduled_event` and normal code was redeployed | Direct user approval for Phase B restore Task 4 cleanup | The temporary secret name is absent; the disposable branch remains retained |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_TARGET_ID` | Deleted after the restore capture returned `no_scheduled_event` and normal code was redeployed | Direct user approval for Phase B restore Task 4 cleanup | The temporary secret name is absent; the disposable branch remains retained |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_DATABASE_URL` | Re-created as a temporary Worker secret for the approved restore retry after the safe-tail propagation window was corrected | Direct user approval for Phase B restore Task 4 | The secret name is present in preview, its type is Secret, and the value was never printed |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_TARGET_ID` | Re-created as a temporary Worker secret for the approved restore retry after the disposable target was re-attested | Direct user approval for Phase B restore Task 4 | The secret name is present in preview, its type is Secret, and the database-owned attestation was matched without returning the value |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_DATABASE_URL` | Permanently deleted after the allowlisted retry result failed closed with `restore_target_not_empty` and the exact normal Worker was redeployed | Direct user approval for Phase B restore Task 4 cleanup | The temporary secret name is absent; the disposable branch remains retained |
| 2026-07-27 | Preview | `PREVIEW_RESTORE_TARGET_ID` | Permanently deleted after the allowlisted retry result failed closed with `restore_target_not_empty` and the exact normal Worker was redeployed | Direct user approval for Phase B restore Task 4 cleanup | The temporary secret name is absent; the disposable branch remains retained |
| 2026-08-02 | Preview | `GOOGLE_ALLOWED_SUB` | Replaced the private owner-allowlist subject from the prior successful-login source; no value was retained | Direct user action after the owner-allowlist denial diagnosis | A fresh sign-in remained at the owner-allowlist denial; the email match is the next isolated check |
| 2026-08-02 | Preview | `GOOGLE_ALLOWED_EMAIL` | Replaced the private owner-allowlist email for the same approved account; no value was retained | Direct user action after the subject-only retry remained denied | Fresh reconnect returned to the authenticated Vision foundation and a token is present; the remaining disconnected state is an application checkpoint defect, not an allowlist mismatch |
| 2026-08-03 | Preview | `OPENAI_API_KEY` | Owner reported creating or replacing the preview-only value as a Cloudflare Worker Secret; no value was observed or retained | Direct user action under the approved preview AI acceptance path | Fresh controller baseline verified the exact binding name and encrypted-secret type on the active version without reading its value |
| 2026-08-03 | Preview | `OPENAI_GATEWAY_BASE_URL` | Owner reported saving the provider-native preview Gateway base URL as a Cloudflare Worker Secret; no value or provider identifier was observed or retained | Direct user action under the approved preview AI acceptance path | Fresh controller baseline verified the exact binding name and encrypted-secret type on the active version without reading its value |

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

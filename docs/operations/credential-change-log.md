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


# Session repository

The high-level repository uses `protected-fields.ts` with `unresolved` privacy-domain keys. OAuth rows bind Additional Authenticated Data (AAD) to the state hash; session rows bind it to the session hash and owner. The Drizzle store uses parameterized statements. Callback consumption is a delete-with-returning operation, so success is the replay linearization point and physically frees the outstanding admission slot.

## Signatures

```ts
cleanupOAuthState(cleanedAt: Date, staleWindowAt: Date, limit: number): Promise<OAuthCleanupResult>;
admitOAuthStart(admissionKeyHash: string, admittedAt: Date, windowMs: number, maximum: number): Promise<boolean>;
insertOAuthTransaction(row: Omit<OAuthTransactionRow, "admissionSlot">): Promise<boolean>;
consumeOAuthTransaction(stateHash: string, consumedAt: Date): Promise<OAuthTransactionRow | undefined>;
createOAuthTransaction(transaction: NewOAuthTransaction): Promise<boolean>;
```

## Dependencies

Uses Drizzle parameterized SQL, Web Crypto SHA-256, `protected-fields.ts`, the key-provider port, and the PostgreSQL tables/indexes from `0002_google_auth_sessions.sql`.

## Inputs and outputs

Admission accepts one already-HMACed opaque key, server times, fixed limits, and encrypted transaction inputs. It returns booleans/counts or decrypted values only to trusted server callers. Session APIs accept opaque bearers and owner-bound plaintext only before encryption.

## Side effects

Auth start performs bounded physical cleanup, an atomic fixed-window upsert, encryption, then up to three unique-slot insert attempts. Callback atomically deletes one unexpired row. Session methods insert, select, decrypt, or revoke owner-bound rows.

## Failure behavior

Malformed rows, binary bounds, crypto failures, SQL failures, invalid dates, and missing conflict winners become constant `AUTH_PERSISTENCE_FAILED` errors. A full window or outstanding-slot set returns `false`; no secret is placed in the error.

## Privacy and authorization

State and session bearers are SHA-256 lookup hashes. Admission keys are already keyed digests. Verifier, nonce, email, and CSRF values are ciphertext. Session decrypt uses the persisted owner and exact hash-bound AAD; callers cannot substitute an owner.

## Covering tests

`tests/integration/data/auth-admission.test.ts` covers executable admission SQL, concurrency, bounds, cleanup, indexes, and raw privacy. `tests/contract/data/auth-row-bounds.contract.test.ts` covers binary boundaries. `tests/worker/auth.test.ts` covers route/session behavior.

## `cleanupOAuthState`

Deletes at most 100 expiry-ordered transaction rows and stale admission windows per call, returning only aggregate counts.

## `admitOAuthStart`

Uses one `INSERT ... ON CONFLICT ... WHERE` statement to reset at the exact ten-minute boundary or increment below five.

## `insertOAuthTransaction`

Claims the first available unique `(admission_key_hash, admission_slot)` among slots 1-3 and inserts only hashed/ciphertext protocol data.

## `consumeOAuthTransaction`

Performs one `DELETE ... WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > ? RETURNING ...` statement.

## `insertSession`

Inserts a SHA-256 session hash, owner/subject metadata, encrypted email/CSRF fields, and bounded lifetime.

## `findSession`

Selects by session hash with `revoked_at IS NULL` and future expiry.

## `revokeSession`

Sets `revoked_at` only on a still-active matching hash and returns whether a row changed.

## `createOAuthTransaction`

Hashes the admission key, performs bounded cleanup and atomic admission before encryption, then hashes state, encrypts verifier/nonce, and claims an outstanding slot.

## `createSession`

Hashes the bearer and encrypts email and CSRF under owner/session AAD before insert.

## `hashOpaqueSecret`

Requires a 32-256 character opaque value, calculates SHA-256 with Web Crypto, and returns unpadded base64url.

## `encodeBase64Url`

Produces the canonical unpadded digest representation.

## `encodeEnvelope`

Requires a non-null validated cipher envelope and UTF-8 serializes it for bytea.

## `decodeEnvelope`

Fatal-decodes UTF-8 and revalidates the serialized cipher envelope.

## `decodeOAuthTransactionRow`

Decodes exact aliases, canonical bytea, and timestamps into the store contract.

## `decodeServerSessionRow`

Decodes exact session columns without coercing owner, subject, or encrypted fields.

## `readDatabaseText`

Rejects non-string, empty, and oversized cells with a constant persistence error.

## `readDatabaseBytes`

Accepts only exact `Uint8Array` instances or lowercase canonical `\x` bytea hex, applies the shared nonzero serialized-envelope byte maximum to both forms, and copies with typed-array intrinsics.

## `readPositiveInteger`

Decodes positive slot/version metadata without coercing noncanonical values.

## `readNonnegativeInteger`

Decodes bounded cleanup aggregates from number, bigint, or canonical decimal text.

## `readDatabaseDate`

Copies valid Date instances or parses strings that explicitly carry `Z` or an offset.

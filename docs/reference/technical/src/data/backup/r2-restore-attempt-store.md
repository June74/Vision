# `src/data/backup/r2-restore-attempt-store.ts`

Implements the temporary `RestoreAttemptStore` under `restore-attempts/v1/`, which is disjoint from
`backups/v1/`. It persists no evidence, metadata, target value, or result.

## `createR2RestoreAttemptStore`

Closes over one R2 binding and exposes only `claimOnce`; listing, reading, returning, and deleting marker identities
are intentionally absent.

## `claimOnce`

Validates the private target identifier, hashes a domain-separated target value with SHA-256, and conditionally puts
an empty body with `etagDoesNotMatch: "*"`. It returns only the ownership boolean and replaces every validation,
hashing, or provider error with the fixed `Restore attempt claim failed.` message.

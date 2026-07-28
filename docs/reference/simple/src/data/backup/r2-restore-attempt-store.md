# `src/data/backup/r2-restore-attempt-store.ts`

Creates one opaque, claim-only marker for the temporary preview restore. The marker is separate from backup objects
and is never returned or logged.

## `createR2RestoreAttemptStore`

Builds the narrow one-shot claim interface around the private R2 bucket.

## `claimOnce`

Hashes the exact target identity into an opaque key and uses atomic create-if-absent. Exactly one concurrent caller
receives `true`; later callers receive `false`. Provider failures become one fixed value-free error.

# `src/jobs/purge-expired-backups.ts`

Implements the fixed 30-day recovery retention rule using strict object admission and UTC-date arithmetic. Malformed
or foreign objects are counted but never deleted.

## `purgeExpiredBackups`

Traverses every page under `backups/v1/`, rejects looping cursors, deletes admitted objects whose age is at least 30
whole UTC dates, and reports a safe count-only result. Delete failures are retriable and make the pass fail.

## `validatedObjectDate`

Requires the exact versioned key grammar, path/metadata date agreement, the four-field metadata record, canonical
digests, and a positive safe key version before an object becomes eligible.

## `utcDateMilliseconds`

Normalizes a finite scheduler instant to UTC midnight.

## `parseUtcDate`

Round-trips four-digit year, month, and day through UTC components so JavaScript date normalization cannot admit an
invalid path date.

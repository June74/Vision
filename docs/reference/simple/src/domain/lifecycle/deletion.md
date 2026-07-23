# `src/domain/lifecycle/deletion.ts`

This file sets Vision's fixed 30-day encrypted recovery period. It treats the exact deadline as permanent-purge time.

## `markDeleted`

Makes a deletion record only when its deadline is exactly 30 days after deletion.

## `calculatePurgeAfter`

Adds thirty 24-hour days to a confirmed deletion time.

## `canRestore`

Says whether the record can still be restored. It is false exactly at the deadline.

## `isPurgeDue`

Says whether the record must now be permanently removed.

## `assertValidInstant`

Rejects invalid dates before lifecycle calculations use them.

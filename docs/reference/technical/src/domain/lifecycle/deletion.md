# `src/domain/lifecycle/deletion.ts`

Pure domain timing contract for a `RecoverableDeletion`. `RECOVERY_WINDOW_MS` is exactly `30 * 24 * 60 * 60 * 1000`; no local timezone or calendar-month arithmetic is used.

## `markDeleted`

**Signature:** `(nodeId, deletedAt, purgeAfter?) => RecoverableDeletion`.

Validates a nonempty opaque ID and valid `Date` instances. A supplied deadline must equal the fixed UTC duration exactly; it returns defensive `Date` copies and throws a constant validation error otherwise.

## `calculatePurgeAfter`

**Signature:** `(deletedAt: Date) => Date`.

Produces the authoritative purge instant by millisecond addition. It has no persistence side effects.

## `canRestore`

**Signature:** `(deletion, now) => boolean`.

Returns `now < purgeAfter`. The strict comparison prevents restoration at the same instant a job is authorized to purge.

## `isPurgeDue`

**Signature:** `(deletion, now) => boolean`.

Returns `now >= purgeAfter`, the complementary permanent-purge boundary.

## `assertValidInstant`

Internal validator that rejects invalid `Date` values without echoing input data. Covered by `tests/unit/domain/deletion.test.ts` through public lifecycle APIs.

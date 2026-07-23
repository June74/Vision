# `src/domain/lifecycle/deletion.ts`

## Dependencies, inputs, and role

This pure module has no database, provider, authorization, or crypto dependency. It accepts valid JavaScript `Date` values and opaque IDs, returns defensive `Date` copies, and defines the fixed `30 * 24 * 60 * 60 * 1000` millisecond window. It validates request data; PostgreSQL repository predicates remain the authoritative live boundary for concurrent row eligibility.

## Outputs, failures, and privacy

Invalid IDs, invalid dates, or a caller-supplied deadline that is not exact throw `DeletionLifecycleValidationError` with constant messages. The module never persists, decrypts, logs, or authorizes content. Its behavior is covered by `tests/unit/domain/deletion.test.ts`; repository boundary behavior is covered separately by `tests/integration/jobs/purge-expired-deletions.test.ts`.

## `markDeleted`

**Signature:** `(nodeId, deletedAt, purgeAfter?) => RecoverableDeletion`.

Returns a validated deletion episode only if the deadline exactly equals the fixed UTC duration.

## `calculatePurgeAfter`

**Signature:** `(deletedAt) => Date`.

Uses epoch arithmetic rather than local time or a calendar-month interpretation.

## `canRestore`

**Signature:** `(deletion, now) => boolean`.

Returns `now < purgeAfter`; exact deadline returns false.

## `isPurgeDue`

**Signature:** `(deletion, now) => boolean`.

Returns `now >= purgeAfter`; unit coverage pins both sides of the boundary.

## `assertValidInstant`

Internal `Date` validator used by all exported timing rules.

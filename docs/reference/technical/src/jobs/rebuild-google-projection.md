# `src/jobs/rebuild-google-projection.ts`

`rebuildGoogleProjection(ownerId, calendarId, dependencies)` is invoked only after an authenticated incremental
request receives Google's invalid-sync-token classification. It creates an isolated generation bound to the invalid
checkpoint version and optional Queue claim, then calls `events.list` without `syncToken`.

Pagination requires one continuation value per page, a stable collection timezone, and a terminal `nextSyncToken`.
Exact duplicate identities collapse; contradictory duplicates fail closed. The job retains Task 2's 10,000-page,
25,000-change, 32 MiB staged-memory, 64 KiB protected-field, and UTF-8 byte limits.

After durable staging is ready, the job reloads and authenticates every ciphertext row. It calls `applyChanges` once
with `replaceProjection`, the generation ID, base checkpoint version, and Queue claim. PostgreSQL then reconciles
deterministic provider identity, tombstones identities absent from the full listing, revives recoverable equal-version
events, preserves Vision-owned rows, advances the encrypted cursor, records the run, marks the generation activated,
and clears activated stage rows in one statement.

A caught pre-activation failure marks the generation abandoned. A process crash can leave `staging` or `ready` rows,
but the old projection and checkpoint remain authoritative and the rows are independently cleanable.

## `rebuildGoogleProjection`

Returns the existing content-free `SyncResult` shape with reason `rebuild`. Durable Queue authorization remains bound
to the original queue-job reason and claim ID rather than the rebuild result label. A checkpoint or claim conflict
becomes a bounded concurrency retry; provider and schema errors retain the normal `syncCalendar` classification.

## `validateRequest`

Requires a positive committed checkpoint for the same calendar and bounded opaque authority fields.

## `validateProtectedPayloadSizes`

Checks title, description, serialized attendee list, location, first meeting link, and the complete protected payload
against the shared encryption limit before staging.

## `utf8ByteLength`

Uses `TextEncoder` at both envelope and aggregate Worker-memory boundaries.

## `canonicalJson`

Sorts object keys recursively while retaining array order, solely for same-run duplicate equality.

## `boundedText`

Provides the strict non-empty bounded string predicate for job metadata.

# `src/jobs/sync-calendar.ts`

`syncCalendar` owns provider pagination and staging, while `SyncRepository` owns durable atomicity. This separation
ensures the repository is never called until a terminal `nextSyncToken` exists.

The job passes the original committed token on every page, requires a stable collection timezone, caps page and change
counts, and deduplicates by source system/calendar/event identity. Distinct values for the same identity are rejected:
an unversioned tombstone cannot be ordered against an upsert, and an ETag is never used to guess an order.

## `syncCalendar`

**Signature:** `(request, dependencies) => Promise<SyncResult>`

Loads the committed checkpoint, retrieves all pages, stages changes, constructs version `old + 1`, and calls
`applyChanges` once. A checkpoint CAS conflict or database failure signals queue redelivery. Authorization becomes
`disconnected`, malformed data becomes `action_required`, and 410 becomes `rebuild_required` for Task 5.
The optional `persistFailure` dependency defaults to `true` for direct jobs. The Queue adapter sets it to `false`
because `CalendarJobRepository.finishClaimedFailure` owns the atomic, lease-bound checkpoint and job transition.
Queue execution also supplies an internal lease outside `SyncCalendarRequest`; the repository requires that lease for
checkpoint loading and the final projection/checkpoint/run transaction. Direct non-queue callers remain unchanged.

## `stageChange`

Builds a collision-free JSON tuple key from stable provider identity. Exact duplicates collapse; distinct duplicates
raise a schema failure before persistence.

## `validateProtectedPayloadSizes`

Measures each serialized encryption input—title, description, attendees, location, meeting link, and complete protected
payload—against the shared 64 KiB plaintext envelope limit before any repository call.

## `utf8ByteLength`

Uses `TextEncoder` so multibyte content is bounded by actual UTF-8 allocation rather than UTF-16 code units.

## `canonicalJson`

Recursively sorts object keys while preserving array order to compare closed provider-change values deterministically.

## `normalizeFailure`

Maps `EventSyncClientError` to job state and stops redelivery after the bounded maximum attempt.

## `retryError`

Computes exponential delay plus bounded jitter, capped at ten minutes. The returned error instructs the queue consumer;
there is no request-local retry loop.

## `validateJobRequest`

Validates opaque queue metadata and defaults the first delivery attempt to one.

## `validateQueueLease`

Validates the bounded opaque claim ID supplied only by the trusted queue adapter.

## `boundedText`

Performs the shared strict non-empty string bound check.

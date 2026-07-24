# `src/jobs/sync-calendar.ts`

This job downloads every Google change page into memory, removes exact duplicates, and then asks the repository to
commit the complete event projection and terminal cursor together. A failed page never reaches persistence.

## `syncCalendar`

Runs one synchronization attempt and returns only safe counts, duration, reason, and checkpoint version.

## `stageChange`

Keeps one exact change per provider identity and rejects conflicting duplicates.

## `canonicalJson`

Creates a stable comparison string for already-validated mapper output.

## `normalizeFailure`

Turns provider and unexpected errors into safe connection and queue states.

## `retryError`

Returns bounded exponential queue-redelivery metadata; it does not sleep or retry inside the Worker request.

## `validateJobRequest`

Checks the opaque owner, calendar, reason, job, and delivery-attempt fields.

## `boundedText`

Recognizes a non-empty string within a specified size limit.

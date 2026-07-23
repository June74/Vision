# `src/jobs/purge-expired-deletions.ts`

## Dependencies, authority, and behavior

The job depends only on `DeletionPurgeRepository`, which is constructed separately from a registered system scheduler capability. It cannot receive an owner repository or direct database handle. The job accepts a valid UTC `Date`, returns the repository's `purgedNodeIds`, and has no direct SQL, content, or provider side effect; the repository SQL is the live deadline/lock enforcement boundary.

## Failures, privacy, and tests

Invalid-time and database/audit/lock failures propagate to the scheduler for retry policy; the job does not convert a rejected purge into success. It never receives plaintext or encrypted fields. `tests/integration/jobs/purge-expired-deletions.test.ts` covers injected job operation, idempotence, raw purging, and queued concurrency simulations. Real multi-session Neon execution remains an external milestone gate.

## `createPurgeExpiredDeletionsJob`

**Signature:** `(repository: DeletionPurgeRepository) => PurgeExpiredDeletionsJob`.

Wires the narrow system-only port into a retryable scheduled entry point.

## `purgeExpiredDeletions`

**Signature:** `(now: Date) => Promise<PurgeExpiredDeletionsResult>`.

Forwards the scheduler's authoritative time and returns only the repository result.

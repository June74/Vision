# `src/jobs/purge-expired-deletions.ts`

The job is an intentionally thin scheduler boundary. It owns neither direct SQL nor protected content; the repository provides the single-statement transactional purge.

## `createPurgeExpiredDeletionsJob`

**Signature:** `(repository: DeletionRepository) => PurgeExpiredDeletionsJob`.

Injects the authoritative deletion repository, making the job straightforward to retry and test without a live Neon connection.

## `purgeExpiredDeletions`

**Signature:** `(now: Date) => Promise<PurgeExpiredDeletionsResult>`.

Forwards the scheduler's authoritative UTC time. Idempotency and the `now >= purgeAfter` rule are enforced by the repository and pure domain module.

# `src/jobs/purge-expired-deletions.ts`

This file creates the scheduled task that asks the deletion repository to permanently purge expired local records.

## `createPurgeExpiredDeletionsJob`

Builds a job using a deletion repository.

## `purgeExpiredDeletions`

Runs one safe, repeatable purge pass for a supplied time.

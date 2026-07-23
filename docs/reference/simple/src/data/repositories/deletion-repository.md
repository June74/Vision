# `src/data/repositories/deletion-repository.ts`

This repository safely moves a local Vision record into recovery, restores it before the deadline, or permanently removes it after the deadline.

## `markDeleted`

Marks an active record deleted and saves the recovery deadline without changing encrypted content.

## `restoreDeleted`

Restores a deleted record only before expiry and leaves its ciphertext unchanged.

## `purgeExpiredDeletions`

Permanently removes due records, their encrypted event rows, edges, and recovery markers in one database operation.

## `createDeletionRepository`

Builds the server-side deletion repository.

## `createRestoreRequest`

Checks the ID and current time used for a restore attempt.

## `createPurgeRequest`

Checks the current time used for a purge pass.

## `decodePurgedNodeId`

Checks an opaque node ID returned by PostgreSQL.

# `src/server/authorization/deletion-capability-internal.ts`

This private helper records deletion permissions that were created by trusted server composition or tests.

## `registerVerifiedDeletionRepositoryAccess`

Records an owner permission object.

## `registerVerifiedDeletionPurgeAccess`

Records a system-only purge permission object.

## `hasVerifiedDeletionRepositoryAccess`

Checks whether an owner permission was issued by this boundary.

## `hasVerifiedDeletionPurgeAccess`

Checks whether a system purge permission was issued by this boundary.

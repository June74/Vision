# `src/server/authorization/deletion-capability-internal.ts`

Private `WeakSet` registrations make deletion capabilities object-identity based, so copying visible properties cannot forge authority. This module depends on no database or user content and is used by the capability verifier plus Vitest-only issuer. Covering tests are `tests/unit/server/authorization/deletion-repository-authorization.test.ts`.

## `registerVerifiedDeletionRepositoryAccess`

Registers one server-issued owner object; side effect is limited to the private owner `WeakSet`.

## `registerVerifiedDeletionPurgeAccess`

Registers one trusted scheduler object; side effect is limited to the private purge `WeakSet`.

## `hasVerifiedDeletionRepositoryAccess`

Returns an owner registration boolean and does not inspect caller data.

## `hasVerifiedDeletionPurgeAccess`

Returns a system registration boolean and does not inspect caller data.

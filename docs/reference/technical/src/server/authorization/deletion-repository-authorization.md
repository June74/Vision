# `src/server/authorization/deletion-repository-authorization.ts`

Defines unique-symbol TypeScript brands plus private registration checks for two different authorities: an owner-bound request capability and a global scheduler capability. It depends on the internal `WeakSet` registry; it has no content, database, or provider side effect. Invalid or copied objects return false. Covering tests: `tests/unit/server/authorization/deletion-repository-authorization.test.ts` and the owner-isolation integration case.

## `isVerifiedDeletionRepositoryAccess`

**Input/output:** `unknown => value is VerifiedDeletionRepositoryAccess`.

Requires a registered object and a nonempty authenticated owner ID. This predicate is the factory's authorization gate.

## `isVerifiedDeletionPurgeAccess`

**Input/output:** `unknown => value is VerifiedDeletionPurgeAccess`.

Requires a separately registered scheduler object, preventing a user capability from authorizing global purge.

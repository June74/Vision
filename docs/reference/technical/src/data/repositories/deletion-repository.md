# `src/data/repositories/deletion-repository.ts`

## Dependencies and authority

This adapter depends on the pure deletion timing contract, the typed server-only Drizzle database, and registered deletion capabilities. `DeletionRepository` is bound to one verified authenticated owner; `DeletionPurgeRepository` can only be constructed from a separate trusted-scheduler capability. Production code must not import the Vitest issuer. The database is the live authorization and timing enforcement point: CTE predicates apply owner scope, lifecycle, and deadline checks; the pure module validates request dates and documents the same fixed rule.

## Inputs, outputs, and side effects

User operations accept an opaque node ID and UTC `Date`; system purge accepts only a UTC `Date`. Marking changes one active owner-scoped node to `deleted` and writes a recovery record. Restoring locks the recovery/node pair, makes it active only before the deadline, and removes the recovery record without selecting or changing ciphertext. Purge locks due pairs in node-ID order, validates them again, requires an inserted or verified-identical audit fact, detaches historic audit links, then removes edges, event rows/envelopes, recovery data, and nodes in one statement.

## Failure and privacy behavior

Forged or absent capabilities throw `DeletionOwnerAccessDeniedError`; unavailable owner transitions throw `DeletionStateConflictError` without revealing whether another owner has the node. Invalid dates fail in the pure contract. SQL, constraints, lock timeouts, and audit-episode conflicts reject the operation and roll back the entire statement. No method decrypts or serializes protected event fields. The retained purge audit fact contains only closed literals, the owner identifier already permitted by the audit contract, and an episode-derived opaque ID; it has no node reference.

## Concurrency policy and tests

The first statement to lock an authoritative recovery/node pair wins. A waiter rechecks lifecycle plus deadline after its lock and returns no transition without changing version/timestamp or protected content. PGlite coverage serializes one client, so `tests/integration/jobs/purge-expired-deletions.test.ts` provides deterministic queued restore/restore, purge/purge, and purge/restore simulations plus SQL lock rendering. Isolated Neon milestone coverage must exercise real multi-session locks, retries, and permissions. The same file covers raw protected-row removal, cross-owner denial, exact boundaries, audit conflict rollback, and a recreated deletion episode; `tests/unit/server/authorization/deletion-repository-authorization.test.ts` covers non-forgeable factories.

## `markDeleted`

**Signature:** `(nodeId, deletedAt, purgeAfter?) => Promise<RecoverableDeletion>`.

Uses a bound `owner_id` predicate and creates the exact 30-day recovery record atomically. It has no protected-content side effect.

## `restoreDeleted`

**Signature:** `(nodeId, now) => Promise<boolean>`.

Locks recovery then node, revalidates `deleted` plus `now < purge_after`, and includes those checks again in mutations. `false` means no eligible owner-bound transition occurred.

## `purgeExpiredDeletions`

**Signature:** `(now) => Promise<{ purgedNodeIds: string[] }>`.

System-only statement that locks and revalidates rows satisfying `purge_after <= now`. An audit collision that is not the same closed episode fact raises an SQL error and leaves every protected row intact.

## `createDeletionRepository`

**Signature:** `(database, verifiedOwnerAccess) => DeletionRepository`.

Rejects unregistered caller-shaped objects before a repository exists.

## `createDeletionPurgeRepository`

**Signature:** `(database, verifiedSystemAccess) => DeletionPurgeRepository`.

Creates the separate global operation only for registered scheduler authority.

## `createRestoreRequest`

Internal non-content input validator; failure propagates the pure lifecycle validation error.

## `createPurgeRequest`

Internal UTC-time validator for the trusted system boundary; it does not itself decide row eligibility.

## `decodePurgedNodeId`

Internal strict decoder that rejects malformed PostgreSQL results without echoing values.

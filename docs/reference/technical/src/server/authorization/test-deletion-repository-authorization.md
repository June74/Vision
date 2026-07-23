# `src/server/authorization/test-deletion-repository-authorization.ts`

Vitest-only issuer for the same private registries used by production verification. It depends on `process.env.VITEST`; calls outside Vitest throw a constant boundary error. It handles only opaque owner identifiers and no content. Production-boundary scanning in `tests/integration/jobs/purge-expired-deletions.test.ts` ensures the deletion repository does not import it; capability behavior is covered by `tests/unit/server/authorization/deletion-repository-authorization.test.ts`.

## `createTestDeletionRepositoryAccess`

**Input/output:** `(authenticatedOwnerId: string) => VerifiedDeletionRepositoryAccess`.

Rejects missing or invalid test context, freezes the object, registers it, and returns the branded test capability.

## `createTestDeletionPurgeAccess`

**Input/output:** `() => VerifiedDeletionPurgeAccess`.

Rejects non-Vitest callers, freezes and registers the separate system-only test capability.

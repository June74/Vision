# `src/server/authorization/test-event-content-authorization.ts`

Guarded test issuer for `VerifiedEventRepositoryAccess`. It checks `process.env.VITEST`, carries a unique sentinel, and
is forbidden from production imports and bundles.

## `createTestEventRepositoryAccess`

**Signature:** `(authenticatedOwnerId, canReadPrivacy?) => VerifiedEventRepositoryAccess`

Creates a frozen fixed-owner capability for tests only.

## `authorize`

**Signature:** `(request) => EventContentAuthorizationDecision | undefined`

Requires exact authenticated/event owner equality and the configured test privacy predicate before issuing a frozen
branded decision.

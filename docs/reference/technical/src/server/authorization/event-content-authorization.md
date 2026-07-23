# `src/server/authorization/event-content-authorization.ts`

`VerifiedEventRepositoryAccess` is registered by exact object identity and fixes one authenticated owner. No
production issuer exists until the authentication/privacy-policy composition milestone. Repository construction is
therefore fail-closed. A guarded Vitest-only issuer supports tests and is excluded by source and bundle scans.

## `isVerifiedEventRepositoryAccess`

**Signature:** `(value: unknown) => value is VerifiedEventRepositoryAccess`

Requires private-registry membership, a non-empty authenticated owner, and the authorization operation.

## `matchesEventContentAuthorizationDecision`

**Signature:** `(decision, request) => decision is EventContentAuthorizationDecision`

Requires private-registry membership plus exact authenticated owner, event owner, and privacy facts immediately
before protected selection.

# `src/server/authorization/event-content-authorization.ts`

`VerifiedEventRepositoryAccess` is registered by exact object identity and fixes one authenticated owner. The
production AI issuer lives inside this verifier boundary and denies restricted records. A guarded Vitest-only issuer
supports broader repository tests and is excluded by source and bundle scans.

## `createAiEventRepositoryAccess`

Validates and fixes one authenticated owner, registers the exact access object, and returns the protected repository
capability used by the production AI route.

## `authorize`

Issues a registered content decision only when the request owner and stored event owner both match the fixed
authenticated owner and the event is not `restricted`.

## `isVerifiedEventRepositoryAccess`

**Signature:** `(value: unknown) => value is VerifiedEventRepositoryAccess`

Requires private-registry membership, a non-empty authenticated owner, and the authorization operation.

## `matchesEventContentAuthorizationDecision`

**Signature:** `(decision, request) => decision is EventContentAuthorizationDecision`

Requires private-registry membership plus exact authenticated owner, event owner, and privacy facts immediately
before protected selection.

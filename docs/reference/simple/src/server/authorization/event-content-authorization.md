# `src/server/authorization/event-content-authorization.ts`

This file verifies an opaque access capability from the server composition root. Raw owner strings, ordinary objects,
and arbitrary callbacks cannot construct a repository or authorize protected fields.

## `isVerifiedEventRepositoryAccess`

Checks exact private-registry membership and the fixed authenticated owner before repository construction.

## `matchesEventContentAuthorizationDecision`

Checks exact private-registry membership and the authenticated owner, event owner, and privacy snapshot.

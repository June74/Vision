# `src/server/authorization/event-content-authorization.ts`

This file issues and verifies narrow protected-event capabilities. Raw owner strings, ordinary objects, and arbitrary
callbacks cannot construct a repository or authorize protected fields.

## `createAiEventRepositoryAccess`

Creates access for exactly the signed-in owner and always denies restricted events.

## `authorize`

Checks the authenticated owner, stored event owner, and privacy level before permitting decryption.

## `isVerifiedEventRepositoryAccess`

Checks exact private-registry membership and the fixed authenticated owner before repository construction.

## `matchesEventContentAuthorizationDecision`

Checks exact private-registry membership and the authenticated owner, event owner, and privacy snapshot.

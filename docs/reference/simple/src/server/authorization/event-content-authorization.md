# `src/server/authorization/event-content-authorization.ts`

This file prevents a repository caller from choosing its own privacy permission. A server-owned policy checks the
authenticated owner and event privacy, then attaches a hidden mark that only this module can create and verify.

## `createEventContentAuthorizationPolicy`

Builds the owner check around the application's privacy rule.

## `authorize`

Returns a marked decision only when the authenticated owner owns the event and the privacy rule allows access.

## `matchesEventContentAuthorizationDecision`

Checks the hidden mark and every owner/privacy fact before decryption can continue.

## `isValidRequest`

Rejects empty owners and unknown privacy values.

# `src/server/authorization/event-content-authorization.ts`

`EventContentAuthorizationPolicy` is injected into an owner-scoped repository by the server composition factory.
`EventContentAuthorizationDecision` contains a module-private unique-symbol property, so structurally similar ordinary
objects fail runtime verification. The future authentication milestone supplies `authenticatedOwnerId`; this module
does not claim to authenticate users.

## `createEventContentAuthorizationPolicy`

**Signature:** `(canReadPrivacy: EventPrivacyPolicy) => EventContentAuthorizationPolicy`

Creates the only supported decision issuer. It hard-codes authenticated-owner equality before invoking the deterministic
privacy callback and freezes successful decisions with the private runtime brand.

## `authorize`

**Signature:** `(request: EventContentAuthorizationRequest) => EventContentAuthorizationDecision | undefined`

Validates request shape, requires subject/event owner equality, evaluates privacy, and returns either a branded frozen
decision or `undefined`.

## `matchesEventContentAuthorizationDecision`

**Signature:** `(decision, request) => decision is EventContentAuthorizationDecision`

Checks the inaccessible symbol plus exact authenticated owner, event owner, and privacy facts. Repository code invokes
this immediately before selecting protected columns.

## `isValidRequest`

**Signature:** `(request: EventContentAuthorizationRequest) => boolean`

Requires non-empty string owners and a value accepted by `PrivacyLevelSchema`.

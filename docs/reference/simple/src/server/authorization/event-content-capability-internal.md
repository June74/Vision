# `src/server/authorization/event-content-capability-internal.ts`

This internal module registers exact object identities in private weak sets. Copying properties, symbols, or prototypes
cannot copy the registration. The production boundary scan rejects imports outside the verifier and guarded test
issuer.

## `registerVerifiedEventRepositoryAccess`

Registers one exact access object identity.

## `hasVerifiedEventRepositoryAccess`

Checks whether the exact access object was registered.

## `registerEventContentAuthorizationDecision`

Registers one exact decision object identity.

## `hasEventContentAuthorizationDecision`

Checks whether the exact decision object was registered.

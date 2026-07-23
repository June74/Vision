# `src/server/authorization/event-content-capability-internal.ts`

Owns module-private `WeakSet` registries. Object identity, unlike a symbol property, is not copyable with
`Reflect.ownKeys`. Only the verifier and guarded test issuer may import this module; build validation enforces that
reachability rule.

## `registerVerifiedEventRepositoryAccess`

Adds an issuer-created access object to the private access registry.

## `hasVerifiedEventRepositoryAccess`

Performs an exact-identity access lookup.

## `registerEventContentAuthorizationDecision`

Adds an issuer-created decision object to the private decision registry.

## `hasEventContentAuthorizationDecision`

Performs an exact-identity decision lookup.

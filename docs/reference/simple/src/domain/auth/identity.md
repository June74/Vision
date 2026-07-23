# `src/domain/auth/identity.ts`

This file lets Vision accept exactly its one allowed, verified Google account. It always gives the same safe denial message instead of showing private identity details.

## `IdentityAuthorizationError`

Represents the safe `ACCOUNT_NOT_ALLOWED` denial.

## `authorizeIdentity`

Checks the server-verified account against the configured Google `sub`, email, issuer, audience, and expiry, then returns the safe session identity.

## `normalizeEmail`

Trims and lowercases an email before comparison.

## `isNonEmptyString`

Checks that text is present rather than blank.

## `hasTrustedAudience`

Checks that the token names Vision's configured audience.

## `isUnexpiredAt`

Checks that the token expiry is later than the server's current time.

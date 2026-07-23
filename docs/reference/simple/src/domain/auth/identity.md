# `src/domain/auth/identity.ts`

This file lets Vision accept exactly its one allowed, verified Google account. It always gives the same safe denial message instead of showing private identity details.

## `IdentityAuthorizationError`

Represents the safe `ACCOUNT_NOT_ALLOWED` denial.

## `authorizeIdentity`

Checks the server-verified account against the configured Google `sub`, email, one exact audience, issuer, and expiry, then returns the safe session identity.

## `normalizeEmail`

Trims and lowercases an email before comparison.

## `isNonEmptyString`

Checks that text is present rather than blank.

## `isUnexpiredAt`

Checks that the token expiry is later than the server's current time.

## `snapshotRecord`

Copies only expected ordinary claim or allowlist fields before checking them.

## `readDateMillis`

Reads a date with JavaScript's trusted built-in method.

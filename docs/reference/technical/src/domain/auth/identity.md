# `src/domain/auth/identity.ts`

## Dependencies, inputs, and role

This pure module consumes a `ServerVerifiedGoogleClaims` value created only after the server OAuth boundary validates an ID-token signature and source. `IdentityAllowlist` supplies the fixed Google issuer, client audience, exact Google `sub`, and approved email from server configuration. Version 1 accepts only scalar `aud` values exactly equal to Vision's configured audience; array-valued audiences are denied because this contract intentionally does not add `azp` handling. The injected `now` makes expiry deterministic in tests; no browser, storage, logger, network, or provider API is used here.

## Outputs and safe failures

Every malformed or disallowed identity path throws `IdentityAuthorizationError` with only `ACCOUNT_NOT_ALLOWED`. Claim fields and allowlist values are never interpolated into errors. A successful result returns the exact approved subject plus a normalized email suitable for a server-side session; it must not be treated as proof of a client-reported identity.

## `IdentityAuthorizationError`

**Signature:** `() => Error`.

Constructs the single constant authorization denial error used for all claim and allowlist failures.

## `authorizeIdentity`

**Signature:** `(claims, allowlist, now?) => AuthorizedIdentity`.

Requires a nonblank Google `sub`, verified email, exact issuer, exact scalar configured audience, valid future expiry, exact `sub` match, and normalized exact email match. The caller is responsible for cryptographic verification before calling this rule.

## `normalizeEmail`

**Signature:** `(value) => string | undefined`.

Trims and lowercases only nonblank strings, preserving a rejection path for absent or whitespace-only values.

## `isNonEmptyString`

**Signature:** `(value) => value is string`.

Runtime guard used for hostile-input handling of textual claim and configuration values.

## `snapshotRecord`

**Signature:** `(value, expectedKeys) => Readonly<Record<string, unknown>> | undefined`.

Accepts only an ordinary object with exactly the expected enumerable own data fields, no symbols, and the standard object prototype. It copies descriptor values into a frozen plain snapshot so later authorization never reads the attacker-controlled original again.

## `readDateMillis`

**Signature:** `(value) => number | undefined`.

Requires the standard `Date` prototype and calls `Date.prototype.getTime` directly, avoiding any overridden instance method.

## Test coverage

`tests/unit/domain/identity.test.ts` exercises approved normalized identity, subject/email denials, issuer/audience/expiry rejection, scalar-only audience policy, safe constant errors, and hostile non-object input.

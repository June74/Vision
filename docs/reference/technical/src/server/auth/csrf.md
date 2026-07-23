# CSRF verification

## Signatures

```ts
verifyCsrfToken(supplied: string | null, expected: string): Promise<boolean>;
```

## Dependencies

Uses Web Crypto SHA-256 and fixed-length `Uint8Array` comparison only.

## Inputs and outputs

Accepts a possibly missing caller value and the decrypted server-bound expected token. Returns `true` only for two equal canonical 43-128 character base64url tokens.

## Side effects

Calculates two in-memory digests. It performs no network, database, cookie, response, or logging work.

## Failure behavior

Malformed or absent values become an empty sentinel and return `false`; mismatch position does not cause early return and no token appears in an exception.

## Privacy and authorization

The expected token originates from the authenticated server session. The function authorizes only equality and never accepts a client identity or cross-session token.

## Covering tests

`tests/worker/auth.test.ts` covers missing, wrong, and correct session-bound CSRF headers through the actual logout route.

## `verifyCsrfToken`

Accepts only canonical 43-128 character base64url tokens. It hashes both candidate and expected values with SHA-256 and XORs every byte, so mismatch position does not create a direct early-exit timing signal.

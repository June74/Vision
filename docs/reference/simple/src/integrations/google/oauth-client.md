# Google OAuth client

Builds the exact Google authorization request, exchanges a code, and verifies that an ID token was signed by Google.

## `verify`

Checks an ID token's RS256 signature before returning its claim payload.

## `getKey`

Finds the requested public Google signing key, refreshing the cache when needed.

## `refreshKeys`

Loads a bounded set of public signing keys from Google's fixed JWKS endpoint.

## `createAuthorizationUrl`

Creates an offline authorization-code URL with state, nonce, PKCE S256, and only the approved Version 1 scopes.

## `exchangeCode`

Sends the code and server-retained PKCE verifier to Google's token endpoint.

## `verifyIdToken`

Passes a bounded ID token to the injected cryptographic verifier.

## `snapshotClientConfig`

Copies exact client configuration without invoking accessors or retaining a mutable input.

## `snapshotAuthorizationRequest`

Copies and validates exact state, nonce, challenge, and consent values.

## `snapshotExactDataObject`

Reads only enumerable own data properties from a normal object.

## `validateBoundedString`

Rejects protocol strings outside their fixed length bounds.

## `readBoundedProviderJson`

Reads provider JSON only within the maximum response size.

## `parseJwtJson`

Decodes one bounded canonical JWT segment as JSON.

## `verifyRs256Signature`

Uses Web Crypto to verify the token signature with a non-extractable public key.

## `readBoundedCacheLifetime`

Limits Google's cache duration to a safe local range.

# Google OAuth client

The adapter uses Google's fixed authorization, token, and JWKS endpoints. Network access and signature verification are injected, provider bodies are bounded before parsing, errors are constant, and the client secret appears only in the server-to-server token request.

The requested scope set is `openid`, `email`, Calendar-list read, calendar property/create access, and owned-event read. It excludes the broad Calendar scope and every event-write scope. Initial authorization uses offline access and consent; later authorization omits forced consent when an encrypted refresh token already exists.

Sources consulted: [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), and [Google Calendar scopes](https://developers.google.com/workspace/calendar/api/auth).

## `verify`

Parses the three compact JWT segments, requires `RS256` plus a bounded `kid`, verifies the signature, and only then parses the payload. A failed cached-key verification triggers one forced JWKS refresh for normal key rotation.

## `getKey`

Returns one cached JWK by `kid`; cache expiry and forced refresh are the only paths that perform a JWKS request.

## `refreshKeys`

Performs a credential-free GET to Google's fixed JWKS URL, validates a bounded RSA signing-key array, and stores only public key material.

## `createAuthorizationUrl`

Snapshots exact plain-data input, enforces 43-128 character base64url protocol values, and emits the configured redirect URI unchanged with response type `code`, PKCE method `S256`, offline access, and the fixed scope list.

## `exchangeCode`

Posts an `application/x-www-form-urlencoded` request containing the authorization code, client credentials, exact redirect URI, grant type, and PKCE verifier. It accepts only a bounded successful Bearer token response.

## `verifyIdToken`

Bounds the compact token and maps every verifier failure to `GOOGLE_ID_TOKEN_INVALID`.

## `snapshotClientConfig`

Requires exactly three enumerable own data properties, validates lengths and redirect URL structure, and freezes the copy.

## `snapshotAuthorizationRequest`

Requires exactly four enumerable own data properties and rejects arrays, accessors, symbols, unknown fields, and malformed base64url values.

## `snapshotExactDataObject`

Uses property descriptors rather than value access, preventing getter or proxy payloads from leaking their exceptions.

## `validateBoundedString`

Throws a constant provider error for non-string or out-of-range input.

## `readBoundedProviderJson`

Checks declared and actual body length before JSON parsing; provider status or body details never cross the adapter.

## `parseJwtJson`

Uses canonical base64url decoding and fatal UTF-8 decoding before JSON parsing.

## `verifyRs256Signature`

Imports one public JWK for `RSASSA-PKCS1-v1_5` with SHA-256 and verifies the original compact signing input.

## `readBoundedCacheLifetime`

Parses `max-age`, applying a five-minute fallback and a one-minute to six-hour bound.

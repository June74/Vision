# OAuth routes

`GET /api/auth/google/start` creates state, nonce, and a PKCE verifier on the server; only state, nonce, and the derived challenge enter Google's authorization URL. `GET /api/auth/google/callback` atomically consumes state before provider exchange, verifies the Google signature and claims, applies the Task 1 allowlist, encrypts tokens, rotates any prior session, and sends only a new opaque cookie. `GET /api/auth/session` resolves server state. `POST /api/auth/logout` requires the session-bound CSRF header, revokes the row, and clears the cookie.

Callback pages and audit facts are constant and contain no provider body, claim, token, state, verifier, nonce, or database detail.

## Signatures

```ts
registerOAuthRoutes(
  app: Hono<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependenciesOrResolver: AuthRouteDependencies | AuthDependencyResolver,
): void;
createProductionAuthDependencies(environment: Env, logger: SafeLogger): Promise<AuthRouteDependencies>;
```

## Dependencies

Composes Hono, environment validation, the Google adapter/JWKS verifier, Task 1 identity allowlisting, admission HMACs, encrypted token/session repositories, wrapped keys, CSRF comparison, and safe logging.

## Inputs and outputs

Consumes Worker bindings plus request query/cookie/header data through bounded parsers. Produces fixed redirects/pages/JSON, an opaque cookie, or safe 401/403/429/503 responses; no provider token is returned.

## Side effects

Start derives admission identity from trusted edge/shared context before any session lookup, performs bounded cleanup/admission, persists encrypted state, then redirects to Google. Callback physically consumes state, exchanges/verifies, atomically persists tokens, rotates the session, and redirects `/`. Logout revokes and clears.

## Failure behavior

Configuration/provider/storage/claim/scope failures use constant pages or safe error envelopes. Admission denial is a no-store 429 with `Retry-After: 600`. Safe log sink failures never change route outcomes.

## Privacy and authorization

Session creation requires signed claims, exact issuer/scalar audience/nonce/expiry/subject/verified email, exact scopes, and the Task 1 allowlist. Admission/logging never emits owner, IP, session, state, verifier, nonce, claims, or tokens.

## Covering tests

`tests/worker/auth.test.ts` covers every route, claims, replay, cookies, CSRF, safe 429, rotation, and raw/log privacy. `tests/unit/server/auth/admission.test.ts` covers admission trust.

## `registerOAuthRoutes`

Accepts static deterministic dependencies for tests or a per-request production resolver. Routes resolve dependencies before use and map configuration/provider failures to safe outcomes.

## `createProductionAuthDependencies`

Validates OAuth bindings, creates the least-privileged Neon client, resolves the protected-field key provider through durable wrapped keys, constructs Drizzle stores, and injects fixed Google endpoints plus the JWKS verifier. It performs no provider call during composition.

## `now`

Returns a new Date for state expiry, token expiry, session expiry, revocation, and allowlist expiry checks.

## `createPkceChallenge`

Calculates `BASE64URL(SHA-256(verifier))` with Web Crypto; the verifier itself never enters the authorization URL.

## `readGeneratedProtocolValue`

Requires canonical 43-128 character base64url, matching high-entropy PKCE and bearer value bounds.

## `createRandomProtocolValue`

Uses `crypto.getRandomValues` for 32 bytes and encodes unpadded base64url.

## `logAuthEventSafely`

Emits only controlled action, outcome, provider, error category, and request ID fields; logger failure cannot change auth behavior.

## `readCallbackQuery`

Requires exactly one bounded code and one canonical state, rejects any OAuth error response, and does not retain rejected query values.

## `readVerifiedClaims`

Accepts only string issuer, scalar string audience, subject, email, strict boolean `email_verified`, safe integer expiry, and matching nonce. It creates the exact Task 1 claims object only after these checks.

## `snapshotSignedClaims`

Requires a normal object with at most 32 own string data properties and reads required values through descriptors, rejecting symbols, accessors, proxies, arrays, and exotic prototypes.

## `validateGrantedScopes`

Normalizes Google's `userinfo.email` spelling to `email`, requires all fixed V1 scopes, and rejects every other grant. This prevents old broad, event-write, or unrelated grants from silently widening a new session.

## `accessDeniedPage`

Returns a no-store 403 HTML page and no identity-specific explanation.

## `authenticationFailurePage`

Returns a no-store 400 HTML page with no provider or persistence details.

## `authStartLimited`

Returns the fixed no-store 429 JSON envelope and ten-minute retry hint without an admission identifier.

## `deriveOwnerId`

SHA-256 hashes the allowlisted subject and prefixes its base64url digest, making Vision owner keys opaque.

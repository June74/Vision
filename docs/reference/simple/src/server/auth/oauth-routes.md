# OAuth routes

Provides Google sign-in start/callback, current session, and logout routes.

## `registerOAuthRoutes`

Adds all authentication routes before the generic API fallback.

## `createProductionAuthDependencies`

Builds database, encryption, Google, session, and token boundaries from validated Worker bindings.

## `now`

Reads a fresh wall-clock time for each production security decision.

## `createPkceChallenge`

Hashes the server-retained verifier into a PKCE S256 challenge.

## `readGeneratedProtocolValue`

Validates random state, nonce, session, verifier, and CSRF strings.

## `createRandomProtocolValue`

Generates a 256-bit random base64url value.

## `logAuthEventSafely`

Writes only a fixed-shape safe authentication event.

## `readCallbackQuery`

Reads one code and one state while rejecting errors, duplicates, and oversized values.

## `readVerifiedClaims`

Checks signed claim shapes, expiry, scalar audience, and one-time nonce.

## `snapshotSignedClaims`

Copies signed claims without invoking accessors.

## `validateGrantedScopes`

Requires exactly the Version 1 scope set, allowing only Google's equivalent email-scope spelling.

## `accessDeniedPage`

Returns the same generic wrong-account page for every allowlist denial.

## `authenticationFailurePage`

Returns a generic callback failure page.

## `authStartLimited`

Returns the same generic wait response when the sign-in start bound is reached.

## `deriveOwnerId`

Hashes the allowlisted Google subject into an opaque Vision owner ID.

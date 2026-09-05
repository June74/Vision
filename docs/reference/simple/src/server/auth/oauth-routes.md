# OAuth routes

Provides Google sign-in start/callback with guarded authorization recovery, current session, and logout routes.

## `registerOAuthRoutes`

Adds all authentication routes before the generic API fallback.
On preview only, recovery can report one fixed reason for refusing sign-in. The callback stores that
label separately for each request and shows it only if recovery finally returns `conflict`. Unknown
reasons stay generic. No private details are copied into the header, page, or log.

## `createProductionAuthDependencies`

Builds database, encryption, Google, session, and token boundaries from validated Worker bindings.
The actual Worker uses this factory when no test dependencies are supplied. It forwards the optional
preview reason notification to the same owner-scoped recovery repository, along with the unchanged
callback inputs; it does not create a second recovery path.

## `recoverAfterReconnect`

Checks whether Vision may safely clear an older scheduler-owned authorization disconnect after encrypted credentials are saved.
It accepts an optional second argument for a fixed reason notification. That notification never
decides sign-in: an accepted result still rotates/creates the session, while a conflict or error
preserves the old session and issues no new cookie. Errors and invalid results keep the generic
failure category even if a reason was notified first. Local and production receive no observer and
retain their generic conflict logs and unchanged pages/headers. Remove this temporary detail together
with the rest of the OAuth diagnostic only after the owner confirms sign-in.

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

## `readDiagnosticEnvironment`

Reads which deployment is running, even when configuration failed to load.

## `applyPreviewDiagnosticHeader`

Adds the failure-category response header on preview only.

## `previewDiagnosticMarkup`

Adds one line naming the failure category to preview failure pages only.

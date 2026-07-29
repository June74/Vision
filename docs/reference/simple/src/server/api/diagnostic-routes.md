# Diagnostic routes

Authenticated routes show safe foundation status and synchronized events. Changing a category requires the session’s anti-forgery token and affects Vision only.

## `registerDiagnosticRoutes`

Registers status, event list, template fallback, and category correction
routes. Status validates the complete candidate selector and AI attestation,
but applies an overlay only for one of the six fault selectors.

## `createProductionDiagnosticDependencies`

Connects encrypted sessions, keys, and the owner-scoped diagnostic repository.

## `now`

Reads current time for authentication, freshness, and corrections.

## `repositoryForOwner`

Creates a repository only for the approved private-pilot owner.

## `authenticateDiagnosticRequest`

Requires an active server session before data access.

## `requireDiagnosticCsrf`

Protects category changes.

## `readBoundedJson`

Reads at most one KiB of strict JSON.

## `toSafeDiagnosticEvent`

Copies only the public event display fields.

## `resolveRouteDependencies`

Hides setup and key failures.

## `invalidCategoryCorrection`

Returns the constant invalid-input error.

## `diagnosticsUnavailable`

Returns the constant safe availability error.

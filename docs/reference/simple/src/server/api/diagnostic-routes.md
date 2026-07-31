# Diagnostic routes

Authenticated routes show safe foundation status and synchronized events. Changing a category requires the session’s anti-forgery token and affects Vision only.

## `registerDiagnosticRoutes`

Registers status, event list, template fallback, and category correction
routes. Status validates the complete candidate selector and AI attestation,
but applies an overlay only for one of the six fault selectors.
Authenticated preview status also returns only aggregate AI acceptance counts.
Normal preview leaves candidate fields empty; the AI candidate adds created
and eligible counts plus its canonical evidence minute. Production omits the
temporary aggregate entirely.

## `createProductionDiagnosticDependencies`

Connects encrypted sessions, keys, and the owner-scoped diagnostic repository.

## `now`

Reads current time for authentication, freshness, and corrections.

## `repositoryForOwner`

Creates a repository only for the approved private-pilot owner.

## `aiUsageSourceForOwner`

Creates aggregate-only AI acceptance reads after authentication and owner
admission. It never exposes request, reservation, provider, token, or content
records.

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

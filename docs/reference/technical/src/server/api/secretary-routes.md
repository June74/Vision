# `src/server/api/secretary-routes.ts`

Authenticated Hono composition for the local secretary. Authentication is
resolved before body parsing; all write routes require `x-vision-csrf`; the
repository is selected by server-authenticated owner; and no route calls the
calendar mutation executor.

## `registerSecretaryRoutes`

**Signature:** `(app, dependenciesOrResolver) => void`

Registers:

- `GET /api/secretary/today?timeZone=...`
- `POST /api/secretary/captures`
- `POST /api/secretary/tasks`
- `POST /api/secretary/tasks/:taskId/complete`
- `POST /api/secretary/tasks/:taskId/undo`
- `POST /api/secretary/notes`

Today returns a deterministic projection with `calendarWriteAuthority` set to
`approval-required`; capture candidates expose only `canConfirm=false`.

## `createProductionSecretaryDependencies`

**Signature:** `(environment: Env, logger: SafeLogger) => Promise<SecretaryRouteDependencies>`

Builds production auth, Neon, wrapped-key, and Drizzle repository boundaries.

## `now`

**Signature:** `() => Date`

Returns a fresh server timestamp for local records and transitions.

## `repositoryForOwner`

**Signature:** `(ownerId: string) => SecretaryRepository`

Creates the repository inside the authenticated owner boundary; the current
implementation does not accept a browser owner override.

## `resolveSecretaryDependencies`

**Signature:** `(resolver, context) => Promise<SecretaryRouteDependencies>`

Lazily resolves injected dependencies and maps initialization failure to a safe
503.

## `authenticateSecretaryRequest`

**Signature:** `(context, dependencies) => Promise<AuthenticatedSession>`

Reads the opaque session cookie and resolves the owner/session through the
server repository before any local body parse.

## `requireSecretaryCsrf`

**Signature:** `(context, session) => Promise<void>`

Uses the existing constant-time CSRF verifier for local writes.

## `readBoundedJson`

**Signature:** `(request: Request) => Promise<unknown>`

Requires JSON content type, bounds the body at 20 KiB, decodes fatal UTF-8,
and parses JSON without reflecting malformed content.

## `readTimeZone`

**Signature:** `(value?: string) => string`

Accepts an explicit valid IANA zone or UTC; it never silently falls back for an
invalid supplied zone.

## `readDate`

**Signature:** `(value: Date) => Date`

Copies a finite server Date.

## `createId`

**Signature:** `(dependencies) => string`

Uses an injected or cryptographic opaque ID and validates its bounded grammar.

## `secretaryInvalid`

Raises `INVALID_SECRETARY_REQUEST` with HTTP 400 and constant text.

## `secretaryConflict`

Raises `SECRETARY_CONFLICT` with HTTP 409 for a missing or invalid task
transition.

## `secretaryUnavailable`

Raises `SECRETARY_UNAVAILABLE` with HTTP 503 while hiding persistence details.

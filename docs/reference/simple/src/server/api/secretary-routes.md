# `src/server/api/secretary-routes.ts`

These authenticated routes provide Vision-local Today, capture, task, and
protected-note behavior. Every write uses the existing session CSRF check.
Calendar candidates remain pending and have no confirmation route here.

## `registerSecretaryRoutes`

Mounts Today, capture, task, task-transition, and note routes.

## `createProductionSecretaryDependencies`

Connects auth, database, wrapped keys, and owner-scoped repository.

## `now`

Supplies server time for local record timestamps.

## `repositoryForOwner`

Returns a repository bound to the authenticated owner.

## `resolveSecretaryDependencies`

Resolves injected dependencies safely.

## `authenticateSecretaryRequest`

Authenticates the opaque Vision session before body parsing.

## `requireSecretaryCsrf`

Protects every local write.

## `readBoundedJson`

Reads a small JSON body with strict content type and size checks.

## `readTimeZone`

Validates the requested IANA timezone.

## `readDate`

Copies a valid server Date.

## `createId`

Creates the opaque local record identity.

## `secretaryInvalid`

Returns the safe malformed-request error.

## `secretaryConflict`

Returns the safe task-transition conflict.

## `secretaryUnavailable`

Returns the safe local-secretary availability error.

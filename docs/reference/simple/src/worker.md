# `src/worker.ts`

The Vision Worker answers `GET /api/health` with `{ "status": "ok", "service": "vision" }`. Every request gets an opaque ID. Unknown API routes return a safe JSON error, while browser routes still go to static assets.

## `AppDependencies`

`AppDependencies` lets tests supply their own logger or request-ID maker.

## `consoleLogger`

`consoleLogger` writes one already-checked audit event to the Worker console.

## `logErrorSafely`

`logErrorSafely` tries to record a safe audit event without allowing a logger outage to change the API response.

## `createApp`

`createApp` creates the Worker app and its privacy-safe error handling.

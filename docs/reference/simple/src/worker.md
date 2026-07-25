# `src/worker.ts`

The Vision Worker answers `GET /api/health` with `{ "status": "ok", "service": "vision" }`. Every request gets an opaque ID. It registers server-side Google authentication before the unknown-API fallback, while browser routes still go to static assets.

## `AppDependencies`

`AppDependencies` lets tests supply their own logger, request-ID maker, authentication, calendar, AI, diagnostic, or webhook boundaries.

## `consoleLogger`

`consoleLogger` writes one already-checked audit event to the Worker console.

## `logErrorSafely`

`logErrorSafely` tries to record a safe audit event without allowing a logger outage to change the API response.

## `createApp`

`createApp` creates the Worker app, registers the diagnostic routes before the API fallback, and keeps privacy-safe error handling.

## `fetch`

Delegates HTTP requests to the registered Hono application.

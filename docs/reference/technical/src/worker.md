# `src/worker.ts`

This module creates the default Hono Worker application with `Env` bindings and `RequestContext` variables. `GET /api/health` preserves the exact immutable JSON body `{ status: "ok", service: "vision" }`. The `/api/*` fallback throws an expected `VisionError`; browser routes still call `ASSETS.fetch`. The central Hono error handler converts errors to envelopes and submits only a validated category to its injected logger. The Worker performs no authentication, database, provider, or AI operation in this task.

## `AppDependencies`

`AppDependencies` optionally injects a `SafeLogger` and `RequestIdFactory`. The default app uses a console logger and `crypto.randomUUID`; tests can avoid mutating process-wide state.

## `consoleLogger`

**Signature:** `consoleLogger(event: SafeLogEvent): void`

This private sink calls `console.info` only after `logEvent` has parsed the allowlisted event.

## `createApp`

**Signature:** `createApp(dependencies?: AppDependencies): Hono`

The factory installs request context first, then registers health, unknown API, and static-asset routes. Its `onError` handler maps unexpected values to `INTERNAL_ERROR`, logs `{ requestId, action: "api.request", outcome: "failed", errorCategory }`, and returns `createErrorEnvelope` with the approved HTTP status.

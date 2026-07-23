# `src/worker.ts`

This module creates the default Hono Worker application with `Env` bindings and authentication-capable request variables. `GET /api/health` preserves the exact immutable JSON body `{ status: "ok", service: "vision" }`. Authentication routes resolve production bindings lazily; missing bindings return a safe service-unavailable envelope. The `/api/*` fallback throws an expected `VisionError`, browser routes still call `ASSETS.fetch`, and the central error handler submits only a validated category to its logger.

## `AppDependencies`

`AppDependencies` optionally injects a `SafeLogger`, `RequestIdFactory`, and static `AuthRouteDependencies`. The default app uses a console logger, `crypto.randomUUID`, and the validated production auth resolver; tests can replace every network, clock, randomness, crypto-key, and persistence boundary.

## `consoleLogger`

**Signature:** `consoleLogger(event: SafeLogEvent): void`

This private sink calls `console.info` only after `logEvent` has parsed the allowlisted event.

## `logErrorSafely`

**Signature:** `logErrorSafely(logger: SafeLogger, requestId: string, errorCategory: string): void`

The function calls `logEvent` with constant action/outcome and a safe category, then intentionally absorbs a sink failure. This preserves the required response envelope when logging infrastructure is unavailable.

## `createApp`

**Signature:** `createApp(dependencies?: AppDependencies): Hono`

The factory installs request context first, then registers health, authentication, unknown API, and static-asset routes. Its `onError` handler maps expected and unexpected values through `toVisionErrorResponse`, attempts to log `{ requestId, action: "api.request", outcome: "failed", errorCategory }`, and returns the safe body even when the sink throws.

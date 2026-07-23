# `src/worker.ts`

This module creates the default Hono Worker application with `Env` bindings and authentication-capable request variables. `GET /api/health` preserves the exact immutable JSON body `{ status: "ok", service: "vision" }`. Authentication routes resolve production bindings lazily; missing bindings return a safe service-unavailable envelope. The `/api/*` fallback throws an expected `VisionError`, browser routes still call `ASSETS.fetch`, and the central error handler submits only a validated category to its logger.

## Signatures

```ts
createApp(dependencies?: AppDependencies): Hono<{
  Bindings: Env;
  Variables: AuthRequestVariables;
}>;
```

## Dependencies

Composes Hono, request-context middleware, safe logging/error mapping, OAuth route registration, Worker bindings, and the static-assets fetcher.

## Inputs and outputs

Accepts optional deterministic logger/request-ID/auth dependencies. Returns the complete Worker application whose API responses and static fallthrough are fixed by route contracts.

## Side effects

Application construction registers middleware/routes only. Request handling may log a validated event, resolve auth persistence/provider dependencies, or call `ASSETS.fetch`; composition itself makes no external call.

## Failure behavior

Expected and unexpected thrown values are converted to bounded `VisionError` responses. Logger failure is absorbed. Missing production auth bindings produce a constant 503 without affecting health/static routes.

## Privacy and authorization

Only parsed safe log events reach `console.info`. Authentication is delegated to the server auth routes; test injection is available only through the explicit factory and does not change the default Worker.

## Covering tests

`tests/worker/worker.test.ts` covers health, errors, and assets. `tests/worker/auth.test.ts` covers registered authentication routes and safe default configuration failures.

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

# `src/server/request-context.ts`

This module defines the request-scoped correlation boundary. It stores only a randomly generated opaque ID and deliberately does not copy headers, paths, bodies, or user identity into context.

## `RequestContext`

`RequestContext` is the Hono `Variables` contract with a single `requestId: string` property.

## `RequestIdFactory`

`RequestIdFactory` is `() => string`. It is injectable for deterministic tests and defaults to `crypto.randomUUID()` in production.

## `createRequestContextMiddleware`

**Signature:** `createRequestContextMiddleware(createRequestId?: RequestIdFactory): MiddlewareHandler<{ Variables: RequestContext }>`

The middleware calls the factory once, stores its result under `requestId`, then awaits downstream routing. That ordering makes the ID available to the Hono error handler.

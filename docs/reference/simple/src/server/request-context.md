# `src/server/request-context.ts`

This module gives every request a new opaque ID. The ID helps a caller report an error without revealing request details.

## `RequestContext`

`RequestContext` stores the request ID in Hono's request context.

## `RequestIdFactory`

`RequestIdFactory` creates an opaque request ID.

## `createRequestContextMiddleware`

`createRequestContextMiddleware` returns Hono middleware that creates and stores a new request ID before the route runs.

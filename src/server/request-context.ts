/** Adds an opaque request identifier to Hono contexts without retaining request content. */
import type { MiddlewareHandler } from "hono";

/** Stores the only request-scoped value that may be returned to API callers or audit logs. */
export interface RequestContext {
  requestId: string;
}

/** Creates opaque request IDs for the application runtime. */
export type RequestIdFactory = () => string;

/** Assigns a fresh request identifier before downstream routing and error handling run. */
export function createRequestContextMiddleware(
  createRequestId: RequestIdFactory = () => crypto.randomUUID(),
): MiddlewareHandler<{ Variables: RequestContext }> {
  return async (context, next) => {
    context.set("requestId", createRequestId());
    await next();
  };
}

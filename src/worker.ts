/** Serves the Vision API, assigns opaque request IDs, and returns privacy-safe error envelopes. */
import { Hono } from "hono";
import type { Env } from "./server/env";
import { createErrorEnvelope, toVisionError, VisionError } from "./server/errors";
import { logEvent, type SafeLogger } from "./server/logging";
import { createRequestContextMiddleware, type RequestContext, type RequestIdFactory } from "./server/request-context";

/** Supplies replaceable runtime boundaries for deterministic, side-effect-free application tests. */
export interface AppDependencies {
  logger?: SafeLogger;
  createRequestId?: RequestIdFactory;
}

/** Writes only a previously validated, structured event to the Worker console. */
function consoleLogger(event: Parameters<SafeLogger>[0]): void {
  console.info(event);
}

/** Creates the Vision Worker application with injected privacy-safe runtime dependencies. */
export function createApp(dependencies: AppDependencies = {}) {
  const logger = dependencies.logger ?? consoleLogger;
  const app = new Hono<{ Bindings: Env; Variables: RequestContext }>();

  app.use("*", createRequestContextMiddleware(dependencies.createRequestId));

  app.get("/api/health", (context) => context.json({ status: "ok", service: "vision" } as const));
  app.all("/api/*", () => {
    throw new VisionError("NOT_FOUND", 404, "API route not found.");
  });
  app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));

  app.onError((error, context) => {
    const visionError = toVisionError(error);
    const requestId = context.get("requestId");

    logEvent(logger, {
      requestId,
      action: "api.request",
      outcome: "failed",
      errorCategory: visionError.code,
    });

    return context.json(createErrorEnvelope(visionError, requestId), visionError.status);
  });

  return app;
}

const app = createApp();

export default app;

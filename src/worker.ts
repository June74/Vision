/** Serves the Vision API, assigns opaque request IDs, and returns privacy-safe error envelopes. */
import { Hono } from "hono";
import type { Env } from "./server/env";
import { throwVisionError, toVisionErrorResponse, VisionError } from "./server/errors";
import { logEvent, type SafeLogger } from "./server/logging";
import { createRequestContextMiddleware, type RequestIdFactory } from "./server/request-context";
import {
  createProductionAuthDependencies,
  registerOAuthRoutes,
  type AuthRouteDependencies,
} from "./server/auth/oauth-routes";
import type { AuthRequestVariables } from "./server/auth/session";

/** Supplies replaceable runtime boundaries for deterministic, side-effect-free application tests. */
export interface AppDependencies {
  logger?: SafeLogger;
  createRequestId?: RequestIdFactory;
  auth?: AuthRouteDependencies;
}

/** Writes only a previously validated, structured event to the Worker console. */
function consoleLogger(event: Parameters<SafeLogger>[0]): void {
  console.info(event);
}

/** Prevents a failing audit sink from replacing the privacy-safe API response. */
function logErrorSafely(logger: SafeLogger, requestId: string, errorCategory: string): void {
  try {
    logEvent(logger, {
      requestId,
      action: "api.request",
      outcome: "failed",
      errorCategory,
    });
  } catch {
    // Audit availability must never change the caller's safe error envelope.
  }
}

/** Creates the Vision Worker application with injected privacy-safe runtime dependencies. */
export function createApp(dependencies: AppDependencies = {}) {
  const logger = dependencies.logger ?? consoleLogger;
  const app = new Hono<{ Bindings: Env; Variables: AuthRequestVariables }>();

  app.use("*", createRequestContextMiddleware(dependencies.createRequestId));

  app.get("/api/health", (context) => context.json({ status: "ok", service: "vision" } as const));
  registerOAuthRoutes(
    app,
    dependencies.auth ??
      ((environment) => createProductionAuthDependencies(environment, logger)),
  );
  app.all("/api/*", () => {
    throwVisionError(new VisionError("NOT_FOUND", 404, "API route not found."));
  });
  app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));

  app.onError((error, context) => {
    const requestId = context.get("requestId");
    const response = toVisionErrorResponse(error, requestId);

    logErrorSafely(logger, requestId, response.body.error.code);

    return context.json(response.body, response.status);
  });

  return app;
}

const app = createApp();

export default app;

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
import {
  createProductionCalendarSetupDependencies,
  registerCalendarSetupRoutes,
  type CalendarSetupRouteDependencies,
} from "./server/api/calendar-setup-routes";
import {
  createProductionCalendarWriteDependencies,
  registerCalendarWriteRoutes,
  type CalendarWriteRouteDependencies,
} from "./server/api/calendar-write-routes";
import {
  createProductionAiCategoryProposalDependencies,
  registerAiCategoryProposalRoute,
  type AiCategoryProposalRouteDependencies,
} from "./server/api/ai-category-proposal-routes";
import {
  createProductionDiagnosticDependencies,
  registerDiagnosticRoutes,
  type DiagnosticRouteDependencies,
} from "./server/api/diagnostic-routes";
import {
  createProductionGoogleCalendarWebhookDependencies,
  registerGoogleCalendarWebhook,
  type GoogleCalendarWebhookDependencies,
} from "./server/webhooks/google-calendar";
import { consumer } from "./jobs/queue-consumer";
import type { CalendarSyncMessage } from "./jobs/queue-message";
import { scheduled } from "./jobs/scheduled";

/** Supplies replaceable runtime boundaries for deterministic, side-effect-free application tests. */
export interface AppDependencies {
  logger?: SafeLogger;
  createRequestId?: RequestIdFactory;
  auth?: AuthRouteDependencies;
  calendarSetup?: CalendarSetupRouteDependencies;
  calendarWrite?: CalendarWriteRouteDependencies;
  aiCategoryProposal?: AiCategoryProposalRouteDependencies;
  diagnostic?: DiagnosticRouteDependencies;
  googleCalendarWebhook?: GoogleCalendarWebhookDependencies;
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
  registerCalendarSetupRoutes(
    app,
    dependencies.calendarSetup ??
      ((environment) =>
        createProductionCalendarSetupDependencies(environment, logger)),
  );
  registerCalendarWriteRoutes(
    app,
    dependencies.calendarWrite ??
      ((environment) =>
        createProductionCalendarWriteDependencies(environment, logger)),
  );
  registerAiCategoryProposalRoute(
    app,
    dependencies.aiCategoryProposal ??
      ((environment) =>
        createProductionAiCategoryProposalDependencies(environment, logger)),
  );
  registerDiagnosticRoutes(
    app,
    dependencies.diagnostic ??
      ((environment) =>
        createProductionDiagnosticDependencies(environment, logger)),
  );
  registerGoogleCalendarWebhook(
    app,
    dependencies.googleCalendarWebhook ??
      createProductionGoogleCalendarWebhookDependencies,
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

/** Exposes Hono fetch handling and the same idempotent queue consumer from one Worker. */
const worker: ExportedHandler<Env, CalendarSyncMessage> = {
  /** Delegates HTTP requests to the fully registered Hono application. */
  fetch: (request, environment, context) =>
    app.fetch(request, environment, context),
  queue: consumer,
  scheduled,
};

export default worker;

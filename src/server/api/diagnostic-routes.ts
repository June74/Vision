/** Registers authenticated, privacy-safe foundation diagnostics and Vision-only category correction. */
import type { Context, Hono } from "hono";
import { z } from "zod";
import { createWrappedKeyProvider } from "../../crypto/key-provider";
import { createDb } from "../../data/db";
import {
  createPhaseBAiUsageSource,
  type PhaseBAiUsageSource,
} from "../../data/phase-b-ai-usage-source";
import { createUsageWarningSource } from "../../data/usage-warning-source";
import {
  createDiagnosticRepository,
  type DiagnosticEvent,
  type DiagnosticRepositoryPort,
} from "../../data/repositories/diagnostic-repository";
import type { EncryptedSessionRepository } from "../../data/repositories/session-repository";
import { DrizzleWrappedDataKeyStore } from "../../data/repositories/token-repository";
import { calculateFoundationHealth } from "../../domain/operations/health";
import {
  TEMPORARY_PREVIEW_FAULT_SCENARIOS,
  applyTemporaryPreviewFaultOverlay,
  parseTemporaryPreviewAiEvidenceWindow,
  parseTemporaryPreviewAcceptanceAiGatewayAttestation,
  parseTemporaryPreviewAcceptanceSelector,
  type TemporaryPreviewFaultScenario,
} from "../../domain/operations/temporary-preview-fault";
import { verifyCsrfToken } from "../auth/csrf";
import { createProductionAuthDependencies } from "../auth/oauth-routes";
import {
  readSessionCookie,
  requireSession,
  type AuthenticatedSession,
  type AuthRequestVariables,
} from "../auth/session";
import { createAiEventRepositoryAccess } from "../authorization/event-content-authorization";
import {
  parseVisionKeyEncryptionKey,
  parseUsageWarningThresholds,
  type Env,
} from "../env";
import { throwVisionError, VisionError } from "../errors";
import type { SafeLogger } from "../logging";

const MAX_CATEGORY_CORRECTION_BODY_BYTES = 1_024;
const categoryCorrectionSchema = z
  .object({
    domain: z.enum(["school", "work", "personal"]),
  })
  .strict();

/** Supplies replaceable session and owner-scoped repository boundaries for Worker tests. */
export interface DiagnosticRouteDependencies {
  readonly now: () => Date;
  readonly sessions: Pick<EncryptedSessionRepository, "findSession">;
  readonly repositoryForOwner: (ownerId: string) => DiagnosticRepositoryPort;
  readonly aiUsageSourceForOwner: (
    ownerId: string,
  ) => Pick<
    PhaseBAiUsageSource,
    "countActiveRequests" | "readCandidateRequestCounts"
  >;
}

/** Resolves diagnostic dependencies lazily from bindings or deterministic tests. */
export type DiagnosticDependencyResolver = (
  environment: Env,
) => DiagnosticRouteDependencies | Promise<DiagnosticRouteDependencies>;

/** Adds safe status, event-list, template, and category-correction routes. */
export function registerDiagnosticRoutes(
  app: Hono<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependenciesOrResolver:
    | DiagnosticRouteDependencies
    | DiagnosticDependencyResolver,
): void {
  const resolveDependencies: DiagnosticDependencyResolver =
    typeof dependenciesOrResolver === "function"
      ? dependenciesOrResolver
      : () => dependenciesOrResolver;

  app.get("/api/diagnostics/status", async (context) => {
    const selector = parseTemporaryPreviewAcceptanceSelector(context.env);
    parseTemporaryPreviewAcceptanceAiGatewayAttestation(context.env);
    const scenario = TEMPORARY_PREVIEW_FAULT_SCENARIOS.includes(
      selector as TemporaryPreviewFaultScenario,
    )
      ? (selector as TemporaryPreviewFaultScenario)
      : undefined;
    const dependencies = await resolveRouteDependencies(
      resolveDependencies,
      context,
    );
    const session = await authenticateDiagnosticRequest(context, dependencies);
    const repository = dependencies.repositoryForOwner(session.ownerId);
    try {
      let aiAcceptance:
        | {
            readonly activeRequestCount: number;
            readonly createdRequestCount: number | null;
            readonly eligibleSettledRequestCount: number | null;
            readonly evidenceScheduledAt: string | null;
          }
        | undefined;
      if (context.env.VISION_ENV === "preview") {
        const source = dependencies.aiUsageSourceForOwner(session.ownerId);
        const activeRequestCount = await source.countActiveRequests();
        if (selector === "ai_usage") {
          const window = parseTemporaryPreviewAiEvidenceWindow(context.env);
          if (!window) throw diagnosticsUnavailable();
          const counts = await source.readCandidateRequestCounts({
            activatedAt: window.activatedAt,
            evidenceScheduledAt: window.evidenceScheduledAt,
          });
          aiAcceptance = {
            activeRequestCount,
            createdRequestCount: counts.createdRequestCount,
            eligibleSettledRequestCount: counts.eligibleSettledRequestCount,
            evidenceScheduledAt: window.evidenceScheduledAt.toISOString(),
          };
        } else {
          aiAcceptance = {
            activeRequestCount,
            createdRequestCount: null,
            eligibleSettledRequestCount: null,
            evidenceScheduledAt: null,
          };
        }
      }
      const observedAt = dependencies.now();
      const facts = await repository.readFoundationFacts(observedAt);
      const effectiveFacts = scenario
        ? applyTemporaryPreviewFaultOverlay(scenario, facts, observedAt)
        : facts;
      const health = calculateFoundationHealth(effectiveFacts, observedAt);
      context.header("Cache-Control", "no-store");
      const status = {
        state: health.state,
        authorizationState: effectiveFacts.authorizationState,
        lastSuccessfulSyncAt:
          effectiveFacts.lastSuccessfulSyncAt?.toISOString() ?? null,
        syncDelayMs: health.syncDelayMs,
        oldestQueuedJobAt:
          effectiveFacts.oldestQueuedJobAt?.toISOString() ?? null,
        oldestJobDelayMs: health.oldestJobDelayMs,
        queueRetryCount: effectiveFacts.queueRetryCount,
        failedJobCount: effectiveFacts.failedJobCount,
        channelExpiresAt:
          effectiveFacts.channelExpiresAt?.toISOString() ?? null,
        aiSpendTier: health.aiSpendTier,
        aiMonthlyCents: effectiveFacts.aiMonthlyCents,
        databaseUsageWarning: effectiveFacts.databaseUsageWarning,
        r2UsageWarning: effectiveFacts.r2UsageWarning,
        safeErrorCode: effectiveFacts.safeErrorCode,
        warningCodes: [...health.warningCodes],
      };
      return aiAcceptance === undefined
        ? context.json({ status })
        : context.json({ status, aiAcceptance });
    } catch {
      throw diagnosticsUnavailable();
    }
  });

  app.get("/api/calendar/events", async (context) => {
    const dependencies = await resolveRouteDependencies(
      resolveDependencies,
      context,
    );
    const session = await authenticateDiagnosticRequest(context, dependencies);
    const repository = dependencies.repositoryForOwner(session.ownerId);
    try {
      const events = await repository.listEvents();
      context.header("Cache-Control", "no-store");
      return context.json({ events: events.map(toSafeDiagnosticEvent) });
    } catch {
      throw diagnosticsUnavailable();
    }
  });

  app.patch("/api/calendar/events/:id/category", async (context) => {
    const dependencies = await resolveRouteDependencies(
      resolveDependencies,
      context,
    );
    const session = await authenticateDiagnosticRequest(context, dependencies);
    await requireDiagnosticCsrf(context, session);
    const parsed = categoryCorrectionSchema.safeParse(
      await readBoundedJson(context.req.raw),
    );
    if (!parsed.success) throw invalidCategoryCorrection();
    const eventId = context.req.param("id");
    if (
      eventId.length === 0 ||
      eventId.length > 128 ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(eventId)
    ) {
      throw invalidCategoryCorrection();
    }
    const repository = dependencies.repositoryForOwner(session.ownerId);
    try {
      const corrected = await repository.correctCategory(
        eventId,
        parsed.data.domain,
        dependencies.now(),
      );
      if (!corrected) {
        throwVisionError(
          new VisionError("EVENT_NOT_FOUND", 404, "Event was not found."),
        );
      }
      context.header("Cache-Control", "no-store");
      return context.json({
        category: {
          id: corrected.id,
          domain: corrected.domain,
          domainState: corrected.domainState,
          categoryProvenance: corrected.categoryProvenance,
          assignedAt: corrected.assignedAt,
          version: corrected.version,
        },
      });
    } catch (error) {
      if (error instanceof VisionError) throw error;
      throw diagnosticsUnavailable();
    }
  });

  app.get("/api/diagnostics/templates", async (context) => {
    const dependencies = await resolveRouteDependencies(
      resolveDependencies,
      context,
    );
    await authenticateDiagnosticRequest(context, dependencies);
    context.header("Cache-Control", "no-store");
    return context.json({
      templates: {
        aiUnavailable: true,
        syncDelayed: true,
        actionRequired: true,
        disconnected: true,
      },
    });
  });
}

/** Builds production dependencies over encrypted sessions, wrapped keys, and owner-scoped SQL. */
export async function createProductionDiagnosticDependencies(
  environment: Env,
  logger: SafeLogger,
): Promise<DiagnosticRouteDependencies> {
  const auth = await createProductionAuthDependencies(environment, logger);
  const database = createDb(environment.DATABASE_URL);
  const keyProvider = await createWrappedKeyProvider(
    parseVisionKeyEncryptionKey(environment.KEY_ENCRYPTION_KEY),
    new DrizzleWrappedDataKeyStore(database),
    1,
  );
  if (!environment.BACKUP_BUCKET) {
    throw new Error("Diagnostic storage measurement is unavailable.");
  }
  const usageWarningSource = createUsageWarningSource(
    database,
    environment.BACKUP_BUCKET,
    parseUsageWarningThresholds(environment),
  );
  return {
    /** Reads wall-clock time independently for authentication and health freshness. */
    now: () => new Date(),
    sessions: auth.sessions,
    /** Creates a repository only for the fixed production owner admitted by OAuth. */
    repositoryForOwner: (ownerId) => {
      if (ownerId !== auth.ownerId) {
        throw new Error("Diagnostic owner scope is unavailable.");
      }
      return createDiagnosticRepository(
        database,
        keyProvider,
        createAiEventRepositoryAccess(ownerId),
        usageWarningSource,
      );
    },
    /** Creates aggregate-only AI acceptance reads after session owner admission. */
    aiUsageSourceForOwner: (ownerId) => {
      if (ownerId !== auth.ownerId) {
        throw new Error("Diagnostic owner scope is unavailable.");
      }
      const source = createPhaseBAiUsageSource(database, ownerId);
      const { countActiveRequests, readCandidateRequestCounts } = source;
      return Object.freeze({ countActiveRequests, readCandidateRequestCounts });
    },
  };
}

/** Resolves one active encrypted server session before any repository or body access. */
async function authenticateDiagnosticRequest(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependencies: DiagnosticRouteDependencies,
): Promise<AuthenticatedSession> {
  const sessionId = readSessionCookie(context.req.raw);
  const persisted = sessionId
    ? await dependencies.sessions.findSession(sessionId, dependencies.now())
    : undefined;
  if (!sessionId || !persisted) {
    throwVisionError(
      new VisionError(
        "AUTHENTICATION_REQUIRED",
        401,
        "Authentication is required.",
      ),
    );
  }
  context.set("authenticatedSession", { ...persisted, sessionId });
  return requireSession(context);
}

/** Requires the exact decrypted session CSRF token before category mutation. */
async function requireDiagnosticCsrf(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  session: AuthenticatedSession,
): Promise<void> {
  if (
    !(await verifyCsrfToken(
      context.req.header("x-vision-csrf") ?? null,
      session.csrfToken,
    ))
  ) {
    throwVisionError(
      new VisionError(
        "CSRF_VALIDATION_FAILED",
        403,
        "Request could not be verified.",
      ),
    );
  }
}

/** Streams strict category JSON without buffering beyond one fixed KiB. */
async function readBoundedJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:;|$)/iu.test(contentType)) {
    throw invalidCategoryCorrection();
  }
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^(?:0|[1-9]\d*)$/u.test(declaredLength) ||
      Number(declaredLength) > MAX_CATEGORY_CORRECTION_BODY_BYTES)
  ) {
    throw invalidCategoryCorrection();
  }
  if (request.body === null) throw invalidCategoryCorrection();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_CATEGORY_CORRECTION_BODY_BYTES) {
        await reader.cancel();
        throw invalidCategoryCorrection();
      }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof VisionError) throw error;
    throw invalidCategoryCorrection();
  }
}

/** Copies the exact public event allowlist and drops any accidental repository extras. */
function toSafeDiagnosticEvent(event: DiagnosticEvent): DiagnosticEvent {
  return {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timeZone: event.timeZone,
    status: event.status,
    domain: event.domain,
    domainState: event.domainState,
    categoryProvenance: event.categoryProvenance,
  };
}

/** Hides configuration, key, and persistence initialization failures. */
async function resolveRouteDependencies(
  resolver: DiagnosticDependencyResolver,
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
): Promise<DiagnosticRouteDependencies> {
  return Promise.resolve(resolver(context.env)).catch(() => {
    throw diagnosticsUnavailable();
  });
}

/** Creates one constant input failure without echoing body or event identifiers. */
function invalidCategoryCorrection(): never {
  throwVisionError(
    new VisionError(
      "INVALID_CATEGORY_CORRECTION",
      400,
      "Category correction is invalid.",
    ),
  );
}

/** Creates one constant diagnostic availability failure without implementation detail. */
function diagnosticsUnavailable(): never {
  throwVisionError(
    new VisionError(
      "DIAGNOSTICS_UNAVAILABLE",
      503,
      "Foundation diagnostics are temporarily unavailable.",
    ),
  );
}

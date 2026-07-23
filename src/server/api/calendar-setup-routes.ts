/** Registers authenticated, CSRF-protected Vision calendar discovery and one-shot setup routes. */
import type { Context, Hono } from "hono";
import { z } from "zod";
import { createDb } from "../../data/db";
import {
  CalendarRepository,
  CalendarRepositoryError,
  DrizzleCalendarStore,
  type CalendarCreationOperation,
  type CalendarRepositoryPort,
  type CalendarSetupSnapshot,
  type VerifiedCalendarEvidence,
} from "../../data/repositories/calendar-repository";
import type { EncryptedSessionRepository } from "../../data/repositories/session-repository";
import type { TokenRepositoryPort } from "../../data/repositories/token-repository";
import {
  CalendarClient,
  CalendarProviderError,
  type CreatedSecondaryCalendar,
  type OwnedSecondaryCalendar,
} from "../../integrations/google-calendar/calendar-client";
import { createProductionAuthDependencies } from "../auth/oauth-routes";
import { verifyCsrfToken } from "../auth/csrf";
import {
  readSessionCookie,
  requireSession,
  type AuthenticatedSession,
  type AuthRequestVariables,
} from "../auth/session";
import type { Env } from "../env";
import { parseVisionUserTimeZone } from "../env";
import { throwVisionError, VisionError } from "../errors";
import { logEvent, type SafeLogger } from "../logging";

const selectSchema = z
  .object({
    setupVersion: z.number().int().positive(),
    calendarId: z.string().trim().min(1).max(1_024),
  })
  .strict();
const discoverSchema = z
  .object({
    setupVersion: z.number().int().positive(),
  })
  .strict();
const confirmCreateSchema = z
  .object({
    setupVersion: z.number().int().positive(),
    confirmation: z.literal("CREATE VISION CALENDAR"),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
const MAX_SETUP_REQUEST_BODY_BYTES = 8 * 1_024;

/** The only Google Calendar methods visible to setup orchestration. */
export interface CalendarClientPort {
  listOwnedSecondaryCalendars(): Promise<readonly OwnedSecondaryCalendar[]>;
  createSecondaryCalendar(userTimeZone: string): Promise<CreatedSecondaryCalendar>;
  getCalendar(calendarId: string): Promise<OwnedSecondaryCalendar>;
}

/** Authenticated route dependencies with replaceable provider and persistence boundaries. */
export interface CalendarSetupRouteDependencies {
  readonly logger: SafeLogger;
  readonly now: () => Date;
  readonly userTimeZone: string;
  readonly sessions: Pick<EncryptedSessionRepository, "findSession">;
  readonly tokens: Pick<TokenRepositoryPort, "getGoogleTokens">;
  readonly createCalendarClient: (
    accessToken: string,
    googleSubject: string,
  ) => CalendarClientPort;
  readonly createRepository: (
    ownerId: string,
    googleSubject: string,
  ) => CalendarRepositoryPort;
}

/** Resolves calendar setup dependencies from Worker bindings or deterministic tests. */
export type CalendarSetupDependencyResolver = (
  environment: Env,
) =>
  | CalendarSetupRouteDependencies
  | Promise<CalendarSetupRouteDependencies>;

/** Adds discovery, explicit selection, and exact-confirmation routes before the API fallback. */
export function registerCalendarSetupRoutes(
  app: Hono<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependenciesOrResolver:
    | CalendarSetupRouteDependencies
    | CalendarSetupDependencyResolver,
): void {
  const resolveDependencies: CalendarSetupDependencyResolver =
    typeof dependenciesOrResolver === "function"
      ? dependenciesOrResolver
      : () => dependenciesOrResolver;

  app.get("/api/setup/calendar", async (context) => {
    const dependencies = await resolveSetupDependencies(
      resolveDependencies,
      context,
    );
    const session = await authenticateSetupRequest(context, dependencies);
    const repository = dependencies.createRepository(
      session.ownerId,
      session.googleSubject,
    );
    const snapshot =
      (await repository.getSnapshot()) ?? initialSetupSnapshot();
    noStore(context);
    return context.json(toSetupResponse(snapshot));
  });

  app.post("/api/setup/calendar/discover", async (context) => {
    const dependencies = await resolveSetupDependencies(
      resolveDependencies,
      context,
    );
    const session = await authenticateSetupRequest(context, dependencies);
    await requireCsrf(context, session);
    const input = discoverSchema.safeParse(await readSetupJson(context.req.raw));
    if (!input.success) throw invalidSetupRequest();
    const client = await resolveCalendarClient(dependencies, session);
    const calendars = await client
      .listOwnedSecondaryCalendars()
      .catch(() => {
        throw providerUnavailable();
      });
    const repository = dependencies.createRepository(
      session.ownerId,
      session.googleSubject,
    );
    const snapshot = await repository
      .discover(
        input.data.setupVersion,
        bindVerificationTime(calendars, dependencies.now()),
        dependencies.now(),
      )
      .catch(mapRepositoryFailure);
    logCalendarEventSafely(
      dependencies.logger,
      context.get("requestId"),
      "calendar.setup.discover",
      "succeeded",
    );
    noStore(context);
    return context.json(toSetupResponse(snapshot));
  });

  app.post("/api/setup/calendar/select", async (context) => {
    const dependencies = await resolveSetupDependencies(
      resolveDependencies,
      context,
    );
    const session = await authenticateSetupRequest(context, dependencies);
    await requireCsrf(context, session);
    const input = selectSchema.safeParse(await readSetupJson(context.req.raw));
    if (!input.success) throw invalidSetupRequest();
    const client = await resolveCalendarClient(dependencies, session);
    const verified = await client.getCalendar(input.data.calendarId);
    const repository = dependencies.createRepository(
      session.ownerId,
      session.googleSubject,
    );
    const snapshot = await repository
      .selectExisting(
        input.data.setupVersion,
        withVerificationTime(verified, dependencies.now()),
        dependencies.now(),
      )
      .catch(mapRepositoryFailure);
    logCalendarEventSafely(
      dependencies.logger,
      context.get("requestId"),
      "calendar.setup.select",
      "succeeded",
    );
    noStore(context);
    return context.json(toSetupResponse(snapshot));
  });

  app.post("/api/setup/calendar/confirm-create", async (context) => {
    const dependencies = await resolveSetupDependencies(
      resolveDependencies,
      context,
    );
    const session = await authenticateSetupRequest(context, dependencies);
    await requireCsrf(context, session);
    const input = confirmCreateSchema.safeParse(
      await readSetupJson(context.req.raw),
    );
    if (!input.success) throw invalidSetupRequest();
    const repository = dependencies.createRepository(
      session.ownerId,
      session.googleSubject,
    );
    const existing = await repository.findCreationOperation(
      input.data.idempotencyKey,
    );
    if (existing?.status === "completed") {
      const snapshot = await requireSetupSnapshot(repository);
      noStore(context);
      return context.json(toSetupResponse(snapshot));
    }
    if (existing?.status === "definite_failure") {
      const snapshot = await requireSetupSnapshot(repository);
      noStore(context);
      return context.json(toSetupResponse(snapshot), 409);
    }
    const client = await resolveCalendarClient(dependencies, session);
    if (existing) {
      return reconcileCreation(
        context,
        dependencies,
        repository,
        client,
        existing,
      );
    }

    const preCreateCalendars = await client.listOwnedSecondaryCalendars();
    if (preCreateCalendars.length > 0) {
      const choice = await repository
        .discover(
          input.data.setupVersion,
          bindVerificationTime(preCreateCalendars, dependencies.now()),
          dependencies.now(),
        )
        .catch(mapRepositoryFailure);
      noStore(context);
      return context.json(toSetupResponse(choice), 409);
    }
    const started = await repository
      .beginCreation(
        input.data.setupVersion,
        input.data.idempotencyKey,
        bindVerificationTime(preCreateCalendars, dependencies.now()),
        dependencies.now(),
      )
      .catch(mapRepositoryFailure);
    if (started.kind === "existing") {
      return reconcileCreation(
        context,
        dependencies,
        repository,
        client,
        started.operation,
      );
    }

    let created: CreatedSecondaryCalendar;
    try {
      created = await client.createSecondaryCalendar(
        dependencies.userTimeZone,
      );
    } catch (error) {
      if (
        error instanceof CalendarProviderError &&
        error.outcome === "definite_failure"
      ) {
        const snapshot = await repository
          .markCreationDefiniteFailure(
            input.data.idempotencyKey,
            dependencies.now(),
          )
          .catch(mapRepositoryFailure);
        logCalendarEventSafely(
          dependencies.logger,
          context.get("requestId"),
          "calendar.setup.create",
          "denied",
          "calendar_creation_rejected",
        );
        noStore(context);
        return context.json(toSetupResponse(snapshot), 409);
      }
      return reconcileCreation(
        context,
        dependencies,
        repository,
        client,
        started.operation,
      );
    }

    try {
      const verified = await client.getCalendar(created.id);
      const snapshot = await repository.completeCreation(
        input.data.idempotencyKey,
        withVerificationTime(verified, dependencies.now()),
        dependencies.now(),
      );
      logCalendarEventSafely(
        dependencies.logger,
        context.get("requestId"),
        "calendar.setup.create",
        "succeeded",
      );
      noStore(context);
      return context.json(toSetupResponse(snapshot));
    } catch {
      // A successful insert followed by verification/persistence uncertainty is always reconciled.
      return reconcileCreation(
        context,
        dependencies,
        repository,
        client,
        started.operation,
      );
    }
  });
}

/** Builds production setup dependencies from the same encrypted session/token authority as OAuth. */
export async function createProductionCalendarSetupDependencies(
  environment: Env,
  logger: SafeLogger,
): Promise<CalendarSetupRouteDependencies> {
  const auth = await createProductionAuthDependencies(environment, logger);
  const store = new DrizzleCalendarStore(createDb(environment.DATABASE_URL));
  return {
    logger,
    /** Reads wall-clock time separately at every external verification and persistence decision. */
    now: () => new Date(),
    userTimeZone: parseVisionUserTimeZone(environment.VISION_USER_TIME_ZONE),
    sessions: auth.sessions,
    tokens: auth.tokens,
    /** Creates the narrow account-bound provider adapter after token/session validation. */
    createCalendarClient: (accessToken, googleSubject) =>
      new CalendarClient(accessToken, googleSubject, fetch),
    /** Creates an owner- and subject-bound setup repository for the authenticated request. */
    createRepository: (ownerId, googleSubject) =>
      new CalendarRepository(store, ownerId, googleSubject),
  };
}

/** Re-lists after an uncertain response and resolves only one new owned stable ID. */
async function reconcileCreation(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependencies: CalendarSetupRouteDependencies,
  repository: CalendarRepositoryPort,
  client: CalendarClientPort,
  operation: CalendarCreationOperation,
) {
  if (operation.status === "completed") {
    const snapshot = await requireSetupSnapshot(repository);
    noStore(context);
    return context.json(toSetupResponse(snapshot));
  }
  if (operation.status === "action_required") {
    const snapshot = await requireSetupSnapshot(repository);
    noStore(context);
    return context.json(toSetupResponse(snapshot), 409);
  }
  const current = await client.listOwnedSecondaryCalendars().catch(() => {
    throw providerUnavailable();
  });
  const before = new Set(operation.preCreateCalendarIds);
  const newOwnedCalendars = current.filter(({ id }) => !before.has(id));
  if (newOwnedCalendars.length === 1) {
    const snapshot = await repository.completeCreation(
      operation.idempotencyKey,
      withVerificationTime(newOwnedCalendars[0]!, dependencies.now()),
      dependencies.now(),
    );
    logCalendarEventSafely(
      dependencies.logger,
      context.get("requestId"),
      "calendar.setup.reconcile",
      "succeeded",
    );
    noStore(context);
    return context.json(toSetupResponse(snapshot));
  }
  const actionRequired = newOwnedCalendars.length > 1;
  const snapshot = await repository.markCreationUncertain(
    operation.idempotencyKey,
    actionRequired ? "action_required" : "retryable",
    dependencies.now(),
  );
  logCalendarEventSafely(
    dependencies.logger,
    context.get("requestId"),
    "calendar.setup.reconcile",
    actionRequired ? "denied" : "failed",
    actionRequired ? "calendar_creation_ambiguous" : "calendar_creation_uncertain",
  );
  noStore(context);
  return context.json(
    {
      ...toSetupResponse(snapshot),
      retryable: !actionRequired,
    },
    actionRequired ? 409 : 202,
  );
}

/** Resolves and validates one active server session without exposing its bearer. */
async function authenticateSetupRequest(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependencies: CalendarSetupRouteDependencies,
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

/** Requires the exact decrypted session CSRF value before a state-changing setup request. */
async function requireCsrf(
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

/** Resolves a current retained access token and creates the account-bound Calendar adapter. */
async function resolveCalendarClient(
  dependencies: CalendarSetupRouteDependencies,
  session: AuthenticatedSession,
): Promise<CalendarClientPort> {
  const now = dependencies.now();
  const tokens = await dependencies.tokens.getGoogleTokens(
    session.googleSubject,
  );
  if (
    !tokens?.accessToken ||
    tokens.accessExpiresAt.getTime() <= now.getTime()
  ) {
    throw providerUnavailable();
  }
  return dependencies.createCalendarClient(
    tokens.accessToken,
    session.googleSubject,
  );
}

/** Resolves production or injected dependencies through one generic safe availability error. */
async function resolveSetupDependencies(
  resolver: CalendarSetupDependencyResolver,
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
): Promise<CalendarSetupRouteDependencies> {
  return Promise.resolve(resolver(context.env)).catch(() => {
    throw providerUnavailable();
  });
}

/** Parses one strict small JSON request without retaining attacker-controlled parser errors. */
async function readSetupJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:;|$)/iu.test(contentType)) {
    throw invalidSetupRequest();
  }
  const text = await request.text();
  if (
    new TextEncoder().encode(text).byteLength > MAX_SETUP_REQUEST_BODY_BYTES
  ) {
    throw invalidSetupRequest();
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw invalidSetupRequest();
  }
}

/** Adds a server verification timestamp to account-bound adapter evidence. */
function withVerificationTime(
  calendar: OwnedSecondaryCalendar,
  verifiedAt: Date,
): VerifiedCalendarEvidence {
  return Object.freeze({ ...calendar, verifiedAt: new Date(verifiedAt) });
}

/** Snapshots a bounded provider candidate array and applies one server verification time. */
function bindVerificationTime(
  calendars: readonly OwnedSecondaryCalendar[],
  verifiedAt: Date,
): readonly VerifiedCalendarEvidence[] {
  if (!Array.isArray(calendars) || calendars.length > 100) {
    throw providerUnavailable();
  }
  return Object.freeze(
    calendars.map((calendar) => withVerificationTime(calendar, verifiedAt)),
  );
}

/** Converts internal account evidence into the stable client setup response. */
function toSetupResponse(snapshot: CalendarSetupSnapshot) {
  return {
    setupVersion: snapshot.setupVersion,
    status: snapshot.status,
    actionRequired: snapshot.actionRequired,
    candidates: snapshot.candidates.map((calendar) => ({
      calendarId: calendar.id,
      summary: calendar.summary,
      timeZone: calendar.timeZone,
      providerEtag: calendar.providerEtag,
    })),
    ...(snapshot.connection
      ? {
          connection: {
            calendarId: snapshot.connection.calendarId,
            connectionKind: snapshot.connection.connectionKind,
            timeZone: snapshot.connection.timeZone,
            providerEtag: snapshot.connection.providerEtag,
            verifiedAt: snapshot.connection.verifiedAt.toISOString(),
          },
        }
      : {}),
  };
}

/** Requires the persisted state used for an idempotent response. */
async function requireSetupSnapshot(
  repository: CalendarRepositoryPort,
): Promise<CalendarSetupSnapshot> {
  const snapshot = await repository.getSnapshot();
  if (!snapshot) throw providerUnavailable();
  return snapshot;
}

/** Maps exact CAS conflicts while collapsing every other repository detail. */
function mapRepositoryFailure(error: unknown): never {
  if (
    error instanceof CalendarRepositoryError &&
    error.code === "STALE_SETUP_VERSION"
  ) {
    throwVisionError(
      new VisionError(
        "STALE_SETUP_VERSION",
        409,
        "Calendar setup changed. Refresh and try again.",
      ),
    );
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "STALE_SETUP_VERSION"
  ) {
    throwVisionError(
      new VisionError(
        "STALE_SETUP_VERSION",
        409,
        "Calendar setup changed. Refresh and try again.",
      ),
    );
  }
  throw providerUnavailable();
}

/** Emits one fixed-shape calendar setup audit event without IDs, tokens, or provider bodies. */
function logCalendarEventSafely(
  logger: SafeLogger,
  requestId: string,
  action: string,
  outcome: "succeeded" | "failed" | "denied",
  errorCategory?:
    | "calendar_creation_ambiguous"
    | "calendar_creation_uncertain"
    | "calendar_creation_rejected",
): void {
  try {
    logEvent(logger, {
      requestId,
      action,
      outcome,
      provider: "google",
      ...(errorCategory ? { errorCategory } : {}),
    });
  } catch {
    // Setup safety must never depend on the availability of the operational audit sink.
  }
}

/** Applies a no-store policy to every setup state response. */
function noStore(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
): void {
  context.header("Cache-Control", "no-store");
}

/** Creates the constant strict-input failure. */
function invalidSetupRequest(): never {
  throwVisionError(
    new VisionError(
      "INVALID_SETUP_REQUEST",
      400,
      "Calendar setup request is invalid.",
    ),
  );
}

/** Creates the constant provider/storage availability failure. */
function providerUnavailable(): never {
  throwVisionError(
    new VisionError(
      "CALENDAR_SETUP_UNAVAILABLE",
      503,
      "Calendar setup is temporarily unavailable.",
    ),
  );
}

/** Returns the read-only virtual state before the first atomic discovery write. */
function initialSetupSnapshot(): CalendarSetupSnapshot {
  return Object.freeze({
    setupVersion: 1,
    status: "authenticated",
    actionRequired: false,
    candidates: Object.freeze([]),
  });
}

/** Registers the authenticated preview, confirmation, status, and undo surface for one-off writes. */
import type { Context, Hono } from "hono";
import { z } from "zod";
import { createWrappedKeyProvider } from "../../crypto/key-provider";
import { createDb } from "../../data/db";
import {
  CalendarRepository,
  DrizzleCalendarStore,
  type CalendarRepositoryPort,
} from "../../data/repositories/calendar-repository";
import {
  DrizzleCalendarWriteRepository,
  type CalendarWriteApprovalStore,
} from "../../data/repositories/calendar-write-repository";
import type { EncryptedSessionRepository } from "../../data/repositories/session-repository";
import {
  DrizzleWrappedDataKeyStore,
  type TokenRepositoryPort,
} from "../../data/repositories/token-repository";
import { createAuditWriter } from "../../audit/audit-writer";
import {
  executeConfirmedCalendarCreate,
  undoVerifiedCalendarCreate,
  type CalendarWriteAudit,
  type CalendarWriteExecutionResult,
  type CalendarWriteLedger,
  type CalendarWriteProvider,
} from "../../domain/calendar-write/create-execution";
import {
  CalendarWriteContractError,
  createCalendarWriteProposal,
  transitionCalendarWrite,
  type CalendarWriteProposal,
} from "../../domain/calendar-write/approval";
import { createGoogleEventWriteClient } from "../../integrations/google-calendar/event-write-client";
import { createProductionAuthDependencies } from "../auth/oauth-routes";
import { verifyCsrfToken } from "../auth/csrf";
import {
  readSessionCookie,
  requireSession,
  type AuthRequestVariables,
  type AuthenticatedSession,
} from "../auth/session";
import {
  parseVisionKeyEncryptionKey,
  type Env,
} from "../env";
import { throwVisionError, VisionError } from "../errors";
import { type SafeLogger } from "../logging";

const APPROVAL_LIFETIME_MS = 10 * 60 * 1_000;
const MAX_REQUEST_BODY_BYTES = 16 * 1_024;
const operationIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const previewInputSchema = z
  .object({
    title: z.string().min(1).max(1_024),
    description: z.string().max(8_192).nullable(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    timeZone: z.string().min(1).max(255),
    domain: z.enum(["school", "work", "personal"]),
    privacy: z.enum(["planning", "private", "restricted"]),
    attendees: z.array(z.string().min(1).max(320)).length(0),
    recurrence: z.null(),
    notifications: z.literal("none"),
  })
  .strict()
  .superRefine((input, refinement) => {
    if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      refinement.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "The event end must be after its start.",
      });
    }
  });
const confirmationSchema = z
  .object({ confirmation: z.literal("CONFIRM ONE-OFF EVENT") })
  .strict();
const undoSchema = z
  .object({ confirmation: z.literal("UNDO ONE-OFF EVENT") })
  .strict();

/** Injected owner/session/provider/persistence boundaries used by the route tests and Worker. */
export interface CalendarWriteRouteDependencies {
  readonly logger: SafeLogger;
  readonly now: () => Date;
  readonly createOperationId: () => string;
  readonly sessions: Pick<EncryptedSessionRepository, "findSession">;
  readonly tokens: Pick<TokenRepositoryPort, "getGoogleTokens">;
  readonly createCalendarRepository: (
    ownerId: string,
    googleSubject: string,
  ) => Pick<CalendarRepositoryPort, "getSnapshot">;
  readonly createProvider: (
    accessToken: string,
    googleSubject: string,
  ) => CalendarWriteProvider;
  readonly approvals: CalendarWriteApprovalStore;
  readonly ledger: CalendarWriteLedger;
  readonly audit: CalendarWriteAudit;
}

/** Resolves Phase C route dependencies from Worker bindings or deterministic tests. */
export type CalendarWriteDependencyResolver = (
  environment: Env,
) =>
  | CalendarWriteRouteDependencies
  | Promise<CalendarWriteRouteDependencies>;

/** Registers the four authenticated routes before the Worker's generic API fallback. */
export function registerCalendarWriteRoutes(
  app: Hono<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependenciesOrResolver:
    | CalendarWriteRouteDependencies
    | CalendarWriteDependencyResolver,
): void {
  const resolveDependencies: CalendarWriteDependencyResolver =
    typeof dependenciesOrResolver === "function"
      ? dependenciesOrResolver
      : () => dependenciesOrResolver;

  app.post("/api/calendar/writes/preview", async (context) => {
    noStore(context);
    const dependencies = await resolveRouteDependencies(
      resolveDependencies,
      context,
    );
    const session = await authenticateRequest(context, dependencies);
    await requireCsrf(context, session);
    const input = previewInputSchema.safeParse(
      await readBoundedJson(context.req.raw),
    );
    if (!input.success) throw invalidCalendarWriteRequest();

    const connection = await resolveConnectedCalendar(dependencies, session);
    const provider = await resolveProvider(dependencies, session);
    const providerTarget = await provider
      .readCalendarVersion(connection.calendarId)
      .catch(() => {
        throw calendarWriteUnavailable();
      });
    if (
      providerTarget.calendarId !== connection.calendarId ||
      !isBoundedIdentity(providerTarget.version, 1_024)
    ) {
      throw calendarWriteUnavailable();
    }

    let proposal: CalendarWriteProposal;
    try {
      proposal = createCalendarWriteProposal({
        operationId: readOperationId(dependencies.createOperationId()),
        ownerId: session.ownerId,
        target: providerTarget,
        requestedAt: dependencies.now().toISOString(),
        event: input.data,
      });
    } catch (error) {
      if (error instanceof CalendarWriteContractError) {
        throw invalidCalendarWriteRequest();
      }
      throw calendarWriteUnavailable();
    }

    const requestedAt = readDate(dependencies.now());
    const expiresAt = new Date(requestedAt.getTime() + APPROVAL_LIFETIME_MS);
    await dependencies.approvals
      .createApproval({ proposal, requestedAt, expiresAt })
      .catch(() => {
        throw calendarWriteUnavailable();
      });

    return context.json({
      operationId: proposal.operationId,
      expiresAt: expiresAt.toISOString(),
      preview: proposal.preview,
      undoAvailable: false,
    });
  });

  app.get("/api/calendar/writes/:operationId", async (context) => {
    noStore(context);
    const dependencies = await resolveRouteDependencies(
      resolveDependencies,
      context,
    );
    const session = await authenticateRequest(context, dependencies);
    const operationId = readOperationId(context.req.param("operationId"));

    let approval;
    let execution;
    let proposal: CalendarWriteProposal | undefined;
    try {
      approval = await dependencies.approvals.findApproval(
        session.ownerId,
        operationId,
      );
      execution = await dependencies.ledger.find(
        session.ownerId,
        operationId,
      );
      if (approval && approval.status !== "invalidated") {
        proposal = await dependencies.approvals.loadProposal(
          session.ownerId,
          operationId,
        );
      }
    } catch {
      throw calendarWriteUnavailable();
    }

    if (!approval && !execution) throw calendarWriteNotFound();
    const expired =
      !execution &&
      approval !== undefined &&
      approval.expiresAt.getTime() <= readDate(dependencies.now()).getTime();
    const projectedStatus = execution?.status ?? (expired ? "invalidated" : approval!.status);
    return context.json({
      operationId,
      status: projectedStatus,
      ...(approval ? { expiresAt: approval.expiresAt.toISOString() } : {}),
      ...(proposal ? { preview: proposal.preview } : {}),
      undoAvailable:
        execution?.status === "verified" &&
        execution.eventId !== undefined &&
        execution.eventVersion !== undefined,
    });
  });

  app.post("/api/calendar/writes/:operationId/confirm", async (context) => {
    noStore(context);
    const dependencies = await resolveRouteDependencies(
      resolveDependencies,
      context,
    );
    const session = await authenticateRequest(context, dependencies);
    await requireCsrf(context, session);
    const operationId = readOperationId(context.req.param("operationId"));
    const input = confirmationSchema.safeParse(
      await readBoundedJson(context.req.raw),
    );
    if (!input.success) throw invalidCalendarWriteRequest();

    let confirmation:
      | "confirmed"
      | "already_confirmed"
      | "expired"
      | "missing";
    try {
      confirmation = await dependencies.approvals.confirmApproval(
        session.ownerId,
        operationId,
        readDate(dependencies.now()),
      );
    } catch {
      throw calendarWriteUnavailable();
    }
    if (confirmation === "missing" || confirmation === "expired") {
      throw calendarWriteConflict();
    }

    let proposal: CalendarWriteProposal | undefined;
    try {
      proposal = await dependencies.approvals.loadProposal(
        session.ownerId,
        operationId,
      );
    } catch {
      throw calendarWriteUnavailable();
    }
    if (!proposal) throw calendarWriteConflict();

    let confirmed: CalendarWriteProposal;
    try {
      confirmed = transitionCalendarWrite(proposal, {
        kind: "approve",
        target: proposal.target,
      });
    } catch {
      throw calendarWriteConflict();
    }
    if (confirmed.status !== "confirmed") {
      await dependencies.approvals
        .invalidateApproval(
          session.ownerId,
          operationId,
          readDate(dependencies.now()),
        )
        .catch(() => undefined);
      throw calendarWriteConflict();
    }

    const connection = await resolveConnectedCalendar(dependencies, session);
    if (connection.calendarId !== confirmed.target.calendarId) {
      await dependencies.approvals
        .invalidateApproval(
          session.ownerId,
          operationId,
          readDate(dependencies.now()),
        )
        .catch(() => undefined);
      return context.json(
        writeResponse(confirmed, "invalidated", false),
        409,
      );
    }
    const provider = await resolveProvider(dependencies, session);

    let result: CalendarWriteExecutionResult;
    try {
      result = await executeConfirmedCalendarCreate(confirmed, {
        provider,
        ledger: dependencies.ledger,
        audit: dependencies.audit,
        /** Supplies the route's validated current time to the executor. */
        now: () => readDate(dependencies.now()).toISOString(),
      });
    } catch {
      throw calendarWriteUnavailable();
    }
    if (result.status === "invalidated") {
      await dependencies.approvals
        .invalidateApproval(
          session.ownerId,
          operationId,
          readDate(dependencies.now()),
        )
        .catch(() => undefined);
    }
    return context.json(
      writeResponse(
        result.proposal,
        result.status,
        result.status === "verified",
      ),
      result.status === "verified"
        ? 200
        : result.status === "verification_pending"
          ? 202
          : 409,
    );
  });

  app.post("/api/calendar/writes/:operationId/undo", async (context) => {
    noStore(context);
    const dependencies = await resolveRouteDependencies(
      resolveDependencies,
      context,
    );
    const session = await authenticateRequest(context, dependencies);
    await requireCsrf(context, session);
    const operationId = readOperationId(context.req.param("operationId"));
    const input = undoSchema.safeParse(await readBoundedJson(context.req.raw));
    if (!input.success) throw invalidCalendarWriteRequest();

    await resolveConnectedCalendar(dependencies, session);
    const provider = await resolveProvider(dependencies, session);
    let result;
    try {
      result = await undoVerifiedCalendarCreate(
        { ownerId: session.ownerId, operationId },
        {
          provider,
          ledger: dependencies.ledger,
          audit: dependencies.audit,
          /** Supplies the route's validated current time to the executor. */
          now: () => readDate(dependencies.now()).toISOString(),
        },
      );
    } catch {
      throw calendarWriteUnavailable();
    }
    return context.json(
      {
        operationId,
        status: result.status,
        undoAvailable: false,
      },
      result.status === "undone"
        ? 200
        : result.status === "verification_pending"
          ? 202
          : 409,
    );
  });
}

/** Builds the production database, key, provider, and audit boundaries for Phase C. */
export async function createProductionCalendarWriteDependencies(
  environment: Env,
  logger: SafeLogger,
): Promise<CalendarWriteRouteDependencies> {
  const auth = await createProductionAuthDependencies(environment, logger);
  const database = createDb(environment.DATABASE_URL);
  const keyProvider = await createWrappedKeyProvider(
    parseVisionKeyEncryptionKey(environment.KEY_ENCRYPTION_KEY),
    new DrizzleWrappedDataKeyStore(database),
    1,
  );
  const calendarStore = new DrizzleCalendarStore(database);
  const writeRepository = new DrizzleCalendarWriteRepository(
    database,
    keyProvider,
  );
  return {
    logger,
    /** Supplies a fresh server timestamp for previews and state transitions. */
    now: () => new Date(),
    /** Generates the only operation authority exposed to the browser. */
    createOperationId: () => crypto.randomUUID(),
    sessions: auth.sessions,
    tokens: auth.tokens,
    /** Rebinds calendar reads to the authenticated owner and Google subject. */
    createCalendarRepository: (ownerId, googleSubject) =>
      new CalendarRepository(calendarStore, ownerId, googleSubject),
    /** Creates the bounded provider adapter only after token validation. */
    createProvider: (accessToken) =>
      createGoogleEventWriteClient({
        accessToken,
        fetcher: fetch.bind(globalThis),
      }),
    approvals: writeRepository,
    ledger: writeRepository,
    audit: createAuditWriter(database),
  };
}

/** Authenticates the opaque session cookie before body parsing or token lookup. */
async function authenticateRequest(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependencies: CalendarWriteRouteDependencies,
): Promise<AuthenticatedSession> {
  const sessionId = readSessionCookie(context.req.raw);
  const persisted = sessionId
    ? await dependencies.sessions.findSession(
        sessionId,
        readDate(dependencies.now()),
      )
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

/** Enforces the existing constant-time CSRF contract for state-changing routes. */
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

/** Resolves the authenticated owner's already-connected Vision calendar. */
async function resolveConnectedCalendar(
  dependencies: CalendarWriteRouteDependencies,
  session: AuthenticatedSession,
) {
  let snapshot;
  try {
    snapshot = await dependencies
      .createCalendarRepository(session.ownerId, session.googleSubject)
      .getSnapshot();
  } catch {
    throw calendarWriteUnavailable();
  }
  if (
    !snapshot ||
    snapshot.status !== "connected" ||
    !snapshot.connection ||
    !isBoundedIdentity(snapshot.connection.calendarId, 2_048) ||
    !isBoundedIdentity(snapshot.connection.providerEtag, 1_024)
  ) {
    throw calendarWriteUnavailable();
  }
  return snapshot.connection;
}

/** Resolves a non-expired Google token and constructs the bounded write adapter. */
async function resolveProvider(
  dependencies: CalendarWriteRouteDependencies,
  session: AuthenticatedSession,
): Promise<CalendarWriteProvider> {
  let tokens;
  try {
    tokens = await dependencies.tokens.getGoogleTokens(session.googleSubject);
  } catch {
    throw calendarWriteUnavailable();
  }
  const now = readDate(dependencies.now());
  if (
    !tokens ||
    typeof tokens.accessToken !== "string" ||
    tokens.accessToken.length === 0 ||
    !(tokens.accessExpiresAt instanceof Date) ||
    tokens.accessExpiresAt.getTime() <= now.getTime()
  ) {
    throw calendarWriteUnavailable();
  }
  try {
    return dependencies.createProvider(tokens.accessToken, session.googleSubject);
  } catch {
    throw calendarWriteUnavailable();
  }
}

/** Resolves injected or production dependencies without exposing resolver failures. */
async function resolveRouteDependencies(
  resolver: CalendarWriteDependencyResolver,
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
): Promise<CalendarWriteRouteDependencies> {
  return Promise.resolve(resolver(context.env)).catch(() => {
    throw calendarWriteUnavailable();
  });
}

/** Reads a bounded UTF-8 JSON body after authentication and content-type checks. */
async function readBoundedJson(request: Request): Promise<unknown> {
  if (!/^application\/json(?:;|$)/iu.test(request.headers.get("content-type") ?? "")) {
    throw invalidCalendarWriteRequest();
  }
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^(?:0|[1-9]\d*)$/u.test(declaredLength) ||
      Number(declaredLength) > MAX_REQUEST_BODY_BYTES)
  ) {
    throw invalidCalendarWriteRequest();
  }
  if (request.body === null) throw invalidCalendarWriteRequest();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        throw invalidCalendarWriteRequest();
      }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as unknown;
  } catch (error) {
    if (error instanceof VisionError) throw error;
    throw invalidCalendarWriteRequest();
  }
}

/** Validates one opaque operation ID from a route parameter. */
function readOperationId(value: unknown): string {
  const parsed = operationIdSchema.safeParse(value);
  if (!parsed.success) throw invalidCalendarWriteRequest();
  return parsed.data;
}

/** Copies one valid injected timestamp before it participates in a transition. */
function readDate(value: unknown): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw calendarWriteUnavailable();
  }
  return new Date(value.getTime());
}

/** Accepts bounded opaque identities without allowing control characters. */
function isBoundedIdentity(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\u0000-\u001F\u007F]/u.test(value)
  );
}

/** Projects a proposal and executor status into the safe public response shape. */
function writeResponse(
  proposal: CalendarWriteProposal,
  status: CalendarWriteExecutionResult["status"],
  undoAvailable: boolean,
) {
  return {
    operationId: proposal.operationId,
    status,
    preview: proposal.preview,
    undoAvailable,
  };
}

/** Prevents browser and intermediary caches from retaining write state. */
function noStore(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
): void {
  context.header("Cache-Control", "no-store");
}

/** Raises the constant public error for malformed or unsupported write input. */
function invalidCalendarWriteRequest(): never {
  throwVisionError(
    new VisionError(
      "INVALID_CALENDAR_WRITE_REQUEST",
      400,
      "Calendar write request is invalid.",
    ),
  );
}

/** Raises the owner-scoped not-found response without revealing another owner. */
function calendarWriteNotFound(): never {
  throwVisionError(
    new VisionError(
      "CALENDAR_WRITE_NOT_FOUND",
      404,
      "Calendar write operation was not found.",
    ),
  );
}

/** Raises the safe conflict response for stale or non-continuable operations. */
function calendarWriteConflict(): never {
  throwVisionError(
    new VisionError(
      "CALENDAR_WRITE_CONFLICT",
      409,
      "Calendar write operation cannot continue.",
    ),
  );
}

/** Raises the safe availability response for persistence or provider boundaries. */
function calendarWriteUnavailable(): never {
  throwVisionError(
    new VisionError(
      "CALENDAR_WRITE_UNAVAILABLE",
      503,
      "Calendar write is temporarily unavailable.",
    ),
  );
}

/** Registers authenticated deterministic planning, briefing, and local follow-up routes. */
import type { Context, Hono } from "hono";
import { z } from "zod";
import {
  buildBriefing,
  type BriefingWindow,
} from "../../domain/briefings/briefing";
import {
  createFollowUp,
  FollowUpTransitionError,
  FollowUpValidationError,
} from "../../domain/follow-ups/follow-up";
import {
  createSchedulingProposal,
  SchedulingProposalError,
  type PlanningSourceSnapshot,
} from "../../domain/scheduling/proposal";
import type { PlanningRepositoryPort as SecretaryPlanningRepositoryPort } from "../../data/repositories/secretary-repository";
import type { EncryptedSessionRepository } from "../../data/repositories/session-repository";
import { createProductionSecretaryDependencies } from "./secretary-routes";
import { verifyCsrfToken } from "../auth/csrf";
import {
  readSessionCookie,
  requireSession,
  type AuthRequestVariables,
  type AuthenticatedSession,
} from "../auth/session";
import type { Env } from "../env";
import { throwVisionError, VisionError } from "../errors";
import type { SafeLogger } from "../logging";

const MAX_BODY_BYTES = 32 * 1_024;
const identifier = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const timestamp = z.string().datetime({ offset: true });
const proposalSchema = z.object({
  title: z.string().trim().min(1).max(512),
  durationMinutes: z.number().int().min(15).max(12 * 60),
  preferredStartAt: timestamp.nullable().optional(),
  window: z.object({
    startsAt: timestamp,
    endsAt: timestamp,
    timeZone: z.string().min(1).max(255),
  }).strict(),
  ambiguity: z.array(z.string().min(1).max(128)).max(16),
}).strict();
const followUpSchema = z.object({
  title: z.string().trim().min(1).max(1_024),
  dueAt: timestamp.nullable(),
  timeZone: z.string().min(1).max(255),
  sourceFactIds: z.array(identifier).max(32),
}).strict();
const transitionSchema = z.object({ snoozedUntil: timestamp.optional() }).strict();

/** Supplies owner-scoped source and local follow-up persistence boundaries. */
export type PlanningRepositoryPort = SecretaryPlanningRepositoryPort;

/** Supplies replaceable authentication, source, and persistence boundaries for Worker tests and production. */
export interface PlanningRouteDependencies {
  readonly now: () => Date;
  readonly sessions: Pick<EncryptedSessionRepository, "findSession">;
  readonly repositoryForOwner: (ownerId: string) => PlanningRepositoryPort;
  readonly createId?: () => string;
}

/** Resolves planning dependencies from Worker bindings or deterministic tests. */
export type PlanningDependencyResolver = (
  environment: Env,
) => PlanningRouteDependencies | Promise<PlanningRouteDependencies>;

/** Registers read-only proposals/briefings and owner-scoped local follow-up transitions. */
export function registerPlanningRoutes(
  app: Hono<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependenciesOrResolver: PlanningRouteDependencies | PlanningDependencyResolver,
): void {
  const resolveDependencies: PlanningDependencyResolver = typeof dependenciesOrResolver === "function"
    ? dependenciesOrResolver
    : () => dependenciesOrResolver;

  app.get("/api/planning/briefing", async (context) => {
    const dependencies = await resolvePlanningDependencies(resolveDependencies, context);
    const session = await authenticatePlanningRequest(context, dependencies);
    const timeZone = readTimeZone(context.req.query("timeZone"));
    const kind = readBriefingKind(context.req.query("window"));
    const now = readDate(dependencies.now());
    try {
      const source = await dependencies.repositoryForOwner(session.ownerId).readPlanning(session.ownerId, now, timeZone);
      const window = createBriefingWindow(now, timeZone, kind);
      const briefing = buildBriefing({
        briefingId: `briefing:${localDateKey(now, timeZone)}:${kind}`,
        window,
        events: source.events,
        tasks: source.tasks,
        followUps: source.followUps,
        sourceFacts: source.sourceFacts,
      });
      context.header("Cache-Control", "no-store");
      return context.json({ briefing });
    } catch (error) {
      if (error instanceof VisionError) throw error;
      throw planningUnavailable();
    }
  });

  app.post("/api/planning/proposals", async (context) => {
    const dependencies = await resolvePlanningDependencies(resolveDependencies, context);
    const session = await authenticatePlanningRequest(context, dependencies);
    await requirePlanningCsrf(context, session);
    const input = proposalSchema.safeParse(await readBoundedJson(context.req.raw));
    if (!input.success) throw planningInvalid();
    try {
      const now = readDate(dependencies.now());
      const source = await dependencies.repositoryForOwner(session.ownerId).readPlanning(session.ownerId, now, input.data.window.timeZone);
      const proposal = createSchedulingProposal({
        ...input.data,
        proposalId: createId(dependencies),
        busyBlocks: source.events,
        sourceFacts: source.sourceFacts,
        aiRequested: false,
      });
      context.header("Cache-Control", "no-store");
      return context.json({ proposal });
    } catch (error) {
      if (error instanceof SchedulingProposalError) throw planningInvalid();
      if (error instanceof VisionError) throw error;
      throw planningUnavailable();
    }
  });

  app.get("/api/planning/follow-ups", async (context) => {
    const dependencies = await resolvePlanningDependencies(resolveDependencies, context);
    const session = await authenticatePlanningRequest(context, dependencies);
    const timeZone = readTimeZone(context.req.query("timeZone"));
    try {
      const source = await dependencies.repositoryForOwner(session.ownerId).readPlanning(
        session.ownerId,
        readDate(dependencies.now()),
        timeZone,
      );
      context.header("Cache-Control", "no-store");
      return context.json({ followUps: source.followUps });
    } catch (error) {
      if (error instanceof VisionError) throw error;
      throw planningUnavailable();
    }
  });

  app.post("/api/planning/follow-ups", async (context) => {
    const dependencies = await resolvePlanningDependencies(resolveDependencies, context);
    const session = await authenticatePlanningRequest(context, dependencies);
    await requirePlanningCsrf(context, session);
    const input = followUpSchema.safeParse(await readBoundedJson(context.req.raw));
    if (!input.success) throw planningInvalid();
    try {
      const repository = dependencies.repositoryForOwner(session.ownerId);
      const source = await repository.readPlanning(session.ownerId, readDate(dependencies.now()), input.data.timeZone);
      const knownFacts = new Set(source.sourceFacts.map((fact) => fact.id));
      if (input.data.sourceFactIds.some((id) => !knownFacts.has(id))) throw planningInvalid();
      const followUp = createFollowUp({
        id: createId(dependencies),
        ...input.data,
        createdAt: readDate(dependencies.now()),
      });
      const stored = await repository.createFollowUp(session.ownerId, followUp);
      return context.json({ followUp: stored }, 201);
    } catch (error) {
      if (error instanceof FollowUpValidationError) throw planningInvalid();
      if (error instanceof VisionError) throw error;
      throw planningUnavailable();
    }
  });

  app.post("/api/planning/follow-ups/:followUpId/:action", async (context) => {
    const dependencies = await resolvePlanningDependencies(resolveDependencies, context);
    const session = await authenticatePlanningRequest(context, dependencies);
    await requirePlanningCsrf(context, session);
    const followUpId = identifier.safeParse(context.req.param("followUpId"));
    const action = z.enum(["complete", "reopen", "snooze"]).safeParse(context.req.param("action"));
    if (!followUpId.success || !action.success) throw planningInvalid();
    const body = transitionSchema.safeParse(await readBoundedJson(context.req.raw));
    if (!body.success || (action.data === "snooze" && !body.data.snoozedUntil)) throw planningInvalid();
    try {
      const followUp = await dependencies.repositoryForOwner(session.ownerId).transitionFollowUp(
        session.ownerId,
        followUpId.data,
        action.data,
        readDate(dependencies.now()),
        body.data.snoozedUntil,
      );
      if (!followUp) throw planningConflict();
      return context.json({ followUp });
    } catch (error) {
      if (error instanceof FollowUpTransitionError) throw planningConflict();
      if (error instanceof VisionError) throw error;
      throw planningUnavailable();
    }
  });
}

/** Creates the production planning boundary over the already-authenticated secretary store. */
export async function createProductionPlanningDependencies(
  environment: Env,
  logger: SafeLogger,
): Promise<PlanningRouteDependencies> {
  const secretary = await createProductionSecretaryDependencies(environment, logger);
  return {
    now: secretary.now,
    sessions: secretary.sessions,
    repositoryForOwner: secretary.repositoryForOwner,
  };
}

/** Resolves injected planning dependencies while preserving one safe availability error. */
async function resolvePlanningDependencies(
  resolver: PlanningDependencyResolver,
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
): Promise<PlanningRouteDependencies> {
  try {
    return await resolver(context.env);
  } catch {
    throw planningUnavailable();
  }
}

/** Authenticates the opaque Vision session before reading planning facts or request bodies. */
async function authenticatePlanningRequest(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependencies: PlanningRouteDependencies,
): Promise<AuthenticatedSession> {
  const sessionId = readSessionCookie(context.req.raw);
  const persisted = sessionId ? await dependencies.sessions.findSession(sessionId, readDate(dependencies.now())) : undefined;
  if (!sessionId || !persisted) {
    throwVisionError(new VisionError("AUTHENTICATION_REQUIRED", 401, "Authentication is required."));
  }
  context.set("authenticatedSession", { ...persisted, sessionId });
  return requireSession(context);
}

/** Requires the authenticated session CSRF token for local proposal/follow-up writes. */
async function requirePlanningCsrf(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  session: AuthenticatedSession,
): Promise<void> {
  if (!(await verifyCsrfToken(context.req.header("x-vision-csrf") ?? null, session.csrfToken))) {
    throwVisionError(new VisionError("CSRF_VALIDATION_FAILED", 403, "Request could not be verified."));
  }
}

/** Reads a bounded JSON request body with strict content type and UTF-8 checks. */
async function readBoundedJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const length = request.headers.get("content-length");
  if (contentType !== "application/json" || (length && (!/^\d+$/u.test(length) || Number(length) > MAX_BODY_BYTES))) throw planningInvalid();
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) throw planningInvalid();
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown; } catch { throw planningInvalid(); }
}

/** Copies one finite server Date before it crosses the planning domain boundary. */
function readDate(value: Date): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw planningUnavailable();
  return new Date(value.getTime());
}

/** Accepts only a valid explicit IANA timezone query value. */
function readTimeZone(value: string | undefined): string {
  const zone = value ?? "UTC";
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(); } catch { throw planningInvalid(); }
  return zone;
}

/** Restricts briefing selection to the four template window kinds. */
function readBriefingKind(value: string | undefined): BriefingWindow["kind"] {
  const kind = value ?? "morning";
  if (kind !== "morning" && kind !== "afternoon" && kind !== "evening" && kind !== "custom") throw planningInvalid();
  return kind;
}

/** Converts a template window kind into exact UTC bounds for the requested local date. */
function createBriefingWindow(now: Date, zone: string, kind: BriefingWindow["kind"]): BriefingWindow {
  const dateKey = localDateKey(now, zone);
  const hours = kind === "morning" ? [5, 12] : kind === "afternoon" ? [12, 17] : kind === "evening" ? [17, 24] : [0, 24];
  const startsAt = kind === "custom" ? now : localBoundary(dateKey, hours[0], zone);
  const endsAt = kind === "custom" ? new Date(now.getTime() + 8 * 60 * 60_000) : localBoundary(dateKey, hours[1], zone);
  return { kind, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), timeZone: zone };
}

/** Produces a stable local date key without using the Worker process timezone. */
function localDateKey(value: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  /** Reads one date component from the explicit timezone formatter. */
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Converts a local clock boundary into an instant while accounting for DST offsets. */
function localBoundary(dateKey: string, hour: number, zone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const desiredDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  if (hour === 24) desiredDate.setUTCDate(desiredDate.getUTCDate() + 1);
  const desired = desiredDate.getTime() + (hour === 24 ? 0 : hour * 60 * 60_000);
  let guess = desired;
  for (let index = 0; index < 3; index += 1) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
    /** Reads one local boundary component during the DST-safe conversion loop. */
    const get = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? NaN);
    const actual = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    guess += desired - actual;
  }
  return new Date(guess);
}

/** Generates the opaque planning or follow-up identity accepted by route contracts. */
function createId(dependencies: PlanningRouteDependencies): string {
  const id = dependencies.createId?.() ?? crypto.randomUUID();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(id)) throw planningUnavailable();
  return id;
}

/** Raises the constant malformed-planning-request error. */
function planningInvalid(): never {
  throwVisionError(new VisionError("INVALID_PLANNING_REQUEST", 400, "Planning request is invalid."));
}

/** Raises the owner-scoped follow-up transition conflict. */
function planningConflict(): never {
  throwVisionError(new VisionError("PLANNING_CONFLICT", 409, "Planning item cannot transition."));
}

/** Raises the safe planning availability error without SQL or provider details. */
function planningUnavailable(): never {
  throwVisionError(new VisionError("PLANNING_UNAVAILABLE", 503, "Planning is temporarily unavailable."));
}

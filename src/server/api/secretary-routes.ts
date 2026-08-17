/** Registers authenticated local capture, Today, task, and note routes without calendar authority. */
import type { Context, Hono } from "hono";
import { z } from "zod";
import { createWrappedKeyProvider } from "../../crypto/key-provider";
import { createDb } from "../../data/db";
import {
  DrizzleSecretaryRepository,
  type SecretaryRepository,
} from "../../data/repositories/secretary-repository";
import type { EncryptedSessionRepository } from "../../data/repositories/session-repository";
import { DrizzleWrappedDataKeyStore } from "../../data/repositories/token-repository";
import { createSecretaryCapture } from "../../domain/secretary/capture";
import { createSecretaryNote } from "../../domain/secretary/note";
import { createSecretaryTask } from "../../domain/secretary/task";
import { buildTodayProjection } from "../../domain/secretary/today";
import { verifyCsrfToken } from "../auth/csrf";
import { createProductionAuthDependencies } from "../auth/oauth-routes";
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
import type { SafeLogger } from "../logging";

const MAX_BODY_BYTES = 20 * 1_024;
const idSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u);
const captureSchema = z.object({ content: z.string().min(1).max(8_192) }).strict();
const taskSchema = z.object({
  title: z.string().min(1).max(1_024),
  dueAt: z.string().datetime({ offset: true }).nullable(),
  timeZone: z.string().min(1).max(255),
}).strict();
const noteSchema = z.object({
  title: z.string().min(1).max(512),
  body: z.string().min(1).max(16 * 1_024),
}).strict();

/** Supplies replaceable session and owner-scoped repository boundaries for route tests and production. */
export interface SecretaryRouteDependencies {
  readonly now: () => Date;
  readonly sessions: Pick<EncryptedSessionRepository, "findSession">;
  readonly repositoryForOwner: (ownerId: string) => SecretaryRepository;
  readonly createId?: () => string;
}

/** Resolves secretary dependencies lazily from Worker bindings or deterministic tests. */
export type SecretaryDependencyResolver = (
  environment: Env,
) => SecretaryRouteDependencies | Promise<SecretaryRouteDependencies>;

/** Registers the authenticated local secretary API surface. */
export function registerSecretaryRoutes(
  app: Hono<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependenciesOrResolver: SecretaryRouteDependencies | SecretaryDependencyResolver,
): void {
  const resolveDependencies: SecretaryDependencyResolver = typeof dependenciesOrResolver === "function"
    ? dependenciesOrResolver
    : () => dependenciesOrResolver;

  app.get("/api/secretary/today", async (context) => {
    const dependencies = await resolveSecretaryDependencies(resolveDependencies, context);
    const session = await authenticateSecretaryRequest(context, dependencies);
    const timeZone = readTimeZone(context.req.query("timeZone"));
    try {
      const source = await dependencies.repositoryForOwner(session.ownerId).readToday(
        session.ownerId,
        readDate(dependencies.now()),
        timeZone,
      );
      return context.json({
        today: buildTodayProjection({
          now: readDate(dependencies.now()),
          timeZone,
          ...source,
        }),
      });
    } catch (error) {
      if (error instanceof VisionError) throw error;
      throw secretaryUnavailable();
    }
  });

  app.post("/api/secretary/captures", async (context) => {
    const dependencies = await resolveSecretaryDependencies(resolveDependencies, context);
    const session = await authenticateSecretaryRequest(context, dependencies);
    await requireSecretaryCsrf(context, session);
    const input = captureSchema.safeParse(await readBoundedJson(context.req.raw));
    if (!input.success) throw secretaryInvalid();
    try {
      const capture = createSecretaryCapture({
        id: createId(dependencies),
        content: input.data.content,
        createdAt: readDate(dependencies.now()),
      });
      const stored = await dependencies.repositoryForOwner(session.ownerId).createCapture(session.ownerId, capture);
      return context.json({ capture: stored }, 201);
    } catch (error) {
      if (error instanceof VisionError) throw error;
      if (error instanceof Error && error.message === "Capture input is invalid.") throw secretaryInvalid();
      throw secretaryUnavailable();
    }
  });

  app.post("/api/secretary/tasks", async (context) => {
    const dependencies = await resolveSecretaryDependencies(resolveDependencies, context);
    const session = await authenticateSecretaryRequest(context, dependencies);
    await requireSecretaryCsrf(context, session);
    const input = taskSchema.safeParse(await readBoundedJson(context.req.raw));
    if (!input.success) throw secretaryInvalid();
    try {
      const task = createSecretaryTask({
        id: createId(dependencies),
        title: input.data.title,
        dueAt: input.data.dueAt,
        timeZone: input.data.timeZone,
        createdAt: readDate(dependencies.now()),
      });
      const stored = await dependencies.repositoryForOwner(session.ownerId).createTask(session.ownerId, task);
      return context.json({ task: stored }, 201);
    } catch (error) {
      if (error instanceof VisionError) throw error;
      if (error instanceof Error && error.message === "Task input is invalid.") throw secretaryInvalid();
      throw secretaryUnavailable();
    }
  });

  app.post("/api/secretary/tasks/:taskId/:action", async (context) => {
    const dependencies = await resolveSecretaryDependencies(resolveDependencies, context);
    const session = await authenticateSecretaryRequest(context, dependencies);
    await requireSecretaryCsrf(context, session);
    const taskId = idSchema.safeParse(context.req.param("taskId"));
    const action = z.enum(["complete", "undo"]).safeParse(context.req.param("action"));
    if (!taskId.success || !action.success) throw secretaryInvalid();
    try {
      const task = await dependencies.repositoryForOwner(session.ownerId).transitionTask(
        session.ownerId,
        taskId.data,
        action.data,
        readDate(dependencies.now()),
      );
      if (!task) throw secretaryConflict();
      return context.json({ task });
    } catch (error) {
      if (error instanceof VisionError) throw error;
      throw secretaryUnavailable();
    }
  });

  app.post("/api/secretary/notes", async (context) => {
    const dependencies = await resolveSecretaryDependencies(resolveDependencies, context);
    const session = await authenticateSecretaryRequest(context, dependencies);
    await requireSecretaryCsrf(context, session);
    const input = noteSchema.safeParse(await readBoundedJson(context.req.raw));
    if (!input.success) throw secretaryInvalid();
    try {
      const note = createSecretaryNote({
        id: createId(dependencies),
        title: input.data.title,
        body: input.data.body,
        createdAt: readDate(dependencies.now()),
      });
      const stored = await dependencies.repositoryForOwner(session.ownerId).createNote(session.ownerId, note);
      return context.json({ note: stored }, 201);
    } catch (error) {
      if (error instanceof VisionError) throw error;
      if (error instanceof Error && error.message === "Note input is invalid.") throw secretaryInvalid();
      throw secretaryUnavailable();
    }
  });
}

/** Creates production secretary dependencies from the existing auth, DB, and wrapped-key boundaries. */
export async function createProductionSecretaryDependencies(
  environment: Env,
  logger: SafeLogger,
): Promise<SecretaryRouteDependencies> {
  const auth = await createProductionAuthDependencies(environment, logger);
  const database = createDb(environment.DATABASE_URL);
  const keyProvider = await createWrappedKeyProvider(
    parseVisionKeyEncryptionKey(environment.KEY_ENCRYPTION_KEY),
    new DrizzleWrappedDataKeyStore(database),
    1,
  );
  return {
    /** Supplies a fresh server timestamp for local secretary records. */
    now: () => new Date(),
    sessions: auth.sessions,
    /** Binds every local record read/write to the authenticated owner. */
    repositoryForOwner: () => new DrizzleSecretaryRepository(database, keyProvider),
  };
}

/** Resolves injected dependencies without exposing initialization failures. */
async function resolveSecretaryDependencies(
  resolver: SecretaryDependencyResolver,
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
): Promise<SecretaryRouteDependencies> {
  try {
    return await resolver(context.env);
  } catch {
    throw secretaryUnavailable();
  }
}

/** Resolves the opaque cookie before any local secretary body is parsed. */
async function authenticateSecretaryRequest(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependencies: SecretaryRouteDependencies,
): Promise<AuthenticatedSession> {
  const sessionId = readSessionCookie(context.req.raw);
  const persisted = sessionId ? await dependencies.sessions.findSession(sessionId, readDate(dependencies.now())) : undefined;
  if (!sessionId || !persisted) {
    throwVisionError(new VisionError("AUTHENTICATION_REQUIRED", 401, "Authentication is required."));
  }
  context.set("authenticatedSession", { ...persisted, sessionId });
  return requireSession(context);
}

/** Requires the decrypted session CSRF token for every local write. */
async function requireSecretaryCsrf(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  session: AuthenticatedSession,
): Promise<void> {
  if (!(await verifyCsrfToken(context.req.header("x-vision-csrf") ?? null, session.csrfToken))) {
    throwVisionError(new VisionError("CSRF_VALIDATION_FAILED", 403, "Request could not be verified."));
  }
}

/** Reads a bounded JSON body before Zod or domain parsing. */
async function readBoundedJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const length = request.headers.get("content-length");
  if (contentType !== "application/json" || (length && (!/^\d+$/u.test(length) || Number(length) > MAX_BODY_BYTES))) {
    throw secretaryInvalid();
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) throw secretaryInvalid();
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown;
  } catch {
    throw secretaryInvalid();
  }
}

/** Reads a caller timezone only when it names a real IANA zone. */
function readTimeZone(value: string | undefined): string {
  const timeZone = value ?? "UTC";
  if (timeZone.length === 0 || timeZone.length > 255) throw secretaryInvalid();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    throw secretaryInvalid();
  }
  return timeZone;
}

/** Copies a fresh server Date before domain use. */
function readDate(value: Date): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw secretaryUnavailable();
  return new Date(value.getTime());
}

/** Generates the only identity exposed for a local secretary record. */
function createId(dependencies: SecretaryRouteDependencies): string {
  const id = dependencies.createId?.() ?? crypto.randomUUID();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(id)) throw secretaryUnavailable();
  return id;
}

/** Raises the constant malformed-secretary-input error. */
function secretaryInvalid(): never {
  throwVisionError(new VisionError("INVALID_SECRETARY_REQUEST", 400, "Secretary request is invalid."));
}

/** Raises the owner-scoped task conflict without exposing row state. */
function secretaryConflict(): never {
  throwVisionError(new VisionError("SECRETARY_CONFLICT", 409, "Secretary item cannot transition."));
}

/** Raises the safe local-secretary availability error. */
function secretaryUnavailable(): never {
  throwVisionError(new VisionError("SECRETARY_UNAVAILABLE", 503, "Local secretary is temporarily unavailable."));
}

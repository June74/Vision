/** Registers the authenticated, CSRF-protected, budgeted AI category proposal route. */
import type { Context, Hono } from "hono";
import { z } from "zod";
import { createDb } from "../../data/db";
import { createAiUsageRepository } from "../../data/repositories/ai-usage-repository";
import type { EncryptedSessionRepository } from "../../data/repositories/session-repository";
import type { CategoryProposalRequest } from "../../integrations/openai/ai-provider";
import {
  BudgetedAiProvider,
  type BudgetedCategoryProposalFactoryRequest,
} from "../../integrations/openai/budgeted-ai-provider";
import {
  buildCategoryContext,
  CategoryContextError,
} from "../../integrations/openai/context-builder";
import { OpenAiProvider } from "../../integrations/openai/openai-provider";
import { verifyCsrfToken } from "../auth/csrf";
import { createProductionAuthDependencies } from "../auth/oauth-routes";
import {
  readSessionCookie,
  requireSession,
  type AuthenticatedSession,
  type AuthRequestVariables,
} from "../auth/session";
import type { Env } from "../env";
import {
  parseAiBudgetEnvironment,
  parseOpenAiEnvironment,
} from "../env";
import { throwVisionError, VisionError } from "../errors";
import type { SafeLogger } from "../logging";

const MAX_AI_CATEGORY_REQUEST_BODY_BYTES = 32 * 1_024;
const aiCategoryProposalSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    event: z.object({}).passthrough(),
    permissions: z.object({}).passthrough(),
  })
  .strict();

/** Narrows the budgeted provider surface that an HTTP route is allowed to invoke. */
export interface AiCategoryProposalProvider {
  proposeCategoryFromFactory(
    input: BudgetedCategoryProposalFactoryRequest,
  ): ReturnType<BudgetedAiProvider["proposeCategoryFromFactory"]>;
}

/** Supplies replaceable authentication, context, and budget boundaries for Worker tests. */
export interface AiCategoryProposalRouteDependencies {
  readonly now: () => Date;
  readonly sessions: Pick<EncryptedSessionRepository, "findSession">;
  readonly createBudgetedProvider: (
    ownerId: string,
  ) => AiCategoryProposalProvider;
  readonly buildCategoryRequest: (
    event: unknown,
    permissions: unknown,
  ) => CategoryProposalRequest;
}

/** Resolves AI proposal dependencies from Worker bindings or deterministic tests. */
export type AiCategoryProposalDependencyResolver = (
  environment: Env,
) =>
  | AiCategoryProposalRouteDependencies
  | Promise<AiCategoryProposalRouteDependencies>;

/** Adds the sole Phase B AI route before the generic API fallback. */
export function registerAiCategoryProposalRoute(
  app: Hono<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependenciesOrResolver:
    | AiCategoryProposalRouteDependencies
    | AiCategoryProposalDependencyResolver,
): void {
  const resolveDependencies: AiCategoryProposalDependencyResolver =
    typeof dependenciesOrResolver === "function"
      ? dependenciesOrResolver
      : () => dependenciesOrResolver;

  app.post("/api/ai/category-proposals", async (context) => {
    const dependencies = await resolveRouteDependencies(
      resolveDependencies,
      context,
    );
    const session = await authenticateAiRequest(context, dependencies);
    await requireAiCsrf(context, session);
    const input = aiCategoryProposalSchema.safeParse(
      await readBoundedJson(context.req.raw),
    );
    if (!input.success) throw invalidAiCategoryRequest();

    const provider = dependencies.createBudgetedProvider(session.ownerId);
    let result;
    try {
      result = await provider.proposeCategoryFromFactory({
        idempotencyKey: input.data.idempotencyKey,
        requestClass: "routine",
        /** Builds the minimum provider packet only after budget admission succeeds. */
        requestFactory: () =>
          dependencies.buildCategoryRequest(
            input.data.event,
            input.data.permissions,
          ),
      });
    } catch (error) {
      if (error instanceof CategoryContextError) {
        throw invalidAiCategoryRequest();
      }
      throw aiCategoryUnavailable();
    }

    if (result.status === "success") {
      context.header("Cache-Control", "no-store");
      return context.json({ proposal: result.proposal });
    }
    if (result.status === "unavailable") {
      throwBudgetedUnavailable(result.code);
    }
    throw aiCategoryUnavailable();
  });
}

/** Builds production dependencies over the encrypted session store and durable AI ledger. */
export async function createProductionAiCategoryProposalDependencies(
  environment: Env,
  logger: SafeLogger,
): Promise<AiCategoryProposalRouteDependencies> {
  const auth = await createProductionAuthDependencies(environment, logger);
  const openAi = parseOpenAiEnvironment({
    OPENAI_GATEWAY_BASE_URL: environment.OPENAI_GATEWAY_BASE_URL,
    OPENAI_API_KEY: environment.OPENAI_API_KEY,
  });
  const budget = parseAiBudgetEnvironment({
    AI_MONTHLY_HARD_LIMIT_CENTS: environment.AI_MONTHLY_HARD_LIMIT_CENTS,
    AI_INPUT_CENTS_PER_MILLION_TOKENS:
      environment.AI_INPUT_CENTS_PER_MILLION_TOKENS,
    AI_OUTPUT_CENTS_PER_MILLION_TOKENS:
      environment.AI_OUTPUT_CENTS_PER_MILLION_TOKENS,
    AI_ROUTINE_WORST_CASE_CENTS: environment.AI_ROUTINE_WORST_CASE_CENTS,
    AI_OPTIONAL_WORST_CASE_CENTS: environment.AI_OPTIONAL_WORST_CASE_CENTS,
    AI_COMPLEX_WORST_CASE_CENTS: environment.AI_COMPLEX_WORST_CASE_CENTS,
  });
  const repository = createAiUsageRepository(
    createDb(environment.DATABASE_URL),
  );
  const provider = new OpenAiProvider({
    fetch: fetch.bind(globalThis),
    gatewayBaseUrl: openAi.OPENAI_GATEWAY_BASE_URL,
    providerKey: openAi.OPENAI_API_KEY,
  });

  return {
    /** Reads current time independently for each server-session lookup. */
    now: () => new Date(),
    sessions: auth.sessions,
    /** Creates an owner-bound budget wrapper only after authenticating the active session. */
    createBudgetedProvider: (ownerId) =>
      new BudgetedAiProvider({
        ownerId,
        repository,
        provider,
        pricing: {
          inputCentsPerMillionTokens:
            budget.AI_INPUT_CENTS_PER_MILLION_TOKENS,
          outputCentsPerMillionTokens:
            budget.AI_OUTPUT_CENTS_PER_MILLION_TOKENS,
          worstCaseCents: {
            routine: budget.AI_ROUTINE_WORST_CASE_CENTS,
            optional: budget.AI_OPTIONAL_WORST_CASE_CENTS,
            complex: budget.AI_COMPLEX_WORST_CASE_CENTS,
          },
        },
        reservationTtlMs: 60_000,
        /** Reads settlement time independently from request authentication time. */
        now: () => new Date(),
        /** Generates an opaque durable reservation identifier. */
        createReservationId: () => crypto.randomUUID(),
      }),
    /** Copies only explicitly permitted event facts into the provider request. */
    buildCategoryRequest: (event, permissions) => {
      const packet = buildCategoryContext(event, permissions);
      return {
        subjectId: packet.eventId,
        evidenceIds: packet.evidence.map(({ id }) => id),
        policyVersion: packet.policyVersion,
        context: { ...packet },
      };
    },
  };
}

/** Resolves and validates one active server session before any request-body work. */
async function authenticateAiRequest(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependencies: AiCategoryProposalRouteDependencies,
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

/** Requires the exact decrypted session CSRF value before accepting event facts. */
async function requireAiCsrf(
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

/** Streams and decodes one strict JSON body without buffering beyond the fixed byte limit. */
async function readBoundedJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:;|$)/iu.test(contentType)) {
    throw invalidAiCategoryRequest();
  }
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^(?:0|[1-9]\d*)$/u.test(declaredLength) ||
      Number(declaredLength) > MAX_AI_CATEGORY_REQUEST_BODY_BYTES)
  ) {
    throw invalidAiCategoryRequest();
  }
  if (request.body === null) throw invalidAiCategoryRequest();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_AI_CATEGORY_REQUEST_BODY_BYTES) {
        await reader.cancel();
        throw invalidAiCategoryRequest();
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
    throw invalidAiCategoryRequest();
  }
}

/** Resolves production or injected dependencies through one generic safe availability error. */
async function resolveRouteDependencies(
  resolver: AiCategoryProposalDependencyResolver,
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
): Promise<AiCategoryProposalRouteDependencies> {
  return Promise.resolve(resolver(context.env)).catch(() => {
    throw aiCategoryUnavailable();
  });
}

/** Maps budget admission states to stable privacy-safe HTTP errors. */
function throwBudgetedUnavailable(
  code:
    | "AI_BUDGET_EXHAUSTED"
    | "AI_CONCURRENCY_UNAVAILABLE"
    | "AI_ACCOUNTING_UNAVAILABLE"
    | "AI_DUPLICATE_REQUEST",
): never {
  if (code === "AI_BUDGET_EXHAUSTED") {
    throwVisionError(
      new VisionError(
        code,
        503,
        "AI proposal is unavailable because the monthly budget is exhausted.",
      ),
    );
  }
  if (code === "AI_DUPLICATE_REQUEST") {
    throwVisionError(
      new VisionError(
        code,
        409,
        "This AI proposal request has already been submitted.",
      ),
    );
  }
  throwVisionError(
    new VisionError(code, 503, "AI proposal is temporarily unavailable."),
  );
}

/** Creates the constant strict-input failure. */
function invalidAiCategoryRequest(): never {
  throwVisionError(
    new VisionError(
      "INVALID_AI_CATEGORY_REQUEST",
      400,
      "AI category proposal request is invalid.",
    ),
  );
}

/** Creates the constant provider, configuration, or accounting availability failure. */
function aiCategoryUnavailable(): never {
  throwVisionError(
    new VisionError(
      "AI_CATEGORY_UNAVAILABLE",
      503,
      "AI proposal is temporarily unavailable.",
    ),
  );
}

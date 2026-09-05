/** Registers server-owned Google OAuth and session routes without placing secrets in the browser. */
import type { Context, Hono } from "hono";
import { createWrappedKeyProvider } from "../../crypto/key-provider";
import { createDb } from "../../data/db";
import {
  createChannelMaintenanceRepository,
  type AuthorizationRecoveryOutcome,
} from "../../data/repositories/channel-maintenance-repository";
import {
  authorizeIdentity,
  IdentityAuthorizationError,
  type IdentityAllowlist,
  type ServerVerifiedGoogleClaims,
} from "../../domain/auth/identity";
import {
  GOOGLE_OAUTH_SCOPES,
  GoogleJwksIdTokenVerifier,
  GoogleOAuthClient,
} from "../../integrations/google/oauth-client";
import {
  DrizzleSessionStore,
  EncryptedSessionRepository,
} from "../../data/repositories/session-repository";
import {
  DrizzleTokenStore,
  DrizzleWrappedDataKeyStore,
  EncryptedTokenRepository,
  type TokenRepositoryPort,
} from "../../data/repositories/token-repository";
import {
  parseGoogleAuthEnvironment,
  parseVisionKeyEncryptionKey,
  type Env,
} from "../env";
import { throwVisionError, VisionError } from "../errors";
import { logEvent, type SafeLogger } from "../logging";
import { verifyCsrfToken } from "./csrf";
import {
  AUTH_DIAGNOSTIC_HEADER,
  AuthStageError,
  readAuthDiagnosticStage,
  readAuthFailureCause,
  readPreviewDiagnosticStage,
  runAuthStage,
  type AuthDiagnosticStage,
} from "./diagnostics";
import {
  createAuthAdmissionKeyFactory,
  type AuthAdmissionKeyFactory,
} from "./admission";
import {
  clearSessionCookie,
  createSessionCookie,
  readSessionCookie,
  requireSession,
  SESSION_LIFETIME_MS,
  type AuthRequestVariables,
} from "./session";

/** Random protocol values generated only on the server. */
export type AuthRandomPurpose = "state" | "pkceVerifier" | "nonce" | "sessionId" | "csrfToken";

/** Narrow owner-scoped synchronization repair boundary used only after reconnect. */
export interface AuthorizationRecoveryPort {
  recoverAfterReconnect(input: {
    readonly googleSubject: string;
    readonly tokenVersion: number;
    readonly tokenUpdatedAt: Date;
  }): Promise<AuthorizationRecoveryOutcome>;
}

/** Complete injected server boundaries used by authentication routes. */
export interface AuthRouteDependencies {
  readonly admissionKey: AuthAdmissionKeyFactory;
  readonly authorizationRecovery: AuthorizationRecoveryPort;
  readonly environment: "local" | "preview" | "production";
  readonly identityAllowlist: IdentityAllowlist;
  readonly logger: SafeLogger;
  readonly now: () => Date;
  readonly oauthClient: GoogleOAuthClient;
  readonly ownerId: string;
  readonly randomToken: (purpose: AuthRandomPurpose) => string;
  readonly sessions: EncryptedSessionRepository;
  readonly tokens: TokenRepositoryPort;
}

/** Resolves request-safe authentication dependencies from Worker bindings or deterministic tests. */
export type AuthDependencyResolver = (
  environment: Env,
) => AuthRouteDependencies | Promise<AuthRouteDependencies>;

const OAUTH_TRANSACTION_LIFETIME_MS = 10 * 60 * 1_000;
const BASE64URL_PROTOCOL_VALUE = /^[A-Za-z0-9_-]+$/u;

/** Carries only a safe startup-failure category; never retains secret-bearing error text. */
class AuthDependencyInitializationError extends Error {
  constructor(readonly category: "configuration_invalid" | "encryption_key_invalid" | "database_unavailable") {
    super(category);
    this.name = "AuthDependencyInitializationError";
  }
}

/** Fixed callback stages safe for operational logs; none contain provider or user values. */
type AuthCallbackFailureCategory =
  | "callback_dependencies_failed"
  | "callback_request_invalid"
  | "callback_transaction_failed"
  | "token_exchange_failed"
  | "scope_validation_failed"
  | "id_token_verification_failed"
  | "claims_validation_failed"
  | "token_persistence_failed"
  | "authorization_recovery_failed"
  | "session_rotation_failed"
  | "session_creation_failed";

/** Every privacy-safe authentication failure category emitted by this module. */
type AuthFailureCategory =
  | "account_not_allowed"
  | "authentication_failed"
  | AuthCallbackFailureCategory;

/** Adds the Google start route before the Worker's generic API fallback. */
export function registerOAuthRoutes(
  app: Hono<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependenciesOrResolver: AuthRouteDependencies | AuthDependencyResolver,
): void {
  const resolveDependencies: AuthDependencyResolver =
    typeof dependenciesOrResolver === "function"
      ? dependenciesOrResolver
      : () => dependenciesOrResolver;

  app.get("/api/auth/google/start", async (context) => {
    let resolved: AuthRouteDependencies | undefined;
    try {
      const dependencies = await runAuthStage(
        "start_dependencies_unavailable",
        () => resolveDependencies(context.env),
      );
      resolved = dependencies;
      const createdAt = dependencies.now();
      const admissionKey = await runAuthStage("start_admission_key_failed", () =>
        dependencies.admissionKey(context.req.raw),
      );
      const protocolValues = await runAuthStage("start_protocol_values_failed", () => ({
        state: readGeneratedProtocolValue(dependencies.randomToken("state")),
        pkceVerifier: readGeneratedProtocolValue(dependencies.randomToken("pkceVerifier")),
        nonce: readGeneratedProtocolValue(dependencies.randomToken("nonce")),
      }));
      const { state, pkceVerifier, nonce } = protocolValues;
      const expiresAt = new Date(createdAt.getTime() + OAUTH_TRANSACTION_LIFETIME_MS);
      const admitted = await runAuthStage("start_transaction_write_failed", () =>
        dependencies.sessions.createOAuthTransaction({
          state,
          admissionKey,
          pkceVerifier,
          nonce,
          createdAt,
          expiresAt,
        }),
      );
      if (!admitted) {
        logAuthEventSafely(
          dependencies.logger,
          context.get("requestId"),
          "denied",
          "auth.start",
          "authentication_failed",
          "start_transaction_rejected",
        );
        return authStartLimited(
          context,
          readPreviewDiagnosticStage(dependencies.environment, "start_transaction_rejected"),
        );
      }
      const requestConsent = !(await runAuthStage("start_refresh_lookup_failed", () =>
        dependencies.tokens.hasRefreshToken(dependencies.identityAllowlist.sub),
      ));
      const codeChallenge = await runAuthStage("start_authorization_url_failed", () =>
        createPkceChallenge(pkceVerifier),
      );
      const authorizationUrl = await runAuthStage("start_authorization_url_failed", () =>
        dependencies.oauthClient.createAuthorizationUrl({
          state,
          nonce,
          codeChallenge,
          requestConsent,
        }),
      );
      logAuthEventSafely(dependencies.logger, context.get("requestId"), "succeeded");
      return context.redirect(authorizationUrl, 302);
    } catch (error) {
      const stage = readAuthDiagnosticStage(error);
      logAuthEventSafely(
        resolved?.logger ?? (() => {}),
        context.get("requestId"),
        "failed",
        "auth.start",
        undefined,
        stage,
      );
      applyPreviewDiagnosticHeader(
        context,
        readPreviewDiagnosticStage(readDiagnosticEnvironment(context, resolved), stage),
      );
      throwVisionError(
        new VisionError("AUTHENTICATION_FAILED", 503, "Authentication is temporarily unavailable."),
      );
    }
  });

  app.get("/api/auth/google/callback", async (context) => {
    const requestId = context.get("requestId");
    let dependencies: AuthRouteDependencies | undefined;
    let failureCategory: AuthCallbackFailureCategory = "callback_dependencies_failed";
    try {
      const resolved = await runAuthStage(
        "callback_dependencies_unavailable",
        () => resolveDependencies(context.env),
      );
      dependencies = resolved;
      failureCategory = "callback_request_invalid";
      const query = await runAuthStage("callback_query_invalid", () =>
        readCallbackQuery(context.req.raw),
      );
      failureCategory = "callback_transaction_failed";
      const transaction = await runAuthStage("callback_state_not_found", () =>
        resolved.sessions.consumeOAuthTransaction(query.state, resolved.now()),
      );
      if (!transaction) {
        logAuthEventSafely(
          resolved.logger,
          requestId,
          "failed",
          "auth.callback",
          "authentication_failed",
          "callback_state_not_found",
        );
        return authenticationFailurePage(
          context,
          400,
          readPreviewDiagnosticStage(resolved.environment, "callback_state_not_found"),
        );
      }
      failureCategory = "token_exchange_failed";
      const tokenSet = await runAuthStage("callback_code_exchange_failed", () =>
        resolved.oauthClient.exchangeCode(query.code, transaction.pkceVerifier),
      );
      failureCategory = "scope_validation_failed";
      await runAuthStage("callback_scope_rejected", () => validateGrantedScopes(tokenSet.scopes));
      failureCategory = "id_token_verification_failed";
      const payload = await runAuthStage("callback_id_token_invalid", () =>
        resolved.oauthClient.verifyIdToken(tokenSet.idToken),
      );
      failureCategory = "claims_validation_failed";
      const claims = await runAuthStage("callback_claims_invalid", () =>
        readVerifiedClaims(payload, transaction.nonce, resolved.now()),
      );
      const identity = await runAuthStage("callback_account_not_allowed", () =>
        authorizeIdentity(claims, resolved.identityAllowlist, resolved.now()),
      );
      failureCategory = "token_persistence_failed";
      const issuedAt = resolved.now();
      const retainedTokens = await runAuthStage("callback_token_persist_failed", () =>
        resolved.tokens.saveGoogleTokens({
          googleSubject: identity.subject,
          ...(tokenSet.refreshToken
            ? { refreshToken: tokenSet.refreshToken }
            : {}),
          accessToken: tokenSet.accessToken,
          accessExpiresAt: new Date(
            issuedAt.getTime() + tokenSet.expiresInSeconds * 1_000,
          ),
          grantedScopes: tokenSet.scopes,
          updatedAt: issuedAt,
        }),
      );

      failureCategory = "authorization_recovery_failed";
      await runAuthStage("callback_authorization_recovery_failed", async () => {
        const recoveryOutcome = await resolved.authorizationRecovery.recoverAfterReconnect({
          googleSubject: identity.subject,
          tokenVersion: retainedTokens.tokenVersion,
          tokenUpdatedAt: retainedTokens.updatedAt,
        });
        if (recoveryOutcome === "conflict") {
          throw new AuthStageError("callback_authorization_recovery_conflict");
        }
        if (recoveryOutcome !== "recovered" && recoveryOutcome !== "not_needed") {
          throw new Error("Authorization recovery did not admit session creation.");
        }
      });

      failureCategory = "session_rotation_failed";
      const previousSessionId = readSessionCookie(context.req.raw);
      if (previousSessionId) {
        // Successful authentication always rotates any presented session bearer.
        await runAuthStage("callback_session_rotation_failed", () =>
          resolved.sessions.revokeSession(previousSessionId, issuedAt),
        );
      }
      await runAuthStage("callback_session_create_failed", async () => {
        const sessionId = readGeneratedProtocolValue(resolved.randomToken("sessionId"));
        const csrfToken = readGeneratedProtocolValue(resolved.randomToken("csrfToken"));
        const expiresAt = new Date(issuedAt.getTime() + SESSION_LIFETIME_MS);
        failureCategory = "session_creation_failed";
        await resolved.sessions.createSession({
          sessionId,
          ownerId: resolved.ownerId,
          googleSubject: identity.subject,
          email: identity.email,
          csrfToken,
          createdAt: issuedAt,
          expiresAt,
        });
        logAuthEventSafely(resolved.logger, requestId, "succeeded", "auth.callback");
        context.header(
          "Set-Cookie",
          createSessionCookie(
            sessionId,
            resolved.environment,
            SESSION_LIFETIME_MS / 1_000,
          ),
        );
      });
      context.header("Cache-Control", "no-store");
      return context.redirect("/", 302);
    } catch (error) {
      const stage = readAuthDiagnosticStage(error);
      const previewStage = readPreviewDiagnosticStage(
        readDiagnosticEnvironment(context, dependencies),
        stage,
      );
      if (
        dependencies !== undefined &&
        failureCategory === "claims_validation_failed" &&
        readAuthFailureCause(error) instanceof IdentityAuthorizationError
      ) {
        logAuthEventSafely(
          dependencies.logger,
          requestId,
          "denied",
          "auth.callback",
          "account_not_allowed",
          "callback_account_not_allowed",
        );
        return accessDeniedPage(context, previewStage);
      }
      logAuthEventSafely(
        dependencies?.logger ?? (() => {}),
        requestId,
        "failed",
        "auth.callback",
        failureCategory,
        stage,
      );
      return authenticationFailurePage(context, 400, previewStage);
    }
  });

  app.get("/api/auth/session", async (context) => {
    const dependencies = await Promise.resolve(
      resolveDependencies(context.env),
    ).catch((error) => {
      console.info({
        requestId: context.get("requestId"),
        action: "auth.dependencies",
        outcome: "failed",
        errorCategory: error instanceof AuthDependencyInitializationError ? error.category : "authentication_failed",
      });
      throwVisionError(
        new VisionError("AUTHENTICATION_FAILED", 503, "Authentication is temporarily unavailable."),
      );
    });
    const sessionId = readSessionCookie(context.req.raw);
    const persisted = sessionId
      ? await dependencies.sessions.findSession(sessionId, dependencies.now())
      : undefined;
    if (!sessionId || !persisted) {
      throwVisionError(
        new VisionError("AUTHENTICATION_REQUIRED", 401, "Authentication is required."),
      );
    }
    context.set("authenticatedSession", { ...persisted, sessionId });
    const session = requireSession(context);
    context.header("Cache-Control", "no-store");
    return context.json({
      authenticated: true,
      email: session.email,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt.toISOString(),
    });
  });

  app.post("/api/auth/logout", async (context) => {
    const dependencies = await Promise.resolve(
      resolveDependencies(context.env),
    ).catch(() => {
      throwVisionError(
        new VisionError("AUTHENTICATION_FAILED", 503, "Authentication is temporarily unavailable."),
      );
    });
    const sessionId = readSessionCookie(context.req.raw);
    const persisted = sessionId
      ? await dependencies.sessions.findSession(sessionId, dependencies.now())
      : undefined;
    if (!sessionId || !persisted) {
      throwVisionError(
        new VisionError("AUTHENTICATION_REQUIRED", 401, "Authentication is required."),
      );
    }
    context.set("authenticatedSession", { ...persisted, sessionId });
    const session = requireSession(context);
    if (
      !(await verifyCsrfToken(
        context.req.header("x-vision-csrf") ?? null,
        session.csrfToken,
      ))
    ) {
      throwVisionError(
        new VisionError("CSRF_VALIDATION_FAILED", 403, "Request could not be verified."),
      );
    }
    await dependencies.sessions.revokeSession(session.sessionId, dependencies.now());
    context.header(
      "Set-Cookie",
      clearSessionCookie(dependencies.environment),
    );
    context.header("Cache-Control", "no-store");
    logAuthEventSafely(
      dependencies.logger,
      context.get("requestId"),
      "succeeded",
      "auth.logout",
    );
    return context.body(null, 204);
  });
}

/** Builds production OAuth, encrypted repository, and cryptographic verification boundaries from Worker bindings. */
export async function createProductionAuthDependencies(
  environment: Env,
  logger: SafeLogger,
): Promise<AuthRouteDependencies> {
  let authEnvironment;
  try {
    authEnvironment = parseGoogleAuthEnvironment(environment);
  } catch {
    throw new AuthDependencyInitializationError("configuration_invalid");
  }
  let database;
  try {
    database = createDb(environment.DATABASE_URL);
  } catch {
    throw new AuthDependencyInitializationError("configuration_invalid");
  }
  let keyEncryptionKey;
  try {
    keyEncryptionKey = parseVisionKeyEncryptionKey(environment.KEY_ENCRYPTION_KEY);
  } catch {
    throw new AuthDependencyInitializationError("encryption_key_invalid");
  }
  let keyProvider;
  try {
    keyProvider = await createWrappedKeyProvider(
      keyEncryptionKey,
      new DrizzleWrappedDataKeyStore(database),
      1,
    );
  } catch {
    throw new AuthDependencyInitializationError("database_unavailable");
  }
  const ownerId = await deriveOwnerId(authEnvironment.GOOGLE_ALLOWED_SUB);
  const maintenance = createChannelMaintenanceRepository(
    database,
    ownerId,
  );
  const authorizationRecovery: AuthorizationRecoveryPort = {
    /** Delegates the narrow callback port to the owner-scoped repository method. */
    recoverAfterReconnect: (input) =>
      maintenance.recoverAuthorizationAfterReconnect(input),
  };
  const admissionKey = await createAuthAdmissionKeyFactory(
    environment.KEY_ENCRYPTION_KEY,
    authEnvironment.VISION_ENV,
  );
  return {
    admissionKey,
    authorizationRecovery,
    environment: authEnvironment.VISION_ENV,
    identityAllowlist: {
      email: authEnvironment.GOOGLE_ALLOWED_EMAIL,
      sub: authEnvironment.GOOGLE_ALLOWED_SUB,
      trustedAudience: authEnvironment.GOOGLE_CLIENT_ID,
      trustedIssuer: "https://accounts.google.com",
    },
    logger,
    /** Reads current wall-clock time at each security decision rather than reusing a stale module snapshot. */
    now: () => new Date(),
    oauthClient: new GoogleOAuthClient(
      {
        clientId: authEnvironment.GOOGLE_CLIENT_ID,
        clientSecret: authEnvironment.GOOGLE_CLIENT_SECRET,
        redirectUri: authEnvironment.GOOGLE_REDIRECT_URI,
      },
      fetch.bind(globalThis),
      new GoogleJwksIdTokenVerifier(fetch.bind(globalThis)),
    ),
    ownerId,
    randomToken: createRandomProtocolValue,
    sessions: new EncryptedSessionRepository(
      new DrizzleSessionStore(database),
      keyProvider,
    ),
    tokens: new EncryptedTokenRepository(
      new DrizzleTokenStore(database),
      keyProvider,
      ownerId,
    ),
  };
}

/** Converts a PKCE verifier into its canonical SHA-256 code challenge. */
async function createPkceChallenge(verifier: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

/** Admits only high-entropy-sized canonical base64url generated values. */
function readGeneratedProtocolValue(value: string): string {
  if (
    typeof value !== "string" ||
    value.length < 43 ||
    value.length > 128 ||
    !BASE64URL_PROTOCOL_VALUE.test(value)
  ) {
    throw new Error("Invalid generated protocol value.");
  }
  return value;
}

/** Generates a 256-bit canonical base64url protocol value inside the Worker runtime. */
function createRandomProtocolValue(_purpose: AuthRandomPurpose): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

/** Emits one fixed-shape authentication fact without letting logging availability affect the route. */
function logAuthEventSafely(
  logger: SafeLogger,
  requestId: string,
  outcome: "succeeded" | "failed" | "denied",
  action = "auth.start",
  errorCategory?: AuthFailureCategory,
  diagnosticStage?: AuthDiagnosticStage,
): void {
  try {
    logEvent(logger, {
      requestId,
      action,
      outcome,
      provider: "google",
      ...(errorCategory ? { errorCategory } : {}),
      ...(diagnosticStage ? { diagnosticStage } : {}),
    });
  } catch {
    // Auth behavior must not depend on the availability of the safe operational log sink.
  }
}

/**
 * Reads the deployment environment for the temporary diagnostic, falling back to the raw binding when
 * dependency construction itself failed and no validated environment exists yet.
 */
function readDiagnosticEnvironment(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependencies: AuthRouteDependencies | undefined,
): string | undefined {
  if (dependencies) return dependencies.environment;
  const binding = (context.env as { VISION_ENV?: unknown } | undefined)?.VISION_ENV;
  return typeof binding === "string" ? binding : undefined;
}

/** Attaches the constant failure category to a preview response and leaves every other build untouched. */
function applyPreviewDiagnosticHeader(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  previewStage: AuthDiagnosticStage | undefined,
): void {
  if (!previewStage) return;
  context.header(AUTH_DIAGNOSTIC_HEADER, previewStage);
}

/** Renders the preview-only failure category as one constant HTML line, or nothing outside preview. */
function previewDiagnosticMarkup(previewStage: AuthDiagnosticStage | undefined): string {
  return previewStage ? `<p>Diagnostic stage: ${previewStage}</p>` : "";
}

/** Reads exact single callback parameters and rejects duplicates, errors, and oversized values. */
function readCallbackQuery(request: Request): { code: string; state: string } {
  const url = new URL(request.url);
  const codes = url.searchParams.getAll("code");
  const states = url.searchParams.getAll("state");
  if (
    codes.length !== 1 ||
    states.length !== 1 ||
    url.searchParams.has("error") ||
    !codes[0] ||
    codes[0].length > 4_096 ||
    !states[0] ||
    !BASE64URL_PROTOCOL_VALUE.test(states[0]) ||
    states[0].length < 43 ||
    states[0].length > 128
  ) {
    throw new Error("Invalid OAuth callback.");
  }
  return { code: codes[0], state: states[0] };
}

/** Snapshots signed claim data, verifies the one-time nonce, and rejects non-scalar audiences. */
async function readVerifiedClaims(
  payload: unknown,
  expectedNonce: string,
  verifiedAt: Date,
): Promise<ServerVerifiedGoogleClaims> {
  const snapshot = snapshotSignedClaims(payload);
  if (
    !snapshot ||
    typeof snapshot.iss !== "string" ||
    typeof snapshot.aud !== "string" ||
    typeof snapshot.sub !== "string" ||
    typeof snapshot.email !== "string" ||
    snapshot.email_verified !== true ||
    typeof snapshot.exp !== "number" ||
    !Number.isSafeInteger(snapshot.exp) ||
    typeof snapshot.nonce !== "string" ||
    !(await verifyCsrfToken(snapshot.nonce, expectedNonce))
  ) {
    throw new Error("Invalid signed claims.");
  }
  const expiresAt = new Date(snapshot.exp * 1_000);
  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.getTime() <= verifiedAt.getTime()
  ) {
    throw new Error("Invalid signed claims.");
  }
  return {
    issuer: snapshot.iss,
    audience: snapshot.aud,
    sub: snapshot.sub,
    email: snapshot.email,
    emailVerified: true,
    expiresAt,
  };
}

/** Copies required signed claims without invoking getters or retaining a hostile verifier object. */
function snapshotSignedClaims(
  payload: unknown,
): Record<string, unknown> | undefined {
  try {
    if (
      typeof payload !== "object" ||
      payload === null ||
      Object.getPrototypeOf(payload) !== Object.prototype ||
      Object.getOwnPropertySymbols(payload).length !== 0
    ) {
      return undefined;
    }
    const names = Object.getOwnPropertyNames(payload);
    if (names.length > 32) return undefined;
    const required = ["aud", "email", "email_verified", "exp", "iss", "nonce", "sub"];
    const snapshot: Record<string, unknown> = {};
    for (const key of names) {
      const descriptor = Object.getOwnPropertyDescriptor(payload, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
    }
    for (const key of required) {
      const descriptor = Object.getOwnPropertyDescriptor(payload, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch {
    return undefined;
  }
}

/** Baseline identity scopes Google grants alongside "openid"/"email" that carry no calendar or profile-write access; safe to ignore rather than require or reject. */
const BENIGN_IDENTITY_SCOPES = new Set([
  "profile",
  "https://www.googleapis.com/auth/userinfo.profile",
]);

/** Requires every V1 scope and rejects previously granted broad or event-write scopes. */
function validateGrantedScopes(scopes: readonly string[]): void {
  const normalized = scopes
    .map((scope) =>
      scope === "https://www.googleapis.com/auth/userinfo.email"
        ? "email"
        : scope,
    )
    .filter((scope) => !BENIGN_IDENTITY_SCOPES.has(scope));
  const granted = new Set(normalized);
  if (
    GOOGLE_OAUTH_SCOPES.some((scope) => !granted.has(scope)) ||
    normalized.some(
      (scope) =>
        !GOOGLE_OAUTH_SCOPES.includes(
          scope as (typeof GOOGLE_OAUTH_SCOPES)[number],
        ),
    )
  ) {
    throw new Error("Google returned an unsafe scope set.");
  }
}

/** Returns one constant wrong-account page without any claim or allowlist detail. */
function accessDeniedPage(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  previewStage?: AuthDiagnosticStage,
) {
  context.header("Cache-Control", "no-store");
  applyPreviewDiagnosticHeader(context, previewStage);
  return context.html(
    `<!doctype html><html><body><h1>Access denied</h1><p>This account cannot use Vision.</p>${previewDiagnosticMarkup(previewStage)}</body></html>`,
    403,
  );
}

/** Returns one constant callback failure page without provider, query, or storage detail. */
function authenticationFailurePage(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  status: 400,
  previewStage?: AuthDiagnosticStage,
) {
  context.header("Cache-Control", "no-store");
  applyPreviewDiagnosticHeader(context, previewStage);
  return context.html(
    `<!doctype html><html><body><h1>Authentication failed</h1><p>Please try again.</p>${previewDiagnosticMarkup(previewStage)}</body></html>`,
    status,
  );
}

/** Returns one fixed rate-limit response without an admission key, IP, session, or OAuth value. */
function authStartLimited(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  previewStage?: AuthDiagnosticStage,
) {
  context.header("Cache-Control", "no-store");
  context.header("Retry-After", "600");
  applyPreviewDiagnosticHeader(context, previewStage);
  return context.json(
    {
      error: {
        code: "AUTH_START_LIMITED",
        message: "Please wait before trying to sign in again.",
      },
    },
    429,
  );
}

/** Derives a stable opaque Vision owner identifier without persisting the allowlisted subject as the owner key. */
async function deriveOwnerId(googleSubject: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(googleSubject)),
  );
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return `usr_${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")}`;
}

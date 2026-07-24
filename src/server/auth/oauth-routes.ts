/** Registers server-owned Google OAuth and session routes without placing secrets in the browser. */
import type { Context, Hono } from "hono";
import { createWrappedKeyProvider } from "../../crypto/key-provider";
import { createDb } from "../../data/db";
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

/** Complete injected server boundaries used by authentication routes. */
export interface AuthRouteDependencies {
  readonly admissionKey: AuthAdmissionKeyFactory;
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
  constructor(readonly category: "configuration_invalid" | "database_or_key_unavailable") {
    super(category);
    this.name = "AuthDependencyInitializationError";
  }
}

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
      const dependencies = await resolveDependencies(context.env);
      resolved = dependencies;
      const createdAt = dependencies.now();
      const admissionKey = await dependencies.admissionKey(context.req.raw);
      const state = readGeneratedProtocolValue(dependencies.randomToken("state"));
      const pkceVerifier = readGeneratedProtocolValue(dependencies.randomToken("pkceVerifier"));
      const nonce = readGeneratedProtocolValue(dependencies.randomToken("nonce"));
      const expiresAt = new Date(createdAt.getTime() + OAUTH_TRANSACTION_LIFETIME_MS);
      const admitted = await dependencies.sessions.createOAuthTransaction({
        state,
        admissionKey,
        pkceVerifier,
        nonce,
        createdAt,
        expiresAt,
      });
      if (!admitted) {
        logAuthEventSafely(
          dependencies.logger,
          context.get("requestId"),
          "denied",
          "auth.start",
          "authentication_failed",
        );
        return authStartLimited(context);
      }
      const requestConsent = !(await dependencies.tokens.hasRefreshToken(
        dependencies.identityAllowlist.sub,
      ));
      const authorizationUrl = dependencies.oauthClient.createAuthorizationUrl({
        state,
        nonce,
        codeChallenge: await createPkceChallenge(pkceVerifier),
        requestConsent,
      });
      logAuthEventSafely(dependencies.logger, context.get("requestId"), "succeeded");
      return context.redirect(authorizationUrl, 302);
    } catch {
      logAuthEventSafely(
        resolved?.logger ?? (() => {}),
        context.get("requestId"),
        "failed",
      );
      throwVisionError(
        new VisionError("AUTHENTICATION_FAILED", 503, "Authentication is temporarily unavailable."),
      );
    }
  });

  app.get("/api/auth/google/callback", async (context) => {
    const requestId = context.get("requestId");
    let dependencies: AuthRouteDependencies | undefined;
    try {
      dependencies = await resolveDependencies(context.env);
      const query = readCallbackQuery(context.req.raw);
      const transaction = await dependencies.sessions.consumeOAuthTransaction(
        query.state,
        dependencies.now(),
      );
      if (!transaction) {
        logAuthEventSafely(
          dependencies.logger,
          requestId,
          "failed",
          "auth.callback",
          "authentication_failed",
        );
        return authenticationFailurePage(context, 400);
      }
      const tokenSet = await dependencies.oauthClient.exchangeCode(
        query.code,
        transaction.pkceVerifier,
      );
      validateGrantedScopes(tokenSet.scopes);
      const payload = await dependencies.oauthClient.verifyIdToken(tokenSet.idToken);
      const claims = await readVerifiedClaims(
        payload,
        transaction.nonce,
        dependencies.now(),
      );
      const identity = authorizeIdentity(
        claims,
        dependencies.identityAllowlist,
        dependencies.now(),
      );
      const issuedAt = dependencies.now();
      await dependencies.tokens.saveGoogleTokens({
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
      });

      const previousSessionId = readSessionCookie(context.req.raw);
      if (previousSessionId) {
        // Successful authentication always rotates any presented session bearer.
        await dependencies.sessions.revokeSession(previousSessionId, issuedAt);
      }
      const sessionId = readGeneratedProtocolValue(
        dependencies.randomToken("sessionId"),
      );
      const csrfToken = readGeneratedProtocolValue(
        dependencies.randomToken("csrfToken"),
      );
      const expiresAt = new Date(issuedAt.getTime() + SESSION_LIFETIME_MS);
      await dependencies.sessions.createSession({
        sessionId,
        ownerId: dependencies.ownerId,
        googleSubject: identity.subject,
        email: identity.email,
        csrfToken,
        createdAt: issuedAt,
        expiresAt,
      });
      logAuthEventSafely(dependencies.logger, requestId, "succeeded", "auth.callback");
      context.header(
        "Set-Cookie",
        createSessionCookie(
          sessionId,
          dependencies.environment,
          SESSION_LIFETIME_MS / 1_000,
        ),
      );
      context.header("Cache-Control", "no-store");
      return context.redirect("/", 302);
    } catch (error) {
      if (
        dependencies !== undefined &&
        error instanceof IdentityAuthorizationError
      ) {
        logAuthEventSafely(
          dependencies.logger,
          requestId,
          "denied",
          "auth.callback",
          "account_not_allowed",
        );
        return accessDeniedPage(context);
      }
      logAuthEventSafely(
        dependencies?.logger ?? (() => {}),
        requestId,
        "failed",
        "auth.callback",
        "authentication_failed",
      );
      return authenticationFailurePage(context, 400);
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
  let keyProvider;
  try {
    keyProvider = await createWrappedKeyProvider(
      parseVisionKeyEncryptionKey(environment.KEY_ENCRYPTION_KEY),
      new DrizzleWrappedDataKeyStore(database),
      1,
    );
  } catch {
    throw new AuthDependencyInitializationError("database_or_key_unavailable");
  }
  const ownerId = await deriveOwnerId(authEnvironment.GOOGLE_ALLOWED_SUB);
  const admissionKey = await createAuthAdmissionKeyFactory(
    environment.KEY_ENCRYPTION_KEY,
    authEnvironment.VISION_ENV,
  );
  return {
    admissionKey,
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
      fetch,
      new GoogleJwksIdTokenVerifier(fetch),
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
  errorCategory?: "account_not_allowed" | "authentication_failed",
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
    // Auth behavior must not depend on the availability of the safe operational log sink.
  }
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

/** Requires every V1 scope and rejects previously granted broad or event-write scopes. */
function validateGrantedScopes(scopes: readonly string[]): void {
  const normalized = scopes.map((scope) =>
    scope === "https://www.googleapis.com/auth/userinfo.email"
      ? "email"
      : scope,
  );
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
) {
  context.header("Cache-Control", "no-store");
  return context.html(
    "<!doctype html><html><body><h1>Access denied</h1><p>This account cannot use Vision.</p></body></html>",
    403,
  );
}

/** Returns one constant callback failure page without provider, query, or storage detail. */
function authenticationFailurePage(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
  status: 400,
) {
  context.header("Cache-Control", "no-store");
  return context.html(
    "<!doctype html><html><body><h1>Authentication failed</h1><p>Please try again.</p></body></html>",
    status,
  );
}

/** Returns one fixed rate-limit response without an admission key, IP, session, or OAuth value. */
function authStartLimited(
  context: Context<{ Bindings: Env; Variables: AuthRequestVariables }>,
) {
  context.header("Cache-Control", "no-store");
  context.header("Retry-After", "600");
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

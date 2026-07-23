/** Defines opaque session-cookie handling and the authenticated Hono context contract. */
import type { Context } from "hono";
import type { PersistedServerSession } from "../../data/repositories/session-repository";
import { throwVisionError, VisionError } from "../errors";

/** Cookie name for the only opaque Vision browser session bearer. */
export const SESSION_COOKIE_NAME = "vision_session";

/** Bounded server-side session lifetime used for cookie and row expiry. */
export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1_000;

/** Session facts available to authenticated route handlers after server-side lookup. */
export interface AuthenticatedSession extends PersistedServerSession {
  readonly sessionId: string;
}

/** Hono variables extended only after an authenticated server session is resolved. */
export interface AuthRequestVariables {
  requestId: string;
  authenticatedSession?: AuthenticatedSession;
}

/** Returns the resolved session or throws one constant unauthenticated API error. */
export function requireSession(
  context: Pick<Context<{ Variables: AuthRequestVariables }>, "get">,
): AuthenticatedSession {
  const session = context.get("authenticatedSession");
  if (!session) {
    throwVisionError(
      new VisionError("AUTHENTICATION_REQUIRED", 401, "Authentication is required."),
    );
  }
  return session;
}

/** Reads one exact bounded session cookie while rejecting duplicates and malformed cookie pairs. */
export function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header || header.length > 8 * 1024) return undefined;
  const matches = header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (matches.length !== 1) return undefined;
  const value = matches[0]?.slice(SESSION_COOKIE_NAME.length + 1);
  return value && /^[A-Za-z0-9_-]{43,128}$/u.test(value) ? value : undefined;
}

/** Serializes a host-only HttpOnly session cookie with bounded lifetime and environment-aware Secure. */
export function createSessionCookie(
  sessionId: string,
  environment: "local" | "preview" | "production",
  maxAgeSeconds: number,
): string {
  if (
    !/^[A-Za-z0-9_-]{43,128}$/u.test(sessionId) ||
    !Number.isSafeInteger(maxAgeSeconds) ||
    maxAgeSeconds <= 0 ||
    maxAgeSeconds > SESSION_LIFETIME_MS / 1_000
  ) {
    throw new Error("Invalid session cookie input.");
  }
  return [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    environment === "local" ? undefined : "Secure",
    `Max-Age=${maxAgeSeconds}`,
  ].filter(Boolean).join("; ");
}

/** Clears the same host-only cookie scope used by active sessions. */
export function clearSessionCookie(
  environment: "local" | "preview" | "production",
): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    environment === "local" ? undefined : "Secure",
    "Max-Age=0",
  ].filter(Boolean).join("; ");
}

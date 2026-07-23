/** Defines pure allowlist checks for a Google identity that a server has already verified. */

/** The safe, constant denial message returned for every private-pilot identity rejection. */
export const ACCOUNT_NOT_ALLOWED = "ACCOUNT_NOT_ALLOWED";

/** Google claims admitted only after the server verifies the ID token signature and provenance. */
export interface ServerVerifiedGoogleClaims {
  readonly audience: string | readonly string[];
  readonly email: string;
  readonly emailVerified: boolean;
  readonly expiresAt: Date;
  readonly issuer: string;
  readonly sub: string;
}

/** The private-pilot account and token trust configuration retained only on the server. */
export interface IdentityAllowlist {
  readonly email: string;
  readonly sub: string;
  readonly trustedAudience: string;
  readonly trustedIssuer: string;
}

/** The small identity record safe for a server session after allowlist authorization succeeds. */
export interface AuthorizedIdentity {
  readonly email: string;
  readonly subject: string;
}

/** Rejects any identity problem with a constant message that reveals no claim or allowlist value. */
export class IdentityAuthorizationError extends Error {
  constructor() {
    super(ACCOUNT_NOT_ALLOWED);
    this.name = "IdentityAuthorizationError";
  }
}

/**
 * Authorizes one server-verified Google identity against the exact private-pilot allowlist.
 *
 * The OAuth boundary must verify the ID-token signature before constructing `claims`; this pure
 * rule verifies issuer, audience, expiry, subject, verified email, and normalized email matching.
 */
export function authorizeIdentity(
  claims: ServerVerifiedGoogleClaims,
  allowlist: IdentityAllowlist,
  now = new Date(),
): AuthorizedIdentity {
  if (
    claims === null ||
    typeof claims !== "object" ||
    allowlist === null ||
    typeof allowlist !== "object"
  ) {
    throw new IdentityAuthorizationError();
  }
  const normalizedAllowlistedEmail = normalizeEmail(allowlist.email);
  const normalizedClaimEmail = normalizeEmail(claims.email);

  if (
    !isNonEmptyString(claims.sub) ||
    !isNonEmptyString(allowlist.sub) ||
    !isNonEmptyString(allowlist.trustedIssuer) ||
    !isNonEmptyString(allowlist.trustedAudience) ||
    normalizedAllowlistedEmail === undefined ||
    normalizedClaimEmail === undefined ||
    claims.emailVerified !== true ||
    claims.issuer !== allowlist.trustedIssuer ||
    !hasTrustedAudience(claims.audience, allowlist.trustedAudience) ||
    !isUnexpiredAt(claims.expiresAt, now) ||
    claims.sub !== allowlist.sub ||
    normalizedClaimEmail !== normalizedAllowlistedEmail
  ) {
    throw new IdentityAuthorizationError();
  }

  return { email: normalizedAllowlistedEmail, subject: claims.sub };
}

/** Normalizes an email for exact allowlist comparison without accepting an empty value. */
function normalizeEmail(value: unknown): string | undefined {
  if (!isNonEmptyString(value)) {
    return undefined;
  }
  return value.trim().toLowerCase();
}

/** Returns whether a value is a string containing at least one non-whitespace character. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Matches a server-verified OpenID Connect audience against Vision's configured audience. */
function hasTrustedAudience(audience: unknown, trustedAudience: string): boolean {
  return (
    audience === trustedAudience ||
    (Array.isArray(audience) && audience.every((value) => typeof value === "string") && audience.includes(trustedAudience))
  );
}

/** Requires a valid expiry instant strictly later than the injected current server instant. */
function isUnexpiredAt(expiresAt: unknown, now: unknown): boolean {
  return (
    expiresAt instanceof Date &&
    now instanceof Date &&
    !Number.isNaN(expiresAt.getTime()) &&
    !Number.isNaN(now.getTime()) &&
    expiresAt.getTime() > now.getTime()
  );
}

/** Defines pure allowlist checks for a Google identity that a server has already verified. */

/** The safe, constant denial message returned for every private-pilot identity rejection. */
export const ACCOUNT_NOT_ALLOWED = "ACCOUNT_NOT_ALLOWED";

/** Google claims admitted only after the server verifies the ID token signature and provenance. */
export interface ServerVerifiedGoogleClaims {
  readonly audience: string;
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
  const claimSnapshot = snapshotRecord(claims, ["audience", "email", "emailVerified", "expiresAt", "issuer", "sub"]);
  const allowlistSnapshot = snapshotRecord(allowlist, ["email", "sub", "trustedAudience", "trustedIssuer"]);
  const expiresAt = claimSnapshot ? readDateMillis(claimSnapshot.expiresAt) : undefined;
  const currentTime = readDateMillis(now);
  if (!claimSnapshot || !allowlistSnapshot || expiresAt === undefined || currentTime === undefined) {
    throw new IdentityAuthorizationError();
  }
  const normalizedAllowlistedEmail = normalizeEmail(allowlistSnapshot.email);
  const normalizedClaimEmail = normalizeEmail(claimSnapshot.email);

  if (
    !isNonEmptyString(claimSnapshot.sub) ||
    !isNonEmptyString(allowlistSnapshot.sub) ||
    !isNonEmptyString(allowlistSnapshot.trustedIssuer) ||
    !isNonEmptyString(allowlistSnapshot.trustedAudience) ||
    normalizedAllowlistedEmail === undefined ||
    normalizedClaimEmail === undefined ||
    claimSnapshot.emailVerified !== true ||
    claimSnapshot.issuer !== allowlistSnapshot.trustedIssuer ||
    claimSnapshot.audience !== allowlistSnapshot.trustedAudience ||
    expiresAt <= currentTime ||
    claimSnapshot.sub !== allowlistSnapshot.sub ||
    normalizedClaimEmail !== normalizedAllowlistedEmail
  ) {
    throw new IdentityAuthorizationError();
  }

  return Object.freeze({ email: normalizedAllowlistedEmail, subject: claimSnapshot.sub });
}

/** Copies exact enumerable own data properties from a normal object without invoking getters. */
function snapshotRecord(value: unknown, expectedKeys: readonly string[]): Readonly<Record<string, unknown>> | undefined {
  try {
    if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return undefined;
    const names = Object.getOwnPropertyNames(value);
    if (Object.getOwnPropertySymbols(value).length !== 0 || names.length !== expectedKeys.length || !expectedKeys.every((key) => names.includes(key))) return undefined;
    const snapshot: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return undefined;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return undefined;
  }
}

/** Reads a Date's epoch milliseconds through the trusted intrinsic without calling an overridden method. */
function readDateMillis(value: unknown): number | undefined {
  try {
    if (Object.getPrototypeOf(value) !== Date.prototype) return undefined;
    const milliseconds = Date.prototype.getTime.call(value);
    return Number.isNaN(milliseconds) ? undefined : milliseconds;
  } catch {
    return undefined;
  }
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

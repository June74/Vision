/** Builds bounded Google OAuth requests behind injected network and ID-token verification boundaries. */
import { z } from "zod";
import { decodeBase64Url } from "../../crypto/envelope";

/** Exact Version 1 identity and Calendar permissions requested from Google. */
export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.calendars",
  "https://www.googleapis.com/auth/calendar.events.owned.readonly",
] as const;

/** Server-only Google OAuth client configuration. */
export interface GoogleOAuthClientConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

/** Inputs already generated and retained by the server for one authorization transaction. */
export interface GoogleAuthorizationRequest {
  readonly state: string;
  readonly nonce: string;
  readonly codeChallenge: string;
  readonly requestConsent: boolean;
}

/** Narrow cryptographic boundary that verifies a signed ID token before returning its payload. */
export interface IdTokenVerifier {
  verify(idToken: string): Promise<unknown>;
}

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";
const MAX_PROVIDER_RESPONSE_CHARS = 64 * 1024;
const MAX_ID_TOKEN_CHARS = 16 * 1024;
const MAX_JWT_SEGMENT_CHARS = 12 * 1024;
const boundedProviderText = z.string().min(1).max(16 * 1024);
const googleTokenResponseSchema = z.object({
  access_token: boundedProviderText,
  expires_in: z.number().int().positive().max(86_400),
  id_token: boundedProviderText,
  refresh_token: boundedProviderText.optional(),
  scope: z.string().min(1).max(8 * 1024),
  token_type: z.literal("Bearer"),
});
const jwtHeaderSchema = z.object({
  alg: z.literal("RS256"),
  kid: z.string().min(1).max(256),
  typ: z.literal("JWT").optional(),
});
const googleJwksSchema = z.object({
  keys: z.array(
    z.object({
      alg: z.literal("RS256"),
      e: z.string().min(1).max(16),
      kid: z.string().min(1).max(256),
      kty: z.literal("RSA"),
      n: z.string().min(256).max(2_048),
      use: z.literal("sig"),
    }),
  ).min(1).max(32),
});
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const utf8Encoder = new TextEncoder();

/** Validated provider tokens retained only on the trusted server side. */
export interface GoogleTokenSet {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  readonly idToken: string;
  readonly refreshToken?: string;
  readonly scopes: readonly string[];
  readonly tokenType: "Bearer";
}

/** Constant provider-boundary error that never includes request or response content. */
export class GoogleOAuthError extends Error {
  constructor() {
    super("GOOGLE_OAUTH_FAILED");
    this.name = "GoogleOAuthError";
  }
}

/** Constant ID-token verification failure that contains no token, claim, or provider response. */
export class GoogleIdTokenVerificationError extends Error {
  constructor() {
    super("GOOGLE_ID_TOKEN_INVALID");
    this.name = "GoogleIdTokenVerificationError";
  }
}

/** Verifies Google RS256 ID-token signatures against a bounded, cache-aware JWKS response. */
export class GoogleJwksIdTokenVerifier implements IdTokenVerifier {
  private cachedKeys = new Map<string, JsonWebKey>();
  private cacheExpiresAt = 0;

  /** Accepts only the fixed Google key endpoint through an injected fetch implementation. */
  constructor(
    private readonly fetcher: typeof fetch,
    private readonly now: () => number = Date.now,
  ) {}

  /** Verifies the compact JWT signature before decoding and returning its untrusted claim payload. */
  async verify(idToken: string): Promise<unknown> {
    try {
      validateBoundedString(idToken, 1, MAX_ID_TOKEN_CHARS);
      const segments = idToken.split(".");
      if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) {
        throw new GoogleIdTokenVerificationError();
      }
      const [headerSegment, payloadSegment, signatureSegment] = segments as [string, string, string];
      const header = jwtHeaderSchema.parse(parseJwtJson(headerSegment));
      const signingInput = utf8Encoder.encode(`${headerSegment}.${payloadSegment}`);
      const signature = decodeBase64Url(
        signatureSegment,
        "ID-token signature",
        MAX_JWT_SEGMENT_CHARS,
      );

      let key = await this.getKey(header.kid, false);
      let verified = key
        ? await verifyRs256Signature(key, signingInput, signature)
        : false;
      if (!verified) {
        // A single forced refresh handles normal Google key rotation without accepting an unverified payload.
        key = await this.getKey(header.kid, true);
        verified = key
          ? await verifyRs256Signature(key, signingInput, signature)
          : false;
      }
      if (!verified) {
        throw new GoogleIdTokenVerificationError();
      }

      return parseJwtJson(payloadSegment);
    } catch {
      throw new GoogleIdTokenVerificationError();
    }
  }

  /** Resolves a matching signing key, refreshing only when the bounded cache is stale or explicitly bypassed. */
  private async getKey(kid: string, forceRefresh: boolean): Promise<JsonWebKey | undefined> {
    if (forceRefresh || this.now() >= this.cacheExpiresAt || this.cachedKeys.size === 0) {
      await this.refreshKeys();
    }
    return this.cachedKeys.get(kid);
  }

  /** Fetches and snapshots Google's public signing keys without sending any credential or token. */
  private async refreshKeys(): Promise<void> {
    const response = await this.fetcher(GOOGLE_JWKS_ENDPOINT, {
      method: "GET",
      headers: { accept: "application/json" },
    });
    const body = await readBoundedProviderJson(response);
    if (!response.ok) {
      throw new GoogleIdTokenVerificationError();
    }
    const parsed = googleJwksSchema.parse(body);
    this.cachedKeys = new Map(
      parsed.keys.map((key) => [
        key.kid,
        {
          alg: key.alg,
          e: key.e,
          ext: true,
          key_ops: ["verify"],
          kid: key.kid,
          kty: key.kty,
          n: key.n,
          use: key.use,
        },
      ]),
    );
    this.cacheExpiresAt = this.now() + readBoundedCacheLifetime(response.headers.get("cache-control"));
  }
}

/** Minimal Google adapter that never exposes its client secret in authorization URLs. */
export class GoogleOAuthClient {
  private readonly config: GoogleOAuthClientConfig;
  private readonly fetcher: typeof fetch;
  private readonly idTokenVerifier: IdTokenVerifier;

  /** Keeps provider HTTP and signature verification replaceable for deterministic contract tests. */
  constructor(
    config: GoogleOAuthClientConfig,
    fetcher: typeof fetch,
    idTokenVerifier: IdTokenVerifier,
  ) {
    this.config = snapshotClientConfig(config);
    this.fetcher = fetcher;
    this.idTokenVerifier = idTokenVerifier;
  }

  /** Creates an authorization-code request with PKCE S256, offline access, and exact configured redirect URI. */
  createAuthorizationUrl(request: GoogleAuthorizationRequest): string {
    try {
      const input = snapshotAuthorizationRequest(request);
      const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
      url.searchParams.set("client_id", this.config.clientId);
      url.searchParams.set("redirect_uri", this.config.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("include_granted_scopes", "true");
      url.searchParams.set("state", input.state);
      url.searchParams.set("nonce", input.nonce);
      url.searchParams.set("code_challenge", input.codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      if (input.requestConsent) {
        // Google normally returns a refresh token only on first consent; do not force consent on every sign-in.
        url.searchParams.set("prompt", "consent");
      }
      return url.toString();
    } catch {
      throw new GoogleOAuthError();
    }
  }

  /** Exchanges one bounded authorization code through an exact redirect URI and PKCE verifier. */
  async exchangeCode(code: string, codeVerifier: string): Promise<GoogleTokenSet> {
    try {
      validateBoundedString(code, 1, 4_096);
      validateBoundedString(codeVerifier, 43, 128);
      const form = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: this.config.redirectUri,
      });
      const response = await this.fetcher(GOOGLE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      const body = await readBoundedProviderJson(response);
      if (!response.ok) {
        throw new GoogleOAuthError();
      }
      const parsed = googleTokenResponseSchema.parse(body);
      const scopes = parsed.scope.split(" ");
      if (scopes.some((scope) => scope.length === 0 || scope.length > 256)) {
        throw new GoogleOAuthError();
      }

      return {
        accessToken: parsed.access_token,
        expiresInSeconds: parsed.expires_in,
        idToken: parsed.id_token,
        ...(parsed.refresh_token ? { refreshToken: parsed.refresh_token } : {}),
        scopes,
        tokenType: "Bearer",
      };
    } catch {
      throw new GoogleOAuthError();
    }
  }

  /** Delegates cryptographic ID-token verification without parsing claims at the HTTP adapter boundary. */
  async verifyIdToken(idToken: string): Promise<unknown> {
    try {
      validateBoundedString(idToken, 1, MAX_ID_TOKEN_CHARS);
      return await this.idTokenVerifier.verify(idToken);
    } catch {
      throw new GoogleIdTokenVerificationError();
    }
  }
}

/** Snapshots exact client configuration without invoking accessors or retaining a mutable caller object. */
function snapshotClientConfig(config: GoogleOAuthClientConfig): GoogleOAuthClientConfig {
  const snapshot = snapshotExactDataObject(config, [
    "clientId",
    "clientSecret",
    "redirectUri",
  ]);
  if (
    !snapshot ||
    typeof snapshot.clientId !== "string" ||
    snapshot.clientId.length === 0 ||
    snapshot.clientId.length > 512 ||
    typeof snapshot.clientSecret !== "string" ||
    snapshot.clientSecret.length === 0 ||
    snapshot.clientSecret.length > 1_024 ||
    typeof snapshot.redirectUri !== "string" ||
    snapshot.redirectUri.length === 0 ||
    snapshot.redirectUri.length > 2_048
  ) {
    throw new GoogleOAuthError();
  }
  const redirect = new URL(snapshot.redirectUri);
  if (
    !["http:", "https:"].includes(redirect.protocol) ||
    redirect.username ||
    redirect.password ||
    redirect.search ||
    redirect.hash
  ) {
    throw new GoogleOAuthError();
  }
  return Object.freeze({
    clientId: snapshot.clientId,
    clientSecret: snapshot.clientSecret,
    redirectUri: snapshot.redirectUri,
  });
}

/** Snapshots exact PKCE transaction inputs and enforces canonical high-entropy-sized values. */
function snapshotAuthorizationRequest(
  request: GoogleAuthorizationRequest,
): GoogleAuthorizationRequest {
  const snapshot = snapshotExactDataObject(request, [
    "state",
    "nonce",
    "codeChallenge",
    "requestConsent",
  ]);
  const protocolPattern = /^[A-Za-z0-9_-]{43,128}$/u;
  if (
    !snapshot ||
    typeof snapshot.state !== "string" ||
    !protocolPattern.test(snapshot.state) ||
    typeof snapshot.nonce !== "string" ||
    !protocolPattern.test(snapshot.nonce) ||
    typeof snapshot.codeChallenge !== "string" ||
    !protocolPattern.test(snapshot.codeChallenge) ||
    typeof snapshot.requestConsent !== "boolean"
  ) {
    throw new GoogleOAuthError();
  }
  return Object.freeze({
    state: snapshot.state,
    nonce: snapshot.nonce,
    codeChallenge: snapshot.codeChallenge,
    requestConsent: snapshot.requestConsent,
  });
}

/** Copies exact enumerable own data fields from a normal object without reading accessors. */
function snapshotExactDataObject(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.getOwnPropertySymbols(value).length !== 0
    ) {
      return undefined;
    }
    const names = Object.getOwnPropertyNames(value);
    if (names.length !== keys.length || !keys.every((key) => names.includes(key))) {
      return undefined;
    }
    const snapshot: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
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

/** Validates one protocol string without retaining it in an error. */
function validateBoundedString(value: unknown, minimum: number, maximum: number): asserts value is string {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum) {
    throw new GoogleOAuthError();
  }
}

/** Reads one bounded JSON response and discards provider-specific parse and error details. */
async function readBoundedProviderJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_CHARS) {
    throw new GoogleOAuthError();
  }
  const text = await response.text();
  if (text.length > MAX_PROVIDER_RESPONSE_CHARS) {
    throw new GoogleOAuthError();
  }
  return JSON.parse(text) as unknown;
}

/** Parses one canonical bounded JWT JSON segment after signature-related structure checks. */
function parseJwtJson(segment: string): unknown {
  const bytes = decodeBase64Url(segment, "ID-token segment", MAX_JWT_SEGMENT_CHARS);
  return JSON.parse(utf8Decoder.decode(bytes)) as unknown;
}

/** Imports one Google RSA JWK as a non-extractable verification key and checks an RS256 signature. */
async function verifyRs256Signature(
  jwk: JsonWebKey,
  signingInput: Uint8Array<ArrayBuffer>,
  signature: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    signature,
    signingInput,
  );
}

/** Converts only a bounded `max-age` directive into milliseconds for the local public-key cache. */
function readBoundedCacheLifetime(cacheControl: string | null): number {
  const match = /(?:^|,)\s*max-age=(\d+)(?:,|$)/iu.exec(cacheControl ?? "");
  if (!match) {
    return 5 * 60 * 1_000;
  }
  const seconds = Number(match[1]);
  return Number.isSafeInteger(seconds)
    ? Math.min(Math.max(seconds, 60), 6 * 60 * 60) * 1_000
    : 5 * 60 * 1_000;
}

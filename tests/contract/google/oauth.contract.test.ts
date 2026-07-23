import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { VisionDatabase } from "../../../src/data/db";
import { DrizzleSessionStore } from "../../../src/data/repositories/session-repository";
import {
  DrizzleTokenStore,
  DrizzleWrappedDataKeyStore,
} from "../../../src/data/repositories/token-repository";
import {
  GOOGLE_OAUTH_SCOPES,
  GoogleJwksIdTokenVerifier,
  GoogleOAuthClient,
  type IdTokenVerifier,
} from "../../../src/integrations/google/oauth-client";

const redirectUri = "https://vision.example.test/api/auth/google/callback";
const verifier: IdTokenVerifier = { verify: vi.fn() };
const dialect = new PgDialect();

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function encodeJson(value: unknown): string {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

describe("Google OAuth adapter", () => {
  it("creates an exact least-privilege offline authorization request with PKCE and first-consent behavior", () => {
    const client = new GoogleOAuthClient(
      {
        clientId: "client-id.apps.googleusercontent.com",
        clientSecret: "client-secret",
        redirectUri,
      },
      vi.fn(),
      verifier,
    );

    const authorizationUrl = new URL(
      client.createAuthorizationUrl({
        state: "state_abcdefghijklmnopqrstuvwxyz0123456789ABCDE",
        nonce: "nonce_abcdefghijklmnopqrstuvwxyz0123456789ABCDE",
        codeChallenge: "challenge_abcdefghijklmnopqrstuvwxyz0123456789AB",
        requestConsent: true,
      }),
    );

    expect(authorizationUrl.origin + authorizationUrl.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(Object.fromEntries(authorizationUrl.searchParams)).toMatchObject({
      access_type: "offline",
      client_id: "client-id.apps.googleusercontent.com",
      code_challenge: "challenge_abcdefghijklmnopqrstuvwxyz0123456789AB",
      code_challenge_method: "S256",
      include_granted_scopes: "true",
      nonce: "nonce_abcdefghijklmnopqrstuvwxyz0123456789ABCDE",
      prompt: "consent",
      redirect_uri: redirectUri,
      response_type: "code",
      state: "state_abcdefghijklmnopqrstuvwxyz0123456789ABCDE",
    });
    expect(authorizationUrl.searchParams.get("scope")?.split(" ")).toEqual(
      GOOGLE_OAUTH_SCOPES,
    );
    expect(authorizationUrl.searchParams.get("scope")).not.toMatch(
      /(?:^| )https:\/\/www\.googleapis\.com\/auth\/calendar(?: |$)/u,
    );
    expect(authorizationUrl.searchParams.get("scope")).not.toContain(
      "https://www.googleapis.com/auth/calendar.events ",
    );
    expect(authorizationUrl.toString()).not.toContain("client-secret");
  });

  it("rejects hostile or oversized authorization inputs without reflecting them", () => {
    const client = new GoogleOAuthClient(
      {
        clientId: "client-id.apps.googleusercontent.com",
        clientSecret: "client-secret",
        redirectUri,
      },
      vi.fn(),
      verifier,
    );
    const oversized = "SENSITIVE_STATE_".repeat(1_000);
    const hostile = Object.defineProperty(
      {
        nonce: "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
        codeChallenge: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        requestConsent: false,
      },
      "state",
      {
        enumerable: true,
        get: () => {
          throw new Error("HOSTILE_STATE_GETTER");
        },
      },
    );

    for (const request of [
      {
        state: oversized,
        nonce: "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
        codeChallenge: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        requestConsent: false,
      },
      hostile,
    ]) {
      expect(() =>
        client.createAuthorizationUrl(
          request as unknown as Parameters<
            GoogleOAuthClient["createAuthorizationUrl"]
          >[0],
        ),
      ).toThrow("GOOGLE_OAUTH_FAILED");
      expect(() =>
        client.createAuthorizationUrl(
          request as unknown as Parameters<
            GoogleOAuthClient["createAuthorizationUrl"]
          >[0],
        ),
      ).not.toThrow(/SENSITIVE_STATE_|HOSTILE_STATE_GETTER/u);
    }
  });

  it("exchanges a bounded authorization code with the exact redirect and PKCE verifier", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "ACCESS_TOKEN_SENTINEL",
          expires_in: 3600,
          id_token: "SIGNED_ID_TOKEN_SENTINEL",
          refresh_token: "REFRESH_TOKEN_SENTINEL",
          scope: GOOGLE_OAUTH_SCOPES.join(" "),
          token_type: "Bearer",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const client = new GoogleOAuthClient(
      {
        clientId: "client-id.apps.googleusercontent.com",
        clientSecret: "client-secret",
        redirectUri,
      },
      fetcher,
      verifier,
    );

    await expect(
      client.exchangeCode(
        "authorization-code",
        "verifier_abcdefghijklmnopqrstuvwxyz0123456789ABCDE",
      ),
    ).resolves.toEqual({
      accessToken: "ACCESS_TOKEN_SENTINEL",
      expiresInSeconds: 3600,
      idToken: "SIGNED_ID_TOKEN_SENTINEL",
      refreshToken: "REFRESH_TOKEN_SENTINEL",
      scopes: GOOGLE_OAUTH_SCOPES,
      tokenType: "Bearer",
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    });
    const form = new URLSearchParams(init.body as string);
    expect(Object.fromEntries(form)).toEqual({
      client_id: "client-id.apps.googleusercontent.com",
      client_secret: "client-secret",
      code: "authorization-code",
      code_verifier: "verifier_abcdefghijklmnopqrstuvwxyz0123456789ABCDE",
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
  });

  it("cryptographically verifies an RS256 Google ID token through a bounded JWKS fetch", async () => {
    const pair = (await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    const header = encodeJson({ alg: "RS256", kid: "test-key", typ: "JWT" });
    const payload = encodeJson({
      aud: "client-id.apps.googleusercontent.com",
      email: "allowed@example.test",
      email_verified: true,
      exp: 2_000_000_000,
      iss: "https://accounts.google.com",
      nonce: "nonce_abcdefghijklmnopqrstuvwxyz0123456789ABCDE",
      sub: "google-subject",
    });
    const signingInput = `${header}.${payload}`;
    const signature = encodeBase64Url(
      new Uint8Array(
        await crypto.subtle.sign(
          { name: "RSASSA-PKCS1-v1_5" },
          pair.privateKey,
          new TextEncoder().encode(signingInput),
        ),
      ),
    );
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          keys: [{ ...publicJwk, alg: "RS256", kid: "test-key", use: "sig" }],
        }),
        {
          status: 200,
          headers: {
            "cache-control": "public, max-age=3600",
            "content-type": "application/json",
          },
        },
      ),
    );
    const signatureVerifier = new GoogleJwksIdTokenVerifier(fetcher, () => 1_900_000_000_000);

    await expect(signatureVerifier.verify(`${signingInput}.${signature}`)).resolves.toMatchObject({
      sub: "google-subject",
    });
    await expect(
      signatureVerifier.verify(`${header}.${encodeJson({ sub: "attacker" })}.${signature}`),
    ).rejects.toThrow("GOOGLE_ID_TOKEN_INVALID");
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("allowed@example.test");
  });

  it("uses one parameterized consume statement and owner-scoped token statements", async () => {
    const statements: SQL[] = [];
    const rowsByCall: Record<string, unknown>[][] = [
      [
        {
          stateHash: "state-hash",
          verifierEnvelope: "\\x00ff",
          nonceEnvelope: "\\x01fe",
          createdAt: "2026-07-23T12:00:00.000Z",
          expiresAt: "2026-07-23T12:10:00.000Z",
          consumedAt: "2026-07-23T12:01:00.000Z",
        },
      ],
      [
        {
          ownerId: "usr_private_pilot",
          googleSubject: "google-subject",
          refreshTokenEnvelope: "\\x00ff",
          accessTokenEnvelope: "\\x01fe",
          accessExpiresAt: "2026-07-23T13:00:00.000Z",
          grantedScopes: GOOGLE_OAUTH_SCOPES.join(" "),
          tokenVersion: "1",
          updatedAt: "2026-07-23T12:00:00.000Z",
        },
      ],
    ];
    const database = {
      execute: async (statement: SQL) => {
        statements.push(statement);
        return { rows: rowsByCall.shift() ?? [] };
      },
    } as unknown as VisionDatabase;

    await expect(
      new DrizzleSessionStore(database).consumeOAuthTransaction(
        "state-hash",
        new Date("2026-07-23T12:01:00.000Z"),
      ),
    ).resolves.toMatchObject({
      stateHash: "state-hash",
      verifierEnvelope: new Uint8Array([0, 255]),
      nonceEnvelope: new Uint8Array([1, 254]),
    });
    await expect(
      new DrizzleTokenStore(database).find(
        "usr_private_pilot",
        "google-subject",
      ),
    ).resolves.toMatchObject({
      ownerId: "usr_private_pilot",
      googleSubject: "google-subject",
      tokenVersion: 1,
    });

    const consumeSql = dialect
      .sqlToQuery(statements[0] as SQL)
      .sql.replace(/\s+/gu, " ")
      .toLowerCase();
    expect(consumeSql).toContain("update oauth_transactions");
    expect(consumeSql).toContain("consumed_at is null");
    expect(consumeSql).toContain("expires_at >");
    expect(consumeSql).toContain("returning");
    const tokenSql = dialect
      .sqlToQuery(statements[1] as SQL)
      .sql.replace(/\s+/gu, " ")
      .toLowerCase();
    expect(tokenSql).toContain("where owner_id =");
    expect(tokenSql).toContain("and google_subject =");
  });

  it("advances the durable data-key version monotonically for protected auth fields", async () => {
    const statements: SQL[] = [];
    const database = {
      execute: async (statement: SQL) => {
        statements.push(statement);
        return { rows: [{ activeKeyVersion: "2" }] };
      },
    } as unknown as VisionDatabase;
    const store = new DrizzleWrappedDataKeyStore(database);

    await expect(store.activateKeyVersion(2)).resolves.toBe(2);
    const rendered = dialect
      .sqlToQuery(statements[0] as SQL)
      .sql.replace(/\s+/gu, " ")
      .toLowerCase();
    expect(rendered).toContain("insert into data_key_state");
    expect(rendered).toContain("greatest");
    expect(rendered).toContain("returning active_key_version");
  });

  it("migrates only hashed or encrypted auth secrets with expiry and revocation constraints", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0002_google_auth_sessions.sql"),
      "utf8",
    ).toLowerCase();

    for (const table of [
      "oauth_transactions",
      "auth_sessions",
      "google_oauth_tokens",
      "wrapped_data_keys",
      "data_key_state",
    ]) {
      expect(migration).toContain(`create table ${table}`);
    }
    expect(migration).toContain("state_hash text primary key");
    expect(migration).toContain("verifier_envelope bytea not null");
    expect(migration).toContain("nonce_envelope bytea not null");
    expect(migration).toContain("session_id_hash text primary key");
    expect(migration).toContain("csrf_token_envelope bytea not null");
    expect(migration).toContain("refresh_token_envelope bytea not null");
    expect(migration).not.toMatch(/\b(refresh_token|access_token|code_verifier|nonce|csrf_token)\s+text\b/u);
    expect(migration).toContain("check (expires_at > created_at)");
    expect(migration).toContain("check (token_version > 0)");
  });
});

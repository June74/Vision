import { describe, expect, it, vi } from "vitest";
import { SELF } from "cloudflare:test";
import type { KeyProvider } from "../../src/crypto/key-provider";
import {
  EncryptedSessionRepository,
  type OAuthTransactionRow,
  type ServerSessionRow,
  type SessionStore,
} from "../../src/data/repositories/session-repository";
import {
  EncryptedTokenRepository,
  type GoogleTokenRow,
  type GoogleTokenWriteRow,
  type TokenStore,
} from "../../src/data/repositories/token-repository";
import {
  GOOGLE_OAUTH_SCOPES,
  GoogleOAuthClient,
  type IdTokenVerifier,
} from "../../src/integrations/google/oauth-client";
import type { Env } from "../../src/server/env";
import { createApp } from "../../src/worker";

const now = new Date("2026-07-23T12:00:00.000Z");
const state = "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS";
const verifier = "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
const nonce = "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN";

class MemorySessionStore implements SessionStore {
  readonly oauthRows: OAuthTransactionRow[] = [];
  readonly sessionRows: ServerSessionRow[] = [];
  readonly admissionWindows = new Map<
    string,
    { requestCount: number; windowStartedAt: Date }
  >();

  async cleanupOAuthState(
    cleanedAt: Date,
    staleWindowAt: Date,
    limit: number,
  ) {
    const removable = this.oauthRows
      .filter(
        (row) => row.expiresAt <= cleanedAt || row.consumedAt !== null,
      )
      .slice(0, limit);
    for (const row of removable) {
      this.oauthRows.splice(this.oauthRows.indexOf(row), 1);
    }
    const staleKeys = [...this.admissionWindows]
      .filter(([, window]) => window.windowStartedAt <= staleWindowAt)
      .slice(0, limit)
      .map(([key]) => key);
    for (const key of staleKeys) this.admissionWindows.delete(key);
    return {
      transactionsDeleted: removable.length,
      windowsDeleted: staleKeys.length,
    };
  }

  async admitOAuthStart(
    admissionKeyHash: string,
    admittedAt: Date,
    windowMs: number,
    maximum: number,
  ): Promise<boolean> {
    const existing = this.admissionWindows.get(admissionKeyHash);
    if (
      !existing ||
      existing.windowStartedAt.getTime() + windowMs <= admittedAt.getTime()
    ) {
      this.admissionWindows.set(admissionKeyHash, {
        requestCount: 1,
        windowStartedAt: new Date(admittedAt),
      });
      return true;
    }
    if (existing.requestCount >= maximum) return false;
    existing.requestCount += 1;
    return true;
  }

  async insertOAuthTransaction(
    row: Omit<OAuthTransactionRow, "admissionSlot">,
  ): Promise<boolean> {
    if (this.oauthRows.some((candidate) => candidate.stateHash === row.stateHash)) {
      return false;
    }
    const occupied = new Set(
      this.oauthRows
        .filter(
          (candidate) =>
            candidate.admissionKeyHash === row.admissionKeyHash,
        )
        .map((candidate) => candidate.admissionSlot),
    );
    const admissionSlot = [1, 2, 3].find((slot) => !occupied.has(slot));
    if (!admissionSlot) return false;
    this.oauthRows.push(structuredClone({ ...row, admissionSlot }));
    return true;
  }

  async consumeOAuthTransaction(
    stateHash: string,
    consumedAt: Date,
  ): Promise<OAuthTransactionRow | undefined> {
    const row = this.oauthRows.find(
      (candidate) =>
        candidate.stateHash === stateHash &&
        candidate.consumedAt === null &&
        candidate.expiresAt > consumedAt,
    );
    if (!row) return undefined;
    this.oauthRows.splice(this.oauthRows.indexOf(row), 1);
    return structuredClone({ ...row, consumedAt });
  }

  async insertSession(row: ServerSessionRow): Promise<void> {
    this.sessionRows.push(structuredClone(row));
  }

  async findSession(sessionIdHash: string, activeAt: Date): Promise<ServerSessionRow | undefined> {
    const row = this.sessionRows.find(
      (candidate) =>
        candidate.sessionIdHash === sessionIdHash &&
        candidate.revokedAt === null &&
        candidate.expiresAt > activeAt,
    );
    return row ? structuredClone(row) : undefined;
  }

  async revokeSession(sessionIdHash: string, revokedAt: Date): Promise<boolean> {
    const row = this.sessionRows.find(
      (candidate) =>
        candidate.sessionIdHash === sessionIdHash &&
        candidate.revokedAt === null,
    );
    if (!row) return false;
    row.revokedAt = revokedAt;
    return true;
  }
}

class MemoryTokenStore implements TokenStore {
  readonly rows: GoogleTokenRow[] = [];

  async find(ownerId: string, googleSubject: string): Promise<GoogleTokenRow | undefined> {
    const row = this.rows.find(
      (candidate) =>
        candidate.ownerId === ownerId && candidate.googleSubject === googleSubject,
    );
    return row ? structuredClone(row) : undefined;
  }

  async upsert(row: GoogleTokenWriteRow): Promise<GoogleTokenRow> {
    const existing = this.rows.find(
      (candidate) =>
        candidate.ownerId === row.ownerId &&
        candidate.googleSubject === row.googleSubject,
    );
    if (!existing && (!row.refreshTokenEnvelope || !row.refreshTokenDigest)) {
      throw new Error("Token upsert lost owner-subject scope.");
    }
    const distinctRefresh =
      row.refreshTokenDigest !== null &&
      row.refreshTokenDigest !== existing?.refreshTokenDigest;
    const persisted = structuredClone({
      ...row,
      refreshTokenEnvelope:
        row.refreshTokenEnvelope && distinctRefresh
          ? row.refreshTokenEnvelope
          : existing?.refreshTokenEnvelope ?? row.refreshTokenEnvelope!,
      refreshTokenDigest:
        row.refreshTokenDigest ?? existing?.refreshTokenDigest ?? "",
      tokenVersion: existing
        ? existing.tokenVersion + (distinctRefresh ? 1 : 0)
        : 1,
    });
    if (existing) {
      this.rows.splice(this.rows.indexOf(existing), 1, persisted);
    } else {
      this.rows.push(persisted);
    }
    return structuredClone(persisted);
  }
}

async function createKeyProvider(): Promise<KeyProvider> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return {
    getDataKey: async () => ({ key, keyVersion: 1 }),
  };
}

async function createHarness(options: {
  dynamicProtocolValues?: boolean;
  environment?: "local" | "preview" | "production";
  claims?: unknown;
  tokenResponse?: unknown;
} = {}) {
  const keyProvider = await createKeyProvider();
  const sessionStore = new MemorySessionStore();
  const tokenStore = new MemoryTokenStore();
  const sessions = new EncryptedSessionRepository(sessionStore, keyProvider);
  const tokens = new EncryptedTokenRepository(
    tokenStore,
    keyProvider,
    "usr_private_pilot",
  );
  const idTokenVerifier: IdTokenVerifier = {
    verify: vi.fn().mockResolvedValue(
      options.claims ?? {
        aud: "client-id.apps.googleusercontent.com",
        email: "allowed@example.test",
        email_verified: true,
        exp: Math.floor(now.getTime() / 1_000) + 3_600,
        iss: "https://accounts.google.com",
        nonce,
        sub: "google-subject",
      },
    ),
  };
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify(
        options.tokenResponse ?? {
          access_token: "ACCESS_TOKEN_SENTINEL",
          expires_in: 3_600,
          id_token: "SIGNED_ID_TOKEN_SENTINEL",
          refresh_token: "REFRESH_TOKEN_SENTINEL",
          scope: GOOGLE_OAUTH_SCOPES.join(" "),
          token_type: "Bearer",
        },
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
  const oauthClient = new GoogleOAuthClient(
    {
      clientId: "client-id.apps.googleusercontent.com",
      clientSecret: "CLIENT_SECRET_SENTINEL",
      redirectUri: "https://vision.example.test/api/auth/google/callback",
    },
    fetcher,
    idTokenVerifier,
  );
  const logger = vi.fn();
  let protocolValueIndex = 0;
  const app = createApp({
    auth: {
      admissionKey: async () =>
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      environment: options.environment ?? "preview",
      identityAllowlist: {
        email: "allowed@example.test",
        sub: "google-subject",
        trustedAudience: "client-id.apps.googleusercontent.com",
        trustedIssuer: "https://accounts.google.com",
      },
      logger,
      now: () => now,
      oauthClient,
      ownerId: "usr_private_pilot",
      randomToken: (purpose) => {
        if (options.dynamicProtocolValues) {
          const alphabet =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
          const character = alphabet[protocolValueIndex % alphabet.length]!;
          protocolValueIndex += 1;
          return character.repeat(43);
        }
        return ({
          csrfToken: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
          nonce,
          pkceVerifier: verifier,
          sessionId: "IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII",
          state,
        })[purpose];
      },
      sessions,
      tokens,
    },
    createRequestId: () => "req_auth",
    logger,
  });
  return {
    app,
    fetcher,
    idTokenVerifier,
    logger,
    sessionStore,
    sessions,
    tokenStore,
    tokens,
  };
}

describe("Vision Worker Google authentication", () => {
  it("keeps auth routes present and fails safely when server bindings are not configured", async () => {
    const response = await SELF.fetch(
      "https://vision.example.test/api/auth/google/start",
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "AUTHENTICATION_FAILED",
        message: "Authentication is temporarily unavailable.",
      },
    });
  });

  it("starts OAuth with server-retained state, verifier, and nonce but no browser-readable secret record", async () => {
    const { app, sessionStore } = await createHarness();

    const response = await app.fetch(
      new Request("https://attacker-host.test/api/auth/google/start"),
      {} as Env,
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") as string);
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://vision.example.test/api/auth/google/callback",
    );
    expect(location.searchParams.get("state")).toBe(state);
    expect(location.searchParams.get("nonce")).toBe(nonce);
    expect(location.searchParams.get("prompt")).toBe("consent");
    expect(location.searchParams.get("code_challenge")).not.toBe(verifier);
    expect(response.headers.get("set-cookie")).toBeNull();

    const rawRows = JSON.stringify(sessionStore.oauthRows);
    expect(rawRows).not.toContain(state);
    expect(rawRows).not.toContain(verifier);
    expect(rawRows).not.toContain(nonce);
    expect(rawRows).not.toContain("CLIENT_SECRET_SENTINEL");
  });

  it("returns one identifier-free 429 after the strict auth-start window is exhausted", async () => {
    const { app, logger, sessionStore } = await createHarness({
      dynamicProtocolValues: true,
    });
    const responses: Response[] = [];

    for (let index = 0; index < 4; index += 1) {
      responses.push(
        await app.fetch(
          new Request("https://vision.example.test/api/auth/google/start"),
          {} as Env,
        ),
      );
    }

    expect(responses.slice(0, 3).every((response) => response.status === 302)).toBe(
      true,
    );
    expect(responses[3]?.status).toBe(429);
    expect(responses[3]?.headers.get("retry-after")).toBe("600");
    await expect(responses[3]?.json()).resolves.toEqual({
      error: {
        code: "AUTH_START_LIMITED",
        message: "Please wait before trying to sign in again.",
      },
    });
    const output = `${JSON.stringify(logger.mock.calls)}${JSON.stringify(
      sessionStore.oauthRows,
    )}`;
    expect(output).not.toContain(
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    );
  });

  it("does not spend a session lookup on an unadmitted start cookie", async () => {
    const { app, sessionStore } = await createHarness();
    const findSession = vi.spyOn(sessionStore, "findSession");

    const response = await app.fetch(
      new Request("https://vision.example.test/api/auth/google/start", {
        headers: {
          cookie:
            "vision_session=FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
        },
      }),
      {} as Env,
    );

    expect(response.status).toBe(302);
    expect(findSession).not.toHaveBeenCalled();
  });

  it("consumes the callback once, allowlists verified claims, encrypts tokens, and creates a secure server session", async () => {
    const { app, logger, sessionStore, tokenStore } = await createHarness();
    await app.fetch(
      new Request("https://vision.example.test/api/auth/google/start"),
      {} as Env,
    );

    const callback = await app.fetch(
      new Request(
        `https://vision.example.test/api/auth/google/callback?code=authorization-code&state=${state}`,
      ),
      {} as Env,
    );

    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("/");
    const setCookie = callback.headers.get("set-cookie") as string;
    expect(setCookie).toContain("vision_session=IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toMatch(/Max-Age=\d+/u);
    expect(setCookie).not.toContain("REFRESH_TOKEN_SENTINEL");
    expect(setCookie).not.toContain("ACCESS_TOKEN_SENTINEL");

    expect(sessionStore.oauthRows).toHaveLength(0);
    expect(sessionStore.sessionRows).toHaveLength(1);
    expect(tokenStore.rows).toHaveLength(1);
    expect(tokenStore.rows[0]).toMatchObject({
      googleSubject: "google-subject",
      grantedScopes: GOOGLE_OAUTH_SCOPES.join(" "),
      ownerId: "usr_private_pilot",
      tokenVersion: 1,
    });

    const cookie = setCookie.split(";")[0];
    const sessionResponse = await app.fetch(
      new Request("https://vision.example.test/api/auth/session", {
        headers: { cookie },
      }),
      {} as Env,
    );
    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toEqual({
      authenticated: true,
      csrfToken: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      email: "allowed@example.test",
      expiresAt: "2026-07-23T20:00:00.000Z",
    });

    const persistedText = JSON.stringify({
      oauth: sessionStore.oauthRows,
      sessions: sessionStore.sessionRows,
      tokens: tokenStore.rows,
    });
    for (const secret of [
      state,
      verifier,
      nonce,
      "IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII",
      "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      "REFRESH_TOKEN_SENTINEL",
      "ACCESS_TOKEN_SENTINEL",
    ]) {
      expect(persistedText).not.toContain(secret);
      expect(JSON.stringify(logger.mock.calls)).not.toContain(secret);
    }
  });

  it("requires the server-bound CSRF token for logout, then revokes the session and clears its cookie", async () => {
    const { app } = await createHarness();
    await app.fetch(
      new Request("https://vision.example.test/api/auth/google/start"),
      {} as Env,
    );
    const callback = await app.fetch(
      new Request(
        `https://vision.example.test/api/auth/google/callback?code=authorization-code&state=${state}`,
      ),
      {} as Env,
    );
    const cookie = (callback.headers.get("set-cookie") as string).split(";")[0];

    const missingCsrf = await app.fetch(
      new Request("https://vision.example.test/api/auth/logout", {
        method: "POST",
        headers: { cookie },
      }),
      {} as Env,
    );
    expect(missingCsrf.status).toBe(403);

    const wrongCsrf = await app.fetch(
      new Request("https://vision.example.test/api/auth/logout", {
        method: "POST",
        headers: {
          cookie,
          "x-vision-csrf": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        },
      }),
      {} as Env,
    );
    expect(wrongCsrf.status).toBe(403);

    const logout = await app.fetch(
      new Request("https://vision.example.test/api/auth/logout", {
        method: "POST",
        headers: {
          cookie,
          "x-vision-csrf": "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
        },
      }),
      {} as Env,
    );
    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie")).toContain("vision_session=");
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(logout.headers.get("set-cookie")).toContain("Secure");

    const afterLogout = await app.fetch(
      new Request("https://vision.example.test/api/auth/session", {
        headers: { cookie },
      }),
      {} as Env,
    );
    expect(afterLogout.status).toBe(401);
  });

  it("rejects every invalid signed identity dimension before token or session persistence", async () => {
    const validClaims = {
      aud: "client-id.apps.googleusercontent.com",
      email: "allowed@example.test",
      email_verified: true,
      exp: Math.floor(now.getTime() / 1_000) + 3_600,
      iss: "https://accounts.google.com",
      nonce,
      sub: "google-subject",
    };
    const cases: unknown[] = [
      { ...validClaims, iss: "https://attacker.example" },
      { ...validClaims, aud: "other-client.apps.googleusercontent.com" },
      { ...validClaims, aud: ["client-id.apps.googleusercontent.com"] },
      { ...validClaims, nonce: "ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ" },
      { ...validClaims, sub: "other-subject" },
      { ...validClaims, email: "other@example.test" },
      { ...validClaims, email_verified: false },
      { ...validClaims, exp: Math.floor(now.getTime() / 1_000) },
    ];

    for (const claims of cases) {
      const { app, logger, sessionStore, tokenStore } = await createHarness({
        claims,
      });
      await app.fetch(
        new Request("https://vision.example.test/api/auth/google/start"),
        {} as Env,
      );
      const response = await app.fetch(
        new Request(
          `https://vision.example.test/api/auth/google/callback?code=authorization-code&state=${state}`,
        ),
        {} as Env,
      );
      expect([400, 403]).toContain(response.status);
      expect(sessionStore.sessionRows).toHaveLength(0);
      expect(tokenStore.rows).toHaveLength(0);
      const output = `${await response.text()}${JSON.stringify(logger.mock.calls)}`;
      expect(output).not.toContain("other@example.test");
      expect(output).not.toContain("other-subject");
      expect(output).not.toContain("attacker.example");
    }
  });

  it("binds callback state to one transaction and rejects duplicate parameters and replay", async () => {
    const { app, fetcher, logger, sessionStore, tokenStore } = await createHarness();
    await app.fetch(
      new Request("https://vision.example.test/api/auth/google/start"),
      {} as Env,
    );

    const mismatch = await app.fetch(
      new Request(
        "https://vision.example.test/api/auth/google/callback?code=authorization-code&state=MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM",
      ),
      {} as Env,
    );
    expect(mismatch.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.callback",
        errorCategory: "authentication_failed",
        outcome: "failed",
      }),
    );
    expect(JSON.stringify(logger.mock.calls)).not.toContain(
      "MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM",
    );

    const duplicate = await app.fetch(
      new Request(
        `https://vision.example.test/api/auth/google/callback?code=authorization-code&state=${state}&state=${state}`,
      ),
      {} as Env,
    );
    expect(duplicate.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();

    const accepted = await app.fetch(
      new Request(
        `https://vision.example.test/api/auth/google/callback?code=authorization-code&state=${state}`,
      ),
      {} as Env,
    );
    expect(accepted.status).toBe(302);
    expect(fetcher).toHaveBeenCalledTimes(1);

    const replay = await app.fetch(
      new Request(
        `https://vision.example.test/api/auth/google/callback?code=authorization-code&state=${state}`,
      ),
      {} as Env,
    );
    expect(replay.status).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(sessionStore.sessionRows).toHaveLength(1);
    expect(tokenStore.rows).toHaveLength(1);
  });

  it("reuses an encrypted refresh token without repeated consent and omits Secure only for local cookies", async () => {
    const { app, tokens } = await createHarness({
      environment: "local",
      tokenResponse: {
        access_token: "ACCESS_TOKEN_SENTINEL",
        expires_in: 3_600,
        id_token: "SIGNED_ID_TOKEN_SENTINEL",
        scope: GOOGLE_OAUTH_SCOPES.join(" "),
        token_type: "Bearer",
      },
    });
    await tokens.saveGoogleTokens({
      googleSubject: "google-subject",
      refreshToken: "EXISTING_REFRESH_TOKEN_SENTINEL",
      accessToken: null,
      accessExpiresAt: now,
      grantedScopes: GOOGLE_OAUTH_SCOPES,
      updatedAt: now,
    });
    const start = await app.fetch(
      new Request("http://localhost/api/auth/google/start"),
      {} as Env,
    );
    const location = new URL(start.headers.get("location") as string);
    expect(location.searchParams.get("prompt")).toBeNull();

    const callback = await app.fetch(
      new Request(
        `http://localhost/api/auth/google/callback?code=authorization-code&state=${state}`,
      ),
      {} as Env,
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get("set-cookie")).not.toContain("Secure");
  });

  it("rotates an existing session after callback instead of reusing its bearer", async () => {
    const { app, sessionStore, sessions } = await createHarness();
    const oldSessionId = "OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO";
    await sessions.createSession({
      sessionId: oldSessionId,
      ownerId: "usr_private_pilot",
      googleSubject: "google-subject",
      email: "allowed@example.test",
      csrfToken: "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    await app.fetch(
      new Request("https://vision.example.test/api/auth/google/start"),
      {} as Env,
    );
    const response = await app.fetch(
      new Request(
        `https://vision.example.test/api/auth/google/callback?code=authorization-code&state=${state}`,
        { headers: { cookie: `vision_session=${oldSessionId}` } },
      ),
      {} as Env,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("set-cookie")).not.toContain(oldSessionId);
    expect(sessionStore.sessionRows[0]?.revokedAt).toEqual(now);
    expect(sessionStore.sessionRows[1]?.revokedAt).toBeNull();
  });

  it("rejects provider grants outside the approved Version 1 scope set", async () => {
    const { app, sessionStore, tokenStore } = await createHarness({
      tokenResponse: {
        access_token: "ACCESS_TOKEN_SENTINEL",
        expires_in: 3_600,
        id_token: "SIGNED_ID_TOKEN_SENTINEL",
        refresh_token: "REFRESH_TOKEN_SENTINEL",
        scope: `${GOOGLE_OAUTH_SCOPES.join(" ")} https://www.googleapis.com/auth/drive.readonly`,
        token_type: "Bearer",
      },
    });
    await app.fetch(
      new Request("https://vision.example.test/api/auth/google/start"),
      {} as Env,
    );
    const response = await app.fetch(
      new Request(
        `https://vision.example.test/api/auth/google/callback?code=authorization-code&state=${state}`,
      ),
      {} as Env,
    );

    expect(response.status).toBe(400);
    expect(sessionStore.sessionRows).toHaveLength(0);
    expect(tokenStore.rows).toHaveLength(0);
  });

  it("logs a privacy-safe callback stage when Google's token exchange fails", async () => {
    const { app, logger } = await createHarness({
      tokenResponse: {
        error: "invalid_grant",
        error_description: "SENSITIVE_PROVIDER_DETAIL",
      },
    });
    await app.fetch(
      new Request("https://vision.example.test/api/auth/google/start"),
      {} as Env,
    );

    const response = await app.fetch(
      new Request(
        `https://vision.example.test/api/auth/google/callback?code=authorization-code&state=${state}`,
      ),
      {} as Env,
    );

    expect(response.status).toBe(400);
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.callback",
        errorCategory: "token_exchange_failed",
        outcome: "failed",
      }),
    );
    expect(JSON.stringify(logger.mock.calls)).not.toContain(
      "SENSITIVE_PROVIDER_DETAIL",
    );
  });
});

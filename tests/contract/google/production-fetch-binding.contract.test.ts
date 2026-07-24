import { neonConfig } from "@neondatabase/serverless";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GOOGLE_OAUTH_SCOPES } from "../../../src/integrations/google/oauth-client";
import { createProductionCalendarSetupDependencies } from "../../../src/server/api/calendar-setup-routes";
import { createProductionAuthDependencies } from "../../../src/server/auth/oauth-routes";
import type { Env } from "../../../src/server/env";

const originalNeonFetch = neonConfig.fetchFunction;
const environment = {
  ASSETS: {} as Fetcher,
  DATABASE_URL: "postgresql://vision_app:secret@db.example.test/vision",
  GOOGLE_ALLOWED_EMAIL: "allowed@example.test",
  GOOGLE_ALLOWED_SUB: "google-subject",
  GOOGLE_CLIENT_ID: "vision-preview-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "CLIENT_SECRET_SENTINEL",
  GOOGLE_REDIRECT_URI:
    "https://vision.example.test/api/auth/google/callback",
  KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  VISION_ENV: "preview",
  VISION_USER_TIME_ZONE: "America/Chicago",
} satisfies Env;

beforeEach(() => {
  neonConfig.fetchFunction = async () =>
    jsonResponse({
      command: "INSERT",
      fields: [{ name: "activeKeyVersion", dataTypeID: 23 }],
      rowAsArray: true,
      rowCount: 1,
      rows: [["1"]],
    });
});

afterEach(() => {
  neonConfig.fetchFunction = originalNeonFetch;
  vi.unstubAllGlobals();
});

describe("production provider fetch binding", () => {
  it("preserves the global receiver for OAuth token exchange", async () => {
    const fetcher = receiverSensitiveFetch(() =>
      jsonResponse({
        access_token: "ACCESS_TOKEN_SENTINEL",
        expires_in: 3_600,
        id_token: "SIGNED_ID_TOKEN_SENTINEL",
        refresh_token: "REFRESH_TOKEN_SENTINEL",
        scope: GOOGLE_OAUTH_SCOPES.join(" "),
        token_type: "Bearer",
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const dependencies = await createProductionAuthDependencies(
      environment,
      vi.fn(),
    );

    await expect(
      dependencies.oauthClient.exchangeCode(
        "authorization-code",
        "V".repeat(43),
      ),
    ).resolves.toMatchObject({
      accessToken: "ACCESS_TOKEN_SENTINEL",
      tokenType: "Bearer",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("preserves the global receiver for Google JWKS verification", async () => {
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
    const payload = encodeJson({ sub: "google-subject" });
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
    const fetcher = receiverSensitiveFetch(
      () =>
        new Response(
          JSON.stringify({
            keys: [
              { ...publicJwk, alg: "RS256", kid: "test-key", use: "sig" },
            ],
          }),
          {
            headers: {
              "cache-control": "public, max-age=3600",
              "content-type": "application/json",
            },
            status: 200,
          },
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    const dependencies = await createProductionAuthDependencies(
      environment,
      vi.fn(),
    );

    await expect(
      dependencies.oauthClient.verifyIdToken(
        `${signingInput}.${signature}`,
      ),
    ).resolves.toMatchObject({ sub: "google-subject" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("preserves the global receiver for Calendar API requests", async () => {
    const fetcher = receiverSensitiveFetch(() => jsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetcher);
    const dependencies = await createProductionCalendarSetupDependencies(
      environment,
      vi.fn(),
    );

    await expect(
      dependencies
        .createCalendarClient("ACCESS_TOKEN_SENTINEL", "google-subject")
        .listOwnedSecondaryCalendars(),
    ).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

function receiverSensitiveFetch(
  response: () => Response,
): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>(function (this: unknown) {
    if (this !== globalThis) {
      return Promise.reject(new Error("Global fetch receiver was lost."));
    }
    return Promise.resolve(response());
  });
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function encodeJson(value: unknown): string {
  return encodeBase64Url(
    new TextEncoder().encode(JSON.stringify(value)),
  );
}

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

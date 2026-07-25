import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AiBudgetEnvSchema,
  GoogleAuthEnvSchema,
  OpenAiEnvSchema,
  RuntimeEnvSchema,
} from "../../../src/server/env";

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

describe("RuntimeEnvSchema", () => {
  it("rejects a missing deployment environment", () => {
    expect(() => RuntimeEnvSchema.parse({})).toThrow();
  });

  it("accepts only a database URL authenticated as the vision application role", () => {
    expect(
      RuntimeEnvSchema.parse({
        VISION_ENV: "preview",
        DATABASE_URL: "postgresql://vision_app:secret@db.example.test/vision",
        KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      }),
    ).toMatchObject({ VISION_ENV: "preview" });
  });

  it("rejects a privileged database URL without exposing its secret", () => {
    const privilegedUrl = "postgresql://neondb_owner:private-password@db.example.test/vision";

    const environment = {
      VISION_ENV: "production",
      DATABASE_URL: privilegedUrl,
      KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    };

    expect(() => RuntimeEnvSchema.parse(environment)).toThrow(/vision_app/i);
    expect(() => RuntimeEnvSchema.parse(environment)).not.toThrow(privilegedUrl);
  });

  it("accepts only a canonical unpadded base64url 256-bit root wrapping key", () => {
    const environment = {
      VISION_ENV: "production",
      DATABASE_URL: "postgresql://vision_app:secret@db.example.test/vision",
    };

    const finalCharacters = new Set<string>();
    for (let finalNibble = 0; finalNibble < 16; finalNibble += 1) {
      const bytes = new Uint8Array(32);
      bytes[31] = finalNibble;
      const encoded = encodeBase64Url(bytes);
      finalCharacters.add(encoded.at(-1) as string);
      expect(() => RuntimeEnvSchema.parse({ ...environment, KEY_ENCRYPTION_KEY: encoded })).not.toThrow();
    }

    expect([...finalCharacters].join("")).toBe("AEIMQUYcgkosw048");
    expect(() => RuntimeEnvSchema.parse({ ...environment, KEY_ENCRYPTION_KEY: "too-short" })).toThrow(
      /256-bit base64url/u,
    );
    expect(() =>
      RuntimeEnvSchema.parse({
        ...environment,
        KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB",
      }),
    ).toThrow(/256-bit base64url/u);
    expect(() =>
      RuntimeEnvSchema.parse({
        ...environment,
        KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      }),
    ).toThrow(/256-bit base64url/u);
    expect(() =>
      RuntimeEnvSchema.parse({
        ...environment,
        KEY_ENCRYPTION_KEY: "secret-root-key-that-must-never-appear-in-errors",
      }),
    ).not.toThrow(/secret-root-key-that-must-never-appear-in-errors/u);
  });
});

describe("GoogleAuthEnvSchema", () => {
  it("requires bounded server-only OAuth configuration and an HTTPS redirect outside local", () => {
    expect(
      GoogleAuthEnvSchema.parse({
        VISION_ENV: "production",
        GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "CLIENT_SECRET_SENTINEL",
        GOOGLE_REDIRECT_URI:
          "https://vision.example.test/api/auth/google/callback",
        GOOGLE_ALLOWED_SUB: "google-subject",
        GOOGLE_ALLOWED_EMAIL: "allowed@example.test",
      }),
    ).toMatchObject({
      GOOGLE_ALLOWED_EMAIL: "allowed@example.test",
      GOOGLE_REDIRECT_URI:
        "https://vision.example.test/api/auth/google/callback",
    });

    const insecure = {
      VISION_ENV: "production",
      GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "CLIENT_SECRET_SENTINEL",
      GOOGLE_REDIRECT_URI:
        "http://vision.example.test/api/auth/google/callback",
      GOOGLE_ALLOWED_SUB: "google-subject",
      GOOGLE_ALLOWED_EMAIL: "allowed@example.test",
    };
    expect(() => GoogleAuthEnvSchema.parse(insecure)).toThrow(/https/iu);
    expect(() => GoogleAuthEnvSchema.parse(insecure)).not.toThrow(
      /CLIENT_SECRET_SENTINEL/u,
    );
  });
});

describe("OpenAiEnvSchema", () => {
  it("accepts only the injected server-side gateway and provider credential pair", () => {
    expect(
      OpenAiEnvSchema.parse({
        OPENAI_GATEWAY_BASE_URL:
          "https://gateway.ai.cloudflare.com/v1/0123456789abcdef0123456789abcdef/vision-preview/openai",
        OPENAI_API_KEY: "OPENAI_PROVIDER_SECRET_SENTINEL",
      }),
    ).toMatchObject({
      OPENAI_GATEWAY_BASE_URL:
        "https://gateway.ai.cloudflare.com/v1/0123456789abcdef0123456789abcdef/vision-preview/openai",
    });

    for (const gatewayBaseUrl of [
      "http://gateway.example.test/openai",
      "https://user:password@gateway.example.test/openai",
      "https://gateway.example.test/openai?secret=query",
      "https://gateway.ai.cloudflare.com.evil.test/v1/0123456789abcdef0123456789abcdef/vision-preview/openai",
      "https://gateway.ai.cloudflare.com/v1/0123456789abcdef0123456789abcdef/vision-preview/openai/responses",
      "https://gateway.ai.cloudflare.com/v1/0123456789abcdef0123456789abcdef/vision%2Fpreview/openai",
    ]) {
      expect(() =>
        OpenAiEnvSchema.parse({
          OPENAI_GATEWAY_BASE_URL: gatewayBaseUrl,
          OPENAI_API_KEY: "OPENAI_PROVIDER_SECRET_SENTINEL",
        }),
      ).toThrow(/canonical Cloudflare OpenAI gateway/u);
      expect(() =>
        OpenAiEnvSchema.parse({
          OPENAI_GATEWAY_BASE_URL: gatewayBaseUrl,
          OPENAI_API_KEY: "OPENAI_PROVIDER_SECRET_SENTINEL",
        }),
      ).not.toThrow(/OPENAI_PROVIDER_SECRET_SENTINEL/u);
    }
  });

  it("rejects a partially configured runtime adapter", () => {
    const runtime = {
      VISION_ENV: "preview",
      DATABASE_URL: "postgresql://vision_app:secret@db.example.test/vision",
      KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    };

    expect(() =>
      RuntimeEnvSchema.parse({
        ...runtime,
        OPENAI_GATEWAY_BASE_URL:
          "https://gateway.ai.cloudflare.com/v1/0123456789abcdef0123456789abcdef/vision-preview/openai",
      }),
    ).toThrow(/configured together/u);
    expect(() =>
      RuntimeEnvSchema.parse({
        ...runtime,
        OPENAI_API_KEY: "OPENAI_PROVIDER_SECRET_SENTINEL",
      }),
    ).toThrow(/configured together/u);
  });
});

describe("AiBudgetEnvSchema", () => {
  it("pins the Worker-side Gateway limit contract to 950 cents", () => {
    const wrangler = JSON.parse(
      readFileSync(resolve(process.cwd(), "wrangler.jsonc"), "utf8"),
    ) as { vars?: Record<string, string> };

    expect(wrangler.vars?.AI_MONTHLY_HARD_LIMIT_CENTS).toBe("950");
  });

  it("accepts only an injected price contract with the exact 950-cent Gateway barrier", () => {
    expect(
      AiBudgetEnvSchema.parse({
        AI_MONTHLY_HARD_LIMIT_CENTS: "950",
        AI_INPUT_CENTS_PER_MILLION_TOKENS: "1000",
        AI_OUTPUT_CENTS_PER_MILLION_TOKENS: "4000",
        AI_ROUTINE_WORST_CASE_CENTS: "10",
        AI_OPTIONAL_WORST_CASE_CENTS: "20",
        AI_COMPLEX_WORST_CASE_CENTS: "50",
      }),
    ).toEqual({
      AI_MONTHLY_HARD_LIMIT_CENTS: 950,
      AI_INPUT_CENTS_PER_MILLION_TOKENS: 1000,
      AI_OUTPUT_CENTS_PER_MILLION_TOKENS: 4000,
      AI_ROUTINE_WORST_CASE_CENTS: 10,
      AI_OPTIONAL_WORST_CASE_CENTS: 20,
      AI_COMPLEX_WORST_CASE_CENTS: 50,
    });

    expect(() =>
      AiBudgetEnvSchema.parse({
        AI_MONTHLY_HARD_LIMIT_CENTS: "951",
        AI_INPUT_CENTS_PER_MILLION_TOKENS: "1000",
        AI_OUTPUT_CENTS_PER_MILLION_TOKENS: "4000",
        AI_ROUTINE_WORST_CASE_CENTS: "10",
        AI_OPTIONAL_WORST_CASE_CENTS: "20",
        AI_COMPLEX_WORST_CASE_CENTS: "50",
      }),
    ).toThrow(/950/u);
  });

  it("rejects partial, fractional, negative, or zero reservation pricing", () => {
    const runtime = {
      VISION_ENV: "preview",
      DATABASE_URL: "postgresql://vision_app:secret@db.example.test/vision",
      KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      AI_MONTHLY_HARD_LIMIT_CENTS: "950",
    };
    expect(() =>
      RuntimeEnvSchema.parse({
        ...runtime,
        AI_INPUT_CENTS_PER_MILLION_TOKENS: "1000",
      }),
    ).toThrow(/pricing fields must be configured together/u);
    for (const invalid of ["0", "-1", "1.5", "NaN"]) {
      expect(() =>
        AiBudgetEnvSchema.parse({
          AI_MONTHLY_HARD_LIMIT_CENTS: "950",
          AI_INPUT_CENTS_PER_MILLION_TOKENS: "1000",
          AI_OUTPUT_CENTS_PER_MILLION_TOKENS: "4000",
          AI_ROUTINE_WORST_CASE_CENTS: invalid,
          AI_OPTIONAL_WORST_CASE_CENTS: "20",
          AI_COMPLEX_WORST_CASE_CENTS: "50",
        }),
      ).toThrow();
    }
  });
});

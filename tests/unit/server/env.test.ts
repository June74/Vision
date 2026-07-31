import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AiBudgetEnvSchema,
  GoogleAuthEnvSchema,
  OpenAiEnvSchema,
  RuntimeEnvSchema,
  TemporaryRestoreEnvSchema,
} from "../../../src/server/env";
import { AI_PRICING_POLICY_VALUES } from "../../../src/server/ai-pricing-binding-contract";

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function expectPrivateValuesAbsent(
  rendered: string,
  privateValues: readonly string[],
): void {
  const valuesAreAbsent = privateValues.every(
    (privateValue) => !rendered.includes(privateValue),
  );
  expect(valuesAreAbsent).toBe(true);
}

describe("RuntimeEnvSchema", () => {
  it.each(["role_probe", "restore"] as const)(
    "admits the dedicated preview acceptance selector %s",
    (selector) => {
      expect(
        RuntimeEnvSchema.shape.PREVIEW_ACCEPTANCE_SCENARIO.parse(selector),
      ).toBe(selector);
    },
  );
  it("rejects a missing deployment environment", () => {
    expect(() => RuntimeEnvSchema.parse({})).toThrow();
  });

  it("admits the canonical AI evidence instant only on the AI candidate", () => {
    const runtime = {
      VISION_ENV: "preview",
      DATABASE_URL: "postgresql://vision_app:secret@db.example.test/vision",
      KEY_ENCRYPTION_KEY: encodeBase64Url(new Uint8Array(32)),
      DATABASE_USAGE_WARNING_BYTES: "400000000",
      R2_USAGE_WARNING_BYTES: "8000000000",
      R2_USAGE_WARNING_OBJECTS: "100",
      PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
      PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-31T20:15:30.000Z",
      PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT:
        "2026-07-31T20:15:00.000Z",
      PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
    };

    expect(RuntimeEnvSchema.parse(runtime)).toMatchObject({
      PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT:
        "2026-07-31T20:15:00.000Z",
    });

    const { PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT, ...missing } =
      runtime;
    expect(() => RuntimeEnvSchema.parse(missing)).toThrow(/AI-candidate-only/u);
    expect(PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT).toBe(
      "2026-07-31T20:15:00.000Z",
    );

    for (const scheduledAt of [
      "malformed",
      "2026-07-31T20:15:01.000Z",
      "2026-07-31T20:15:00Z",
    ]) {
      expect(() =>
        RuntimeEnvSchema.parse({
          ...runtime,
          PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT: scheduledAt,
        }),
      ).toThrow();
    }

    expect(() =>
      RuntimeEnvSchema.parse({
        ...runtime,
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
        PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: undefined,
      }),
    ).toThrow(/AI-candidate-only/u);
  });

  it("accepts only a database URL authenticated as the vision application role", () => {
    expect(
      RuntimeEnvSchema.parse({
        VISION_ENV: "preview",
        DATABASE_URL: "postgresql://vision_app:secret@db.example.test/vision",
        KEY_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        DATABASE_USAGE_WARNING_BYTES: "400000000",
        R2_USAGE_WARNING_BYTES: "8000000000",
        R2_USAGE_WARNING_OBJECTS: "100",
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
      DATABASE_USAGE_WARNING_BYTES: "400000000",
      R2_USAGE_WARNING_BYTES: "8000000000",
      R2_USAGE_WARNING_OBJECTS: "100",
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

  it("requires the backup key and version to be configured together", () => {
    const runtime = {
      VISION_ENV: "preview",
      DATABASE_URL: "postgresql://vision_app:secret@db.example.test/vision",
      KEY_ENCRYPTION_KEY: encodeBase64Url(new Uint8Array(32)),
      DATABASE_USAGE_WARNING_BYTES: "400000000",
      R2_USAGE_WARNING_BYTES: "8000000000",
      R2_USAGE_WARNING_OBJECTS: "100",
    };
    const backupKey = encodeBase64Url(new Uint8Array(32).fill(1));

    expect(() =>
      RuntimeEnvSchema.parse({
        ...runtime,
        BACKUP_ENCRYPTION_KEY: backupKey,
      }),
    ).toThrow(/configured together/u);
    expect(() =>
      RuntimeEnvSchema.parse({
        ...runtime,
        BACKUP_KEY_VERSION: "1",
      }),
    ).toThrow(/configured together/u);
    expect(
      RuntimeEnvSchema.parse({
        ...runtime,
        BACKUP_ENCRYPTION_KEY: backupKey,
        BACKUP_KEY_VERSION: "1",
      }),
    ).toMatchObject({ BACKUP_KEY_VERSION: 1 });
  });

  it("requires positive safe storage thresholds in preview and production", () => {
    const runtime = {
      VISION_ENV: "production",
      DATABASE_URL: "postgresql://vision_app:secret@db.example.test/vision",
      KEY_ENCRYPTION_KEY: encodeBase64Url(new Uint8Array(32)),
      DATABASE_USAGE_WARNING_BYTES: "400000000",
      R2_USAGE_WARNING_BYTES: "8000000000",
      R2_USAGE_WARNING_OBJECTS: "100",
    };

    expect(RuntimeEnvSchema.parse(runtime)).toMatchObject({
      DATABASE_USAGE_WARNING_BYTES: 400_000_000,
      R2_USAGE_WARNING_BYTES: 8_000_000_000,
      R2_USAGE_WARNING_OBJECTS: 100,
    });
    for (const environment of [
      { ...runtime, DATABASE_USAGE_WARNING_BYTES: undefined },
      { ...runtime, R2_USAGE_WARNING_BYTES: "0" },
      { ...runtime, R2_USAGE_WARNING_OBJECTS: "1.5" },
      {
        ...runtime,
        DATABASE_USAGE_WARNING_BYTES: String(Number.MAX_SAFE_INTEGER + 1),
      },
    ]) {
      expect(() => RuntimeEnvSchema.parse(environment)).toThrow(
        /usage warning thresholds/iu,
      );
    }
  });
});

describe("TemporaryRestoreEnvSchema", () => {
  const targetUrl =
    "postgresql://vision_app:synthetic@preview.example.test/vision";
  const validEnvironment = {
    VISION_ENV: "preview",
    PREVIEW_RESTORE_DATABASE_URL: targetUrl,
    PREVIEW_RESTORE_TARGET_ID: "disposable_preview_1",
  };

  it("accepts exactly a preview vision_app target URL and opaque target ID", () => {
    expect(TemporaryRestoreEnvSchema.parse(validEnvironment)).toMatchObject({
      VISION_ENV: "preview",
    });
  });

  it("rejects local and production restore execution", () => {
    for (const VISION_ENV of ["local", "production"]) {
      expect(() =>
        TemporaryRestoreEnvSchema.parse({
          ...validEnvironment,
          VISION_ENV,
        }),
      ).toThrow();
    }
  });

  it("rejects either missing restore target binding", () => {
    const { PREVIEW_RESTORE_DATABASE_URL, ...missingUrl } = validEnvironment;
    const { PREVIEW_RESTORE_TARGET_ID, ...missingTargetId } = validEnvironment;

    expect(() => TemporaryRestoreEnvSchema.parse(missingUrl)).toThrow();
    expect(() => TemporaryRestoreEnvSchema.parse(missingTargetId)).toThrow();
    const removedDatabaseBindingMatches =
      PREVIEW_RESTORE_DATABASE_URL === targetUrl;
    const removedTargetIdentityMatches =
      PREVIEW_RESTORE_TARGET_ID === "disposable_preview_1";
    expect(removedDatabaseBindingMatches).toBe(true);
    expect(removedTargetIdentityMatches).toBe(true);
  });

  it("rejects privileged URLs, control characters, and unexpected fields without echoing values", () => {
    const privateUrl =
      "postgresql://neondb_owner:PRIVATE_PASSWORD_SENTINEL@preview.example.test/vision";
    const privateTarget = "private-target\nsentinel";
    const privateUnexpected = "PRIVATE_UNEXPECTED_SENTINEL";
    const invalidEnvironments = [
      {
        ...validEnvironment,
        PREVIEW_RESTORE_DATABASE_URL: privateUrl,
      },
      {
        ...validEnvironment,
        PREVIEW_RESTORE_TARGET_ID: privateTarget,
      },
      {
        ...validEnvironment,
        unexpected: privateUnexpected,
      },
    ];

    for (const environment of invalidEnvironments) {
      let rendered = "";
      try {
        TemporaryRestoreEnvSchema.parse(environment);
      } catch (error) {
        rendered = String(error);
      }
      const errorWasRendered = rendered.length > 0;
      expect(errorWasRendered).toBe(true);
      expectPrivateValuesAbsent(rendered, [
        privateUrl,
        "PRIVATE_PASSWORD_SENTINEL",
        privateTarget,
        privateUnexpected,
      ]);
    }
  });

  it("keeps value-free assertion diagnostics boolean-only", () => {
    const privateValue = ["PRIVATE", "DIAGNOSTIC", "SENTINEL"].join("_");
    let diagnostic = "";
    try {
      expectPrivateValuesAbsent(privateValue, [privateValue]);
    } catch (error) {
      diagnostic = String(error);
    }

    const assertionFailed = diagnostic.length > 0;
    const diagnosticIsValueFree = !diagnostic.includes(privateValue);
    expect(assertionFailed).toBe(true);
    expect(diagnosticIsValueFree).toBe(true);
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
        ...AI_PRICING_POLICY_VALUES,
      }),
    ).toEqual({
      AI_MONTHLY_HARD_LIMIT_CENTS: 950,
      AI_INPUT_CENTS_PER_MILLION_TOKENS: Number(
        AI_PRICING_POLICY_VALUES.AI_INPUT_CENTS_PER_MILLION_TOKENS,
      ),
      AI_OUTPUT_CENTS_PER_MILLION_TOKENS: Number(
        AI_PRICING_POLICY_VALUES.AI_OUTPUT_CENTS_PER_MILLION_TOKENS,
      ),
      AI_ROUTINE_WORST_CASE_CENTS: Number(
        AI_PRICING_POLICY_VALUES.AI_ROUTINE_WORST_CASE_CENTS,
      ),
      AI_OPTIONAL_WORST_CASE_CENTS: Number(
        AI_PRICING_POLICY_VALUES.AI_OPTIONAL_WORST_CASE_CENTS,
      ),
      AI_COMPLEX_WORST_CASE_CENTS: Number(
        AI_PRICING_POLICY_VALUES.AI_COMPLEX_WORST_CASE_CENTS,
      ),
    });

    expect(() =>
      AiBudgetEnvSchema.parse({
        AI_MONTHLY_HARD_LIMIT_CENTS: "951",
        ...AI_PRICING_POLICY_VALUES,
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
        AI_INPUT_CENTS_PER_MILLION_TOKENS:
          AI_PRICING_POLICY_VALUES.AI_INPUT_CENTS_PER_MILLION_TOKENS,
      }),
    ).toThrow(/pricing fields must be configured together/u);
    for (const invalid of ["0", "-1", "1.5", "NaN"]) {
      expect(() =>
        AiBudgetEnvSchema.parse({
          AI_MONTHLY_HARD_LIMIT_CENTS: "950",
          ...AI_PRICING_POLICY_VALUES,
          AI_ROUTINE_WORST_CASE_CENTS: invalid,
        }),
      ).toThrow();
    }
  });
});

/** Defines the validated runtime bindings available to the Vision Worker. */
import { z } from "zod";
import { decodeBase64Url } from "../crypto/envelope";
import { AI_HARD_STOP_CENTS } from "../domain/budget/ai-budget";
import { TEMPORARY_PREVIEW_FAULT_SCENARIOS } from "../domain/operations/temporary-preview-fault";
import { parseCloudflareOpenAiGatewayBaseUrl } from "../integrations/openai/cloudflare-gateway-url";

const keyEncryptionKeySchema = z.string().superRefine((keyEncryptionKey, context) => {
  let decoded: Uint8Array | undefined;

  try {
    if (keyEncryptionKey.length !== 43) {
      throw new Error("Incorrect encoded length.");
    }

    decoded = decodeBase64Url(keyEncryptionKey, "Root key", 43);
    if (decoded.byteLength !== 32) {
      throw new Error("Incorrect decoded length.");
    }
  } catch {
    // Never attach the supplied secret or decoder details to the externally visible Zod issue.
    context.addIssue({
      code: "custom",
      message: "KEY_ENCRYPTION_KEY must be a canonical 256-bit base64url secret.",
    });
  } finally {
    // Best-effort clearing applies only to this application-controlled mutable decode buffer.
    decoded?.fill(0);
  }
});

const backupEncryptionKeySchema = z.string().superRefine((backupKey, context) => {
  let decoded: Uint8Array | undefined;
  try {
    if (backupKey.length !== 43) throw new Error("Incorrect encoded length.");
    decoded = decodeBase64Url(backupKey, "Backup key", 43);
    if (decoded.byteLength !== 32) throw new Error("Incorrect decoded length.");
  } catch {
    context.addIssue({
      code: "custom",
      message:
        "BACKUP_ENCRYPTION_KEY must be a canonical 256-bit base64url secret.",
    });
  } finally {
    decoded?.fill(0);
  }
});
const backupKeyVersionSchema = z
  .union([
    z.number().int().positive().safe(),
    z
      .string()
      .regex(/^[1-9]\d*$/u)
      .transform(Number)
      .refine(Number.isSafeInteger),
  ]);

const visionEnvironmentSchema = z.enum(["local", "preview", "production"]);
const googleClientIdSchema = z
  .string()
  .min(16)
  .max(512)
  .regex(/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/u);
const googleClientSecretSchema = z.string().min(16).max(1_024);
const googleAllowedSubjectSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[\x21-\x7e]+$/u);
const googleRedirectSchema = z.string().url().max(2_048);
const userTimeZoneSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^(?:UTC|[A-Za-z_+-]+\/[A-Za-z0-9_+./-]+)$/u);
const openAiGatewayBaseUrlSchema = z
  .string()
  .max(2_048)
  .superRefine((baseUrl, context) => {
    try {
      parseCloudflareOpenAiGatewayBaseUrl(baseUrl);
    } catch {
      context.addIssue({
        code: "custom",
        message:
          "OPENAI_GATEWAY_BASE_URL must be the canonical Cloudflare OpenAI gateway base URL.",
      });
    }
  });
const injectedNonNegativeIntegerSchema = z.coerce
  .number()
  .int()
  .nonnegative()
  .max(100_000);
const injectedPositiveCentsSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(949);
const aiMonthlyHardLimitSchema = z.coerce
  .number()
  .int()
  .refine((value) => value === AI_HARD_STOP_CENTS, {
    message:
      "AI_MONTHLY_HARD_LIMIT_CENTS must remain 950 and match the Cloudflare AI Gateway barrier.",
  });
const usageWarningThresholdSchema = z.coerce.number().refine(
  (value) => Number.isSafeInteger(value) && value > 0,
  {
    message:
      "Storage usage warning thresholds must be positive safe integers.",
  },
);

/** Validates only the server-side configuration needed by the OpenAI adapter. */
export const OpenAiEnvSchema = z
  .object({
    OPENAI_GATEWAY_BASE_URL: openAiGatewayBaseUrlSchema,
    OPENAI_API_KEY: z.string().min(1).max(2_048),
  })
  .strict();

/** Validates injected provider pricing and the exact private-pilot Gateway spend barrier. */
export const AiBudgetEnvSchema = z
  .object({
    AI_MONTHLY_HARD_LIMIT_CENTS: aiMonthlyHardLimitSchema,
    AI_INPUT_CENTS_PER_MILLION_TOKENS: injectedNonNegativeIntegerSchema,
    AI_OUTPUT_CENTS_PER_MILLION_TOKENS: injectedNonNegativeIntegerSchema,
    AI_ROUTINE_WORST_CASE_CENTS: injectedPositiveCentsSchema,
    AI_OPTIONAL_WORST_CASE_CENTS: injectedPositiveCentsSchema,
    AI_COMPLEX_WORST_CASE_CENTS: injectedPositiveCentsSchema,
  })
  .strict();

/** Validates the separate backup-only key binding and its positive key version. */
export const BackupEnvSchema = z
  .object({
    BACKUP_ENCRYPTION_KEY: backupEncryptionKeySchema,
    BACKUP_KEY_VERSION: backupKeyVersionSchema,
    KEY_ENCRYPTION_KEY: keyEncryptionKeySchema.optional(),
  })
  .superRefine((environment, context) => {
    if (
      environment.KEY_ENCRYPTION_KEY !== undefined &&
      environment.KEY_ENCRYPTION_KEY === environment.BACKUP_ENCRYPTION_KEY
    ) {
      context.addIssue({
        code: "custom",
        message:
          "BACKUP_ENCRYPTION_KEY must be distinct from KEY_ENCRYPTION_KEY.",
      });
    }
  });

/** Validates the server-only Google OAuth and private-pilot allowlist bindings as one exact unit. */
export const GoogleAuthEnvSchema = z
  .object({
    VISION_ENV: visionEnvironmentSchema,
    GOOGLE_CLIENT_ID: googleClientIdSchema,
    GOOGLE_CLIENT_SECRET: googleClientSecretSchema,
    GOOGLE_REDIRECT_URI: googleRedirectSchema,
    GOOGLE_ALLOWED_SUB: googleAllowedSubjectSchema,
    GOOGLE_ALLOWED_EMAIL: z.string().email().max(320),
  })
  .superRefine((environment, context) => {
    const redirect = new URL(environment.GOOGLE_REDIRECT_URI);
    const localHost =
      redirect.hostname === "localhost" || redirect.hostname === "127.0.0.1";
    if (
      (environment.VISION_ENV === "local"
        ? !(
            redirect.protocol === "https:" ||
            (redirect.protocol === "http:" && localHost)
          )
        : redirect.protocol !== "https:") ||
      redirect.username !== "" ||
      redirect.password !== "" ||
      redirect.search !== "" ||
      redirect.hash !== "" ||
      redirect.pathname !== "/api/auth/google/callback"
    ) {
      context.addIssue({
        code: "custom",
        message:
          "GOOGLE_REDIRECT_URI must be the exact HTTPS callback URI; local may use HTTP loopback.",
      });
    }
  });

/** Validates deployment bindings, including the Worker-only least-privileged database credential. */
export const RuntimeEnvSchema = z
  .object({
    VISION_ENV: visionEnvironmentSchema,
    DATABASE_URL: z.string().url().superRefine((databaseUrl, context) => {
      // The username is safe configuration metadata; never include the URL or password in a validation message.
      let parsed: URL;
      try {
        parsed = new URL(databaseUrl);
      } catch {
        return;
      }
      if (parsed.username !== "vision_app") {
        context.addIssue({ code: "custom", message: "DATABASE_URL must authenticate as the vision_app role." });
      }
    }),
    KEY_ENCRYPTION_KEY: keyEncryptionKeySchema,
    BACKUP_ENCRYPTION_KEY: backupEncryptionKeySchema.optional(),
    BACKUP_KEY_VERSION: backupKeyVersionSchema.optional(),
    PREVIEW_RESTORE_DATABASE_URL: z.string().optional(),
    PREVIEW_RESTORE_TARGET_ID: z.string().optional(),
    GOOGLE_CLIENT_ID: googleClientIdSchema.optional(),
    GOOGLE_CLIENT_SECRET: googleClientSecretSchema.optional(),
    GOOGLE_REDIRECT_URI: googleRedirectSchema.optional(),
    GOOGLE_ALLOWED_SUB: googleAllowedSubjectSchema.optional(),
    GOOGLE_ALLOWED_EMAIL: z.string().email().max(320).optional(),
    VISION_USER_TIME_ZONE: userTimeZoneSchema.optional(),
    OPENAI_GATEWAY_BASE_URL: openAiGatewayBaseUrlSchema.optional(),
    OPENAI_API_KEY: z.string().min(1).max(2_048).optional(),
    AI_MONTHLY_HARD_LIMIT_CENTS: aiMonthlyHardLimitSchema.optional(),
    AI_INPUT_CENTS_PER_MILLION_TOKENS:
      injectedNonNegativeIntegerSchema.optional(),
    AI_OUTPUT_CENTS_PER_MILLION_TOKENS:
      injectedNonNegativeIntegerSchema.optional(),
    AI_ROUTINE_WORST_CASE_CENTS: injectedPositiveCentsSchema.optional(),
    AI_OPTIONAL_WORST_CASE_CENTS: injectedPositiveCentsSchema.optional(),
    AI_COMPLEX_WORST_CASE_CENTS: injectedPositiveCentsSchema.optional(),
    DATABASE_USAGE_WARNING_BYTES: usageWarningThresholdSchema.optional(),
    R2_USAGE_WARNING_BYTES: usageWarningThresholdSchema.optional(),
    R2_USAGE_WARNING_OBJECTS: usageWarningThresholdSchema.optional(),
    PREVIEW_ACCEPTANCE_SCENARIO: z
      .enum(TEMPORARY_PREVIEW_FAULT_SCENARIOS)
      .optional(),
  })
  .superRefine((environment, context) => {
    if (
      environment.VISION_ENV !== "local" &&
      (environment.DATABASE_USAGE_WARNING_BYTES === undefined ||
        environment.R2_USAGE_WARNING_BYTES === undefined ||
        environment.R2_USAGE_WARNING_OBJECTS === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Storage usage warning thresholds are required in preview and production.",
      });
    }
    if (
      environment.PREVIEW_ACCEPTANCE_SCENARIO !== undefined &&
      environment.VISION_ENV !== "preview"
    ) {
      context.addIssue({
        code: "custom",
        message: "PREVIEW_ACCEPTANCE_SCENARIO is preview-only.",
      });
    }
    if (
      (environment.BACKUP_ENCRYPTION_KEY === undefined) !==
      (environment.BACKUP_KEY_VERSION === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "BACKUP_ENCRYPTION_KEY and BACKUP_KEY_VERSION must be configured together.",
      });
    }
    if (
      (environment.OPENAI_GATEWAY_BASE_URL === undefined) !==
      (environment.OPENAI_API_KEY === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "OPENAI_GATEWAY_BASE_URL and OPENAI_API_KEY must be configured together.",
      });
    }
    const pricingFields = [
      environment.AI_INPUT_CENTS_PER_MILLION_TOKENS,
      environment.AI_OUTPUT_CENTS_PER_MILLION_TOKENS,
      environment.AI_ROUTINE_WORST_CASE_CENTS,
      environment.AI_OPTIONAL_WORST_CASE_CENTS,
      environment.AI_COMPLEX_WORST_CASE_CENTS,
    ];
    const configuredPricingFields = pricingFields.filter(
      (value) => value !== undefined,
    ).length;
    if (
      configuredPricingFields !== 0 &&
      configuredPricingFields !== pricingFields.length
    ) {
      context.addIssue({
        code: "custom",
        message: "All AI pricing fields must be configured together.",
      });
    }
  });

/** Validates the exact preview-only database target bindings used by the temporary restore cron. */
export const TemporaryRestoreEnvSchema = z
  .object({
    VISION_ENV: z.literal("preview"),
    PREVIEW_RESTORE_DATABASE_URL: RuntimeEnvSchema.shape.DATABASE_URL,
    PREVIEW_RESTORE_TARGET_ID: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/u),
  })
  .strict();

/** Validates only the preview disposable-target connection used by the read-only role probe. */
export const TemporaryRoleProbeEnvSchema = z
  .object({
    VISION_ENV: z.literal("preview"),
    PREVIEW_RESTORE_DATABASE_URL: RuntimeEnvSchema.shape.DATABASE_URL,
  })
  .strict();

/** Safely validates a Worker-only database URL without including credential text in errors. */
export function parseVisionDatabaseUrl(databaseUrl: unknown): string {
  return RuntimeEnvSchema.shape.DATABASE_URL.parse(databaseUrl);
}

/**
 * Validates the root wrapping secret without copying it into errors and clears the local mutable
 * decoded-byte validation buffer after either acceptance or rejection.
 */
export function parseVisionKeyEncryptionKey(keyEncryptionKey: unknown): string {
  return RuntimeEnvSchema.shape.KEY_ENCRYPTION_KEY.parse(keyEncryptionKey);
}

/** Validates the complete OAuth configuration before any provider request or auth persistence call. */
export function parseGoogleAuthEnvironment(
  environment: unknown,
): z.infer<typeof GoogleAuthEnvSchema> {
  return GoogleAuthEnvSchema.parse(environment);
}

/** Validates the server-owned private-pilot time zone used for secondary-calendar creation. */
export function parseVisionUserTimeZone(userTimeZone: unknown): string {
  return userTimeZoneSchema.parse(userTimeZone);
}

/** Validates the complete server-only OpenAI adapter environment before network dispatch. */
export function parseOpenAiEnvironment(
  environment: unknown,
): z.infer<typeof OpenAiEnvSchema> {
  return OpenAiEnvSchema.parse(environment);
}

/** Validates injected AI rates and estimates before constructing the budget wrapper. */
export function parseAiBudgetEnvironment(
  environment: unknown,
): z.infer<typeof AiBudgetEnvSchema> {
  return AiBudgetEnvSchema.parse(environment);
}

/** Validates the complete server-only storage warning threshold contract. */
export function parseUsageWarningThresholds(environment: unknown): {
  readonly databaseBytes: number;
  readonly r2Bytes: number;
  readonly r2ObjectCount: number;
} {
  const parsed = z
    .object({
      DATABASE_USAGE_WARNING_BYTES: usageWarningThresholdSchema,
      R2_USAGE_WARNING_BYTES: usageWarningThresholdSchema,
      R2_USAGE_WARNING_OBJECTS: usageWarningThresholdSchema,
    })
    .parse(environment);
  return Object.freeze({
    databaseBytes: parsed.DATABASE_USAGE_WARNING_BYTES,
    r2Bytes: parsed.R2_USAGE_WARNING_BYTES,
    r2ObjectCount: parsed.R2_USAGE_WARNING_OBJECTS,
  });
}

/** Validates and owns only the backup-specific secret and version fields. */
export function parseBackupEnvironment(environment: unknown): {
  readonly BACKUP_ENCRYPTION_KEY: string;
  readonly BACKUP_KEY_VERSION: number;
} {
  const parsed = BackupEnvSchema.parse(environment);
  return Object.freeze({
    BACKUP_ENCRYPTION_KEY: parsed.BACKUP_ENCRYPTION_KEY,
    BACKUP_KEY_VERSION: parsed.BACKUP_KEY_VERSION,
  });
}

/** Represents the validated server-only, secret-bearing Vision runtime environment. */
export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

/** Defines every Worker binding used by the initial Vision runtime. */
export interface Env extends RuntimeEnv {
  ASSETS: Fetcher;
  CALENDAR_SYNC_QUEUE?: Queue<import("../jobs/queue-message").CalendarSyncMessage>;
  BACKUP_BUCKET?: R2Bucket;
}

/** Defines the validated runtime bindings available to the Vision Worker. */
import { z } from "zod";
import { decodeBase64Url } from "../crypto/envelope";

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
export const RuntimeEnvSchema = z.object({
  VISION_ENV: visionEnvironmentSchema,
  DATABASE_URL: z.string().url().superRefine((databaseUrl, context) => {
    // The username is safe configuration metadata; never include the URL or password in a validation message.
    if (new URL(databaseUrl).username !== "vision_app") {
      context.addIssue({ code: "custom", message: "DATABASE_URL must authenticate as the vision_app role." });
    }
  }),
  KEY_ENCRYPTION_KEY: keyEncryptionKeySchema,
  GOOGLE_CLIENT_ID: googleClientIdSchema.optional(),
  GOOGLE_CLIENT_SECRET: googleClientSecretSchema.optional(),
  GOOGLE_REDIRECT_URI: googleRedirectSchema.optional(),
  GOOGLE_ALLOWED_SUB: googleAllowedSubjectSchema.optional(),
  GOOGLE_ALLOWED_EMAIL: z.string().email().max(320).optional(),
  VISION_USER_TIME_ZONE: userTimeZoneSchema.optional(),
});

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

/** Represents the validated server-only, secret-bearing Vision runtime environment. */
export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

/** Defines every Worker binding used by the initial Vision runtime. */
export interface Env extends RuntimeEnv {
  ASSETS: Fetcher;
}

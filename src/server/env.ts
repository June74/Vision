/** Defines the validated runtime bindings available to the Vision Worker. */
import { z } from "zod";

/** Validates deployment bindings, including the Worker-only least-privileged database credential. */
export const RuntimeEnvSchema = z.object({
  VISION_ENV: z.enum(["local", "preview", "production"]),
  DATABASE_URL: z.string().url().superRefine((databaseUrl, context) => {
    // The username is safe configuration metadata; never include the URL or password in a validation message.
    if (new URL(databaseUrl).username !== "vision_app") {
      context.addIssue({ code: "custom", message: "DATABASE_URL must authenticate as the vision_app role." });
    }
  }),
  KEY_ENCRYPTION_KEY: z
    .string()
    // A 32-byte value has 43 unpadded base64url characters and one of four canonical final characters.
    .regex(/^[A-Za-z0-9_-]{42}[AQgw]$/u, "KEY_ENCRYPTION_KEY must be a canonical 256-bit base64url secret."),
});

/** Safely validates a Worker-only database URL without including credential text in errors. */
export function parseVisionDatabaseUrl(databaseUrl: unknown): string {
  return RuntimeEnvSchema.shape.DATABASE_URL.parse(databaseUrl);
}

/** Safely validates the root wrapping secret without copying its value into error messages. */
export function parseVisionKeyEncryptionKey(keyEncryptionKey: unknown): string {
  return RuntimeEnvSchema.shape.KEY_ENCRYPTION_KEY.parse(keyEncryptionKey);
}

/** Represents the validated server-only, secret-bearing Vision runtime environment. */
export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

/** Defines every Worker binding used by the initial Vision runtime. */
export interface Env extends RuntimeEnv {
  ASSETS: Fetcher;
}

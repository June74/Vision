/** Defines the validated runtime bindings available to the Vision Worker. */
import { z } from "zod";
import { decodeBase64Url } from "../crypto/envelope";

const keyEncryptionKeySchema = z.string().superRefine((keyEncryptionKey, context) => {
  try {
    if (keyEncryptionKey.length !== 43) {
      throw new Error("Incorrect encoded length.");
    }

    const decoded = decodeBase64Url(keyEncryptionKey, "Root key", 43);
    if (decoded.byteLength !== 32) {
      throw new Error("Incorrect decoded length.");
    }
  } catch {
    // Never attach the supplied secret or decoder details to the externally visible Zod issue.
    context.addIssue({
      code: "custom",
      message: "KEY_ENCRYPTION_KEY must be a canonical 256-bit base64url secret.",
    });
  }
});

/** Validates deployment bindings, including the Worker-only least-privileged database credential. */
export const RuntimeEnvSchema = z.object({
  VISION_ENV: z.enum(["local", "preview", "production"]),
  DATABASE_URL: z.string().url().superRefine((databaseUrl, context) => {
    // The username is safe configuration metadata; never include the URL or password in a validation message.
    if (new URL(databaseUrl).username !== "vision_app") {
      context.addIssue({ code: "custom", message: "DATABASE_URL must authenticate as the vision_app role." });
    }
  }),
  KEY_ENCRYPTION_KEY: keyEncryptionKeySchema,
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

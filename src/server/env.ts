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
});

/** Represents the validated, non-secret Vision deployment environment. */
export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

/** Defines every Worker binding used by the initial Vision runtime. */
export interface Env extends RuntimeEnv {
  ASSETS: Fetcher;
}

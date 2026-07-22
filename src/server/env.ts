/** Defines the validated runtime bindings available to the Vision Worker. */
import { z } from "zod";

/** Validates the non-secret deployment environment supplied to the Worker. */
export const RuntimeEnvSchema = z.object({
  VISION_ENV: z.enum(["local", "preview", "production"]),
});

/** Represents the validated, non-secret Vision deployment environment. */
export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

/** Defines every Worker binding used by the initial Vision runtime. */
export interface Env extends RuntimeEnv {
  ASSETS: Fetcher;
}

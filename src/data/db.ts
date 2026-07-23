/** Creates the server-only Neon HTTP database boundary for Vision's PostgreSQL authority. */
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { RuntimeEnv } from "../server/env";
import * as schema from "./schema";

/** The typed database used by repositories to access the reviewed canonical schema. */
export type VisionDatabase = NeonHttpDatabase<typeof schema>;

/** Creates a typed Neon HTTP client from already validated least-privileged Worker configuration. */
export function createDb(environment: RuntimeEnv): VisionDatabase {
  // RuntimeEnvSchema rejects every role except vision_app before this boundary is called.
  return drizzle({ client: neon(environment.DATABASE_URL), schema });
}

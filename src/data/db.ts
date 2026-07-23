/** Creates the server-only Neon HTTP database boundary for Vision's PostgreSQL authority. */
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/** The typed database used by repositories to access the reviewed canonical schema. */
export type VisionDatabase = NeonHttpDatabase<typeof schema>;

/** Creates a typed Neon HTTP client from a least-privileged application database URL. */
export function createDb(databaseUrl: string): VisionDatabase {
  // Production receives this URL only through a Worker secret bound to an app role, never neondb_owner.
  return drizzle({ client: neon(databaseUrl), schema });
}

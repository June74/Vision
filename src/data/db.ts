/** Creates the server-only Neon HTTP database boundary for Vision's PostgreSQL authority. */
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { parseVisionDatabaseUrl } from "../server/env";
import * as schema from "./schema";

/** The typed database used by repositories to access the reviewed canonical schema. */
export type VisionDatabase = NeonHttpDatabase<typeof schema>;

/** Creates a typed Neon HTTP client after enforcing the least-privileged URL policy at this callable boundary. */
export function createDb(databaseUrl: unknown): VisionDatabase {
  return drizzle({ client: neon(parseVisionDatabaseUrl(databaseUrl)), schema });
}

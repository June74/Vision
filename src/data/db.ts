/** Creates the server-only Neon HTTP database boundary for Vision's PostgreSQL authority. */
import { neon, types } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { parseVisionDatabaseUrl } from "../server/env";
import * as schema from "./schema";

/** The typed database used by repositories to access the reviewed canonical schema. */
export type VisionDatabase = NeonHttpDatabase<typeof schema>;

/** Leaves bytea in its canonical text form for Vision's strict repository decoders. */
function preserveCanonicalByteaText(value: string): string {
  return value;
}

const visionNeonTypes = {
  /** Overrides only text bytea parsing and delegates every other PostgreSQL type to Neon. */
  getTypeParser(id: number, format?: "text" | "binary") {
    if (
      id === types.builtins.BYTEA &&
      (format === undefined || format === "text")
    ) {
      return preserveCanonicalByteaText;
    }
    return types.getTypeParser(id, format);
  },
};

/** Creates a typed Neon HTTP client after enforcing the least-privileged URL policy at this callable boundary. */
export function createDb(databaseUrl: unknown): VisionDatabase {
  return drizzle({
    client: neon(parseVisionDatabaseUrl(databaseUrl), {
      types: visionNeonTypes,
    }),
    schema,
  });
}

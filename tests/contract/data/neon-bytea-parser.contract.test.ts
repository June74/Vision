import { neonConfig, types } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createDb } from "../../../src/data/db";

const originalFetchFunction = neonConfig.fetchFunction;
const originalByteaParser = types.getTypeParser(types.builtins.BYTEA, "text");

afterEach(() => {
  neonConfig.fetchFunction = originalFetchFunction;
  types.setTypeParser(types.builtins.BYTEA, "text", originalByteaParser);
});

describe("Neon bytea parsing boundary", () => {
  it("keeps a real Neon HTTP bytea response as canonical PostgreSQL hex text", async () => {
    neonConfig.fetchFunction = async () =>
      new Response(
        JSON.stringify({
          command: "SELECT",
          fields: [{ name: "verifierEnvelope", dataTypeID: 17 }],
          rowAsArray: true,
          rowCount: 1,
          rows: [["\\x00ff"]],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    const database = createDb(
      "postgresql://vision_app:secret@db.example.test/vision",
    );

    const result = await database.execute<{ verifierEnvelope: unknown }>(
      sql`select verifier_envelope as "verifierEnvelope" from oauth_transactions`,
    );

    expect(result.rows[0]?.verifierEnvelope).toBe("\\x00ff");
  });
});

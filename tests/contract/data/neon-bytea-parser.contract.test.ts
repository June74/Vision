import { neonConfig, types } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createDb } from "../../../src/data/db";
import { DrizzleSessionStore } from "../../../src/data/repositories/session-repository";

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

  it("decodes a complete OAuth transaction row in Neon's PostgreSQL timestamp format", async () => {
    const stateHash = "s".repeat(43);
    const admissionKeyHash = "a".repeat(43);
    neonConfig.fetchFunction = async () =>
      new Response(
        JSON.stringify({
          command: "DELETE",
          fields: [
            { name: "stateHash", dataTypeID: 25 },
            { name: "admissionKeyHash", dataTypeID: 25 },
            { name: "admissionSlot", dataTypeID: 23 },
            { name: "verifierEnvelope", dataTypeID: 17 },
            { name: "nonceEnvelope", dataTypeID: 17 },
            { name: "createdAt", dataTypeID: 1184 },
            { name: "expiresAt", dataTypeID: 1184 },
            { name: "consumedAt", dataTypeID: 1184 },
          ],
          rowAsArray: true,
          rowCount: 1,
          rows: [[
            stateHash,
            admissionKeyHash,
            "1",
            "\\x00ff",
            "\\x0102",
            "2026-07-24 03:30:00+00",
            "2026-07-24 03:40:00+00",
            "2026-07-24 03:35:00+00",
          ]],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    const store = new DrizzleSessionStore(
      createDb("postgresql://vision_app:secret@db.example.test/vision"),
    );

    const row = await store.consumeOAuthTransaction(
      stateHash,
      new Date("2026-07-24T03:35:00.000Z"),
    );

    expect(row).toMatchObject({
      admissionKeyHash,
      admissionSlot: 1,
      consumedAt: new Date("2026-07-24T03:35:00.000Z"),
      createdAt: new Date("2026-07-24T03:30:00.000Z"),
      expiresAt: new Date("2026-07-24T03:40:00.000Z"),
      stateHash,
    });
    expect(row?.verifierEnvelope).toEqual(new Uint8Array([0, 255]));
    expect(row?.nonceEnvelope).toEqual(new Uint8Array([1, 2]));
  });
});

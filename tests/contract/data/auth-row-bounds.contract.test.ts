import type { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS } from "../../../src/crypto/envelope";
import type { VisionDatabase } from "../../../src/data/db";
import { DrizzleSessionStore } from "../../../src/data/repositories/session-repository";
import { DrizzleTokenStore } from "../../../src/data/repositories/token-repository";
import { GOOGLE_OAUTH_SCOPES } from "../../../src/integrations/google/oauth-client";

const now = "2026-07-23T12:00:00.000Z";
const later = "2026-07-23T12:10:00.000Z";

function databaseReturning(row: Record<string, unknown>): VisionDatabase {
  return {
    execute: async (_statement: SQL) => ({ rows: [row] }),
  } as unknown as VisionDatabase;
}

function tokenRow(bytes: unknown): Record<string, unknown> {
  return {
    ownerId: "usr_private_pilot",
    googleSubject: "google-subject",
    refreshTokenEnvelope: bytes,
    refreshTokenDigest: "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    accessTokenEnvelope: null,
    accessExpiresAt: later,
    grantedScopes: GOOGLE_OAUTH_SCOPES.join(" "),
    tokenVersion: "1",
    updatedAt: now,
  };
}

function transactionRow(bytes: unknown): Record<string, unknown> {
  return {
    stateHash: "state-hash",
    verifierEnvelope: bytes,
    nonceEnvelope: new Uint8Array([1]),
    createdAt: now,
    expiresAt: later,
    consumedAt: null,
  };
}

describe("auth raw-row binary bounds", () => {
  it("applies one exact nonzero maximum to decoded and encoded token envelopes", async () => {
    const exact = new Uint8Array(MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS);
    const decoded = await new DrizzleTokenStore(
      databaseReturning(tokenRow(exact)),
    ).find("usr_private_pilot", "google-subject");
    expect(decoded?.refreshTokenEnvelope).toHaveLength(
      MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS,
    );
    exact[0] = 255;
    expect(decoded?.refreshTokenEnvelope[0]).toBe(0);

    for (const invalid of [
      new Uint8Array(0),
      new Uint8Array(MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS + 1),
      "\\x",
      `\\x${"00".repeat(MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS + 1)}`,
      "\\xAA",
    ]) {
      await expect(
        new DrizzleTokenStore(
          databaseReturning(tokenRow(invalid)),
        ).find("usr_private_pilot", "google-subject"),
      ).rejects.toThrow("Invalid Google token database row.");
    }

    await expect(
      new DrizzleTokenStore(
        databaseReturning(
          tokenRow(`\\x${"00".repeat(MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS)}`),
        ),
      ).find("usr_private_pilot", "google-subject"),
    ).resolves.toMatchObject({
      refreshTokenEnvelope: expect.any(Uint8Array),
    });
  });

  it("rejects hostile decoded binary objects before copying session envelopes", async () => {
    class HostileBytes extends Uint8Array {}
    const hostileSubclass = new HostileBytes([1]);
    const hostileProxy = new Proxy(new Uint8Array([1]), {
      get() {
        throw new Error("HOSTILE_BINARY_GET");
      },
    });

    for (const invalid of [hostileSubclass, hostileProxy]) {
      await expect(
        new DrizzleSessionStore(
          databaseReturning(transactionRow(invalid)),
        ).consumeOAuthTransaction("state-hash", new Date(now)),
      ).rejects.toThrow("AUTH_PERSISTENCE_FAILED");
    }
  });
});

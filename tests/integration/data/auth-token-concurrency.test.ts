import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encodeBase64Url } from "../../../src/crypto/envelope";
import { createTestKeyProvider } from "../../../src/crypto/test-key-provider";
import type { KeyProvider } from "../../../src/crypto/key-provider";
import type { VisionDatabase } from "../../../src/data/db";
import {
  DrizzleTokenStore,
  EncryptedTokenRepository,
  type NewGoogleTokens,
} from "../../../src/data/repositories/token-repository";
import { GOOGLE_OAUTH_SCOPES } from "../../../src/integrations/google/oauth-client";

const OWNER = "usr_private_pilot";
const SUBJECT = "google-subject";
const dialect = new PgDialect();

let pglite: PGlite;
let database: VisionDatabase;
let keyProvider: KeyProvider;
let repository: EncryptedTokenRepository;

beforeEach(async () => {
  pglite = new PGlite();
  await pglite.exec(
    await readFile(
      resolve(process.cwd(), "migrations/0001_phase_b_foundation.sql"),
      "utf8",
    ),
  );
  await pglite.exec(
    await readFile(
      resolve(process.cwd(), "migrations/0002_google_auth_sessions.sql"),
      "utf8",
    ),
  );
  database = {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      const result = await pglite.query(query.sql, query.params as never[]);
      return { rows: result.rows };
    },
  } as unknown as VisionDatabase;
  keyProvider = await createTestKeyProvider({
    rootKeyBase64Url: encodeBase64Url(
      crypto.getRandomValues(new Uint8Array(32)),
    ),
  });
  repository = new EncryptedTokenRepository(
    new DrizzleTokenStore(database),
    keyProvider,
    OWNER,
  );
});

afterEach(async () => {
  await pglite.close();
});

function tokenWrite(
  refreshToken: string | undefined,
  updatedAt: string,
): NewGoogleTokens {
  return {
    googleSubject: SUBJECT,
    ...(refreshToken === undefined ? {} : { refreshToken }),
    accessToken: `access:${updatedAt}`,
    accessExpiresAt: new Date("2026-07-23T20:00:00.000Z"),
    grantedScopes: GOOGLE_OAUTH_SCOPES,
    updatedAt: new Date(updatedAt),
  } as NewGoogleTokens;
}

function createExecutionBarrier(blockedAt: string): {
  database: VisionDatabase;
  entered: Promise<void>;
  release: () => void;
} {
  let notifyEntered!: () => void;
  let unblock!: () => void;
  let blocked = false;
  const entered = new Promise<void>((resolveEntered) => {
    notifyEntered = resolveEntered;
  });
  const released = new Promise<void>((resolveReleased) => {
    unblock = resolveReleased;
  });
  return {
    database: {
      execute: async (statement: SQL) => {
        const query = dialect.sqlToQuery(statement);
        const shouldBlock =
          !blocked &&
          query.sql.includes("google_oauth_tokens") &&
          query.params.some(
            (parameter) =>
              parameter instanceof Date &&
              Date.prototype.toISOString.call(parameter) === blockedAt,
          );
        if (shouldBlock) {
          blocked = true;
          notifyEntered();
          await released;
        }
        const result = await pglite.query(query.sql, query.params as never[]);
        return { rows: result.rows };
      },
    } as unknown as VisionDatabase,
    entered,
    release: unblock,
  };
}

async function readRawTokenRow(): Promise<Record<string, unknown>> {
  const result = await pglite.query<Record<string, unknown>>(
    `select refresh_token_envelope, refresh_token_digest, access_token_envelope,
      token_version, owner_id, google_subject
     from google_oauth_tokens
     where owner_id = $1 and google_subject = $2`,
    [OWNER, SUBJECT],
  );
  return result.rows[0]!;
}

describe("atomic Google refresh-token persistence", () => {
  it("preserves the authoritative stored refresh token when Google omits a new token", async () => {
    await repository.saveGoogleTokens(
      tokenWrite("REFRESH_TOKEN_OLD_SENTINEL", "2026-07-23T12:00:00.000Z"),
    );

    await repository.saveGoogleTokens(
      tokenWrite(undefined, "2026-07-23T12:01:00.000Z"),
    );

    await expect(repository.getGoogleTokens(SUBJECT)).resolves.toMatchObject({
      refreshToken: "REFRESH_TOKEN_OLD_SENTINEL",
      tokenVersion: 1,
    });
  });

  it.each([
    {
      name: "the preserving callback reaches SQL last",
      blockedAt: "2026-07-23T12:02:00.000Z",
      firstRefresh: "REFRESH_TOKEN_NEW_SENTINEL",
      firstAt: "2026-07-23T12:01:00.000Z",
      blockedRefresh: undefined,
    },
    {
      name: "the provider-token callback reaches SQL last",
      blockedAt: "2026-07-23T12:01:00.000Z",
      firstRefresh: undefined,
      firstAt: "2026-07-23T12:02:00.000Z",
      blockedRefresh: "REFRESH_TOKEN_NEW_SENTINEL",
    },
  ])(
    "keeps the provider-issued token when $name",
    async ({ blockedAt, firstAt, firstRefresh, blockedRefresh }) => {
      await repository.saveGoogleTokens(
        tokenWrite("REFRESH_TOKEN_OLD_SENTINEL", "2026-07-23T12:00:00.000Z"),
      );
      const barrier = createExecutionBarrier(blockedAt);
      const blockedRepository = new EncryptedTokenRepository(
        new DrizzleTokenStore(barrier.database),
        keyProvider,
        OWNER,
      );
      const blockedWrite = blockedRepository.saveGoogleTokens(
        tokenWrite(blockedRefresh, blockedAt),
      );
      await barrier.entered;

      await repository.saveGoogleTokens(
        tokenWrite(firstRefresh, firstAt),
      );
      barrier.release();
      await blockedWrite;

      await expect(repository.getGoogleTokens(SUBJECT)).resolves.toMatchObject({
        refreshToken: "REFRESH_TOKEN_NEW_SENTINEL",
        tokenVersion: 2,
      });
    },
  );

  it("treats an equal provider-token retry as idempotent", async () => {
    await repository.saveGoogleTokens(
      tokenWrite("REFRESH_TOKEN_OLD_SENTINEL", "2026-07-23T12:00:00.000Z"),
    );
    await repository.saveGoogleTokens(
      tokenWrite("REFRESH_TOKEN_NEW_SENTINEL", "2026-07-23T12:01:00.000Z"),
    );
    const beforeRetry = await readRawTokenRow();

    await repository.saveGoogleTokens(
      tokenWrite("REFRESH_TOKEN_NEW_SENTINEL", "2026-07-23T12:02:00.000Z"),
    );
    const afterRetry = await readRawTokenRow();

    expect(afterRetry.token_version).toBe(2);
    expect(afterRetry.refresh_token_envelope).toEqual(
      beforeRetry.refresh_token_envelope,
    );
    expect(afterRetry.refresh_token_digest).toBe(
      beforeRetry.refresh_token_digest,
    );
  });

  it("cannot preserve or overwrite another owner's refresh token", async () => {
    await repository.saveGoogleTokens(
      tokenWrite("REFRESH_TOKEN_OWNER_SENTINEL", "2026-07-23T12:00:00.000Z"),
    );
    const otherOwner = new EncryptedTokenRepository(
      new DrizzleTokenStore(database),
      keyProvider,
      "usr_other",
    );

    await expect(
      otherOwner.saveGoogleTokens(
        tokenWrite(undefined, "2026-07-23T12:01:00.000Z"),
      ),
    ).rejects.toThrow("Token upsert lost owner-subject scope.");
    await expect(repository.getGoogleTokens(SUBJECT)).resolves.toMatchObject({
      refreshToken: "REFRESH_TOKEN_OWNER_SENTINEL",
      tokenVersion: 1,
    });
  });

  it("stores no provider-token plaintext in the executable raw row", async () => {
    await repository.saveGoogleTokens(
      tokenWrite("REFRESH_TOKEN_RAW_SENTINEL", "2026-07-23T12:00:00.000Z"),
    );

    const serialized = JSON.stringify(await readRawTokenRow());
    expect(serialized).not.toContain("REFRESH_TOKEN_RAW_SENTINEL");
    expect(serialized).not.toContain("access:2026-07-23");
    expect(serialized).toContain('"token_version":1');
  });
});

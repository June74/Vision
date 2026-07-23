import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encodeBase64Url } from "../../../src/crypto/envelope";
import type { KeyProvider } from "../../../src/crypto/key-provider";
import { createTestKeyProvider } from "../../../src/crypto/test-key-provider";
import type { VisionDatabase } from "../../../src/data/db";
import {
  DrizzleSessionStore,
  EncryptedSessionRepository,
  OAUTH_CLEANUP_BATCH_SIZE,
  OAUTH_START_WINDOW_MS,
} from "../../../src/data/repositories/session-repository";

const dialect = new PgDialect();
const startAt = new Date("2026-07-23T12:00:00.000Z");
const admissionKey = "ADMISSION_KEY_PRIVATE_SENTINEL_1234567890ABCDE";

let pglite: PGlite;
let database: VisionDatabase;
let keyProvider: KeyProvider;
let store: DrizzleSessionStore;
let repository: EncryptedSessionRepository;

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
  database = createDatabase();
  keyProvider = await createTestKeyProvider({
    rootKeyBase64Url: encodeBase64Url(
      crypto.getRandomValues(new Uint8Array(32)),
    ),
  });
  store = new DrizzleSessionStore(database);
  repository = new EncryptedSessionRepository(store, keyProvider);
});

afterEach(async () => {
  await pglite.close();
});

function createDatabase(): VisionDatabase {
  return {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      const result = await pglite.query(query.sql, query.params as never[]);
      return { rows: result.rows };
    },
  } as unknown as VisionDatabase;
}

function createBarrierDatabase(participants: number): {
  database: VisionDatabase;
  ready: Promise<void>;
  release: () => void;
} {
  let arrived = 0;
  let announceReady!: () => void;
  let release!: () => void;
  const ready = new Promise<void>((resolveReady) => {
    announceReady = resolveReady;
  });
  const released = new Promise<void>((resolveReleased) => {
    release = resolveReleased;
  });
  return {
    database: {
      execute: async (statement: SQL) => {
        const query = dialect.sqlToQuery(statement);
        if (query.sql.includes("insert into oauth_admission_windows")) {
          arrived += 1;
          if (arrived === participants) announceReady();
          await released;
        }
        const result = await pglite.query(query.sql, query.params as never[]);
        return { rows: result.rows };
      },
    } as unknown as VisionDatabase,
    ready,
    release,
  };
}

function transaction(
  stateCharacter: string,
  createdAt = startAt,
) {
  return {
    state: stateCharacter.repeat(43),
    admissionKey,
    pkceVerifier: "V".repeat(43),
    nonce: "N".repeat(43),
    createdAt,
    expiresAt: new Date(createdAt.getTime() + OAUTH_START_WINDOW_MS),
  };
}

describe("OAuth start admission and retention", () => {
  it("atomically caps concurrent outstanding starts at three", async () => {
    const barrier = createBarrierDatabase(4);
    const concurrentRepository = new EncryptedSessionRepository(
      new DrizzleSessionStore(barrier.database),
      keyProvider,
    );

    const starts = ["A", "B", "C", "D"].map((character) =>
      concurrentRepository.createOAuthTransaction(transaction(character)),
    );
    await barrier.ready;
    barrier.release();

    const results = await Promise.all(starts);
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(results.filter((result) => !result)).toHaveLength(1);
    const raw = await pglite.query(
      "select * from oauth_transactions order by admission_slot",
    );
    expect(raw.rows).toHaveLength(3);
    const serialized = JSON.stringify(raw.rows);
    for (const secret of [
      admissionKey,
      "A".repeat(43),
      "V".repeat(43),
      "N".repeat(43),
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("enforces five starts per fixed window even when callbacks free every slot", async () => {
    for (const character of ["A", "B", "C", "D", "E"]) {
      await expect(
        repository.createOAuthTransaction(transaction(character)),
      ).resolves.toBe(true);
      await expect(
        repository.consumeOAuthTransaction(
          character.repeat(43),
          new Date(startAt.getTime() + 1),
        ),
      ).resolves.toBeDefined();
    }

    await expect(
      repository.createOAuthTransaction(transaction("F")),
    ).resolves.toBe(false);
  });

  it("resets at the exact window boundary and cleans expired rows idempotently", async () => {
    await expect(
      repository.createOAuthTransaction(transaction("A")),
    ).resolves.toBe(true);
    const boundary = new Date(startAt.getTime() + OAUTH_START_WINDOW_MS);

    await expect(
      store.cleanupOAuthState(
        boundary,
        startAt,
        OAUTH_CLEANUP_BATCH_SIZE,
      ),
    ).resolves.toEqual({
      transactionsDeleted: 1,
      windowsDeleted: 1,
    });
    await expect(
      store.cleanupOAuthState(
        boundary,
        startAt,
        OAUTH_CLEANUP_BATCH_SIZE,
      ),
    ).resolves.toEqual({
      transactionsDeleted: 0,
      windowsDeleted: 0,
    });
    await expect(
      repository.consumeOAuthTransaction("A".repeat(43), boundary),
    ).resolves.toBeUndefined();
    await expect(
      repository.createOAuthTransaction(transaction("B", boundary)),
    ).resolves.toBe(true);
  });

  it("creates the expiry and admission indexes used by bounded cleanup", async () => {
    const indexes = await pglite.query<{ indexname: string }>(
      `select indexname
       from pg_indexes
       where schemaname = 'public'
         and indexname in (
           'oauth_transactions_admission_slot_uq',
           'oauth_transactions_expiry_idx',
           'oauth_transactions_consumed_idx',
           'oauth_admission_windows_started_idx'
         )
       order by indexname`,
    );
    expect(indexes.rows.map(({ indexname }) => indexname)).toEqual([
      "oauth_admission_windows_started_idx",
      "oauth_transactions_admission_slot_uq",
      "oauth_transactions_consumed_idx",
      "oauth_transactions_expiry_idx",
    ]);
  });
});

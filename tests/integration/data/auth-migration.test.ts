import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let database: PGlite;

beforeEach(async () => {
  database = new PGlite();
  await database.exec(
    await readFile(
      resolve(process.cwd(), "migrations/0001_phase_b_foundation.sql"),
      "utf8",
    ),
  );
});

afterEach(async () => {
  await database.close();
});

describe("Google authentication migration", () => {
  it("applies after the Phase B foundation and creates only ciphertext-bearing secret columns", async () => {
    await database.exec(
      await readFile(
        resolve(process.cwd(), "migrations/0002_google_auth_sessions.sql"),
        "utf8",
      ),
    );

    const tables = await database.query<{ tablename: string }>(
      `select tablename
       from pg_tables
       where schemaname = 'public'
         and tablename in (
           'oauth_transactions',
           'auth_sessions',
           'google_oauth_tokens',
           'wrapped_data_keys',
           'data_key_state'
         )
       order by tablename`,
    );
    expect(tables.rows.map(({ tablename }) => tablename)).toEqual([
      "auth_sessions",
      "data_key_state",
      "google_oauth_tokens",
      "oauth_transactions",
      "wrapped_data_keys",
    ]);

    const columns = await database.query<{
      column_name: string;
      data_type: string;
    }>(
      `select column_name, data_type
       from information_schema.columns
       where table_name in (
         'oauth_transactions',
         'auth_sessions',
         'google_oauth_tokens'
       )
       order by column_name`,
    );
    expect(columns.rows).toEqual(
      expect.arrayContaining([
        { column_name: "access_token_envelope", data_type: "bytea" },
        { column_name: "csrf_token_envelope", data_type: "bytea" },
        { column_name: "email_envelope", data_type: "bytea" },
        { column_name: "nonce_envelope", data_type: "bytea" },
        { column_name: "refresh_token_envelope", data_type: "bytea" },
        { column_name: "verifier_envelope", data_type: "bytea" },
      ]),
    );
  });
});

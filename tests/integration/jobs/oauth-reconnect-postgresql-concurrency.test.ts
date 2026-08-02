import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import { createChannelMaintenanceRepository } from "../../../src/data/repositories/channel-maintenance-repository";
import { SyncCalendarError } from "../../../src/jobs/sync-calendar";

const DATABASE_URL_ENV = "VISION_SYNC_CONCURRENCY_TEST_DATABASE_URL";
const APPROVAL_ENV = "VISION_SYNC_CONCURRENCY_TEST_APPROVED";
const OWNER = "owner_auth_reconnect_race";
const SUBJECT = "subject_auth_reconnect_race";
const CALENDAR = "calendar_auth_reconnect_race";
const FAILURE_AT = new Date("2026-08-02T05:00:00.000Z");
const TOKEN_AT = new Date("2026-08-02T05:00:01.000Z");
const dialect = new PgDialect();
const migrations = [
  "0001_phase_b_foundation.sql",
  "0002_google_auth_sessions.sql",
  "0003_calendar_setup.sql",
  "0004_incremental_event_sync.sql",
  "0005_google_notification_jobs.sql",
  "0006_google_channel_lifecycle.sql",
  "0007_calendar_maintenance_state.sql",
  "0008_google_projection_rebuild.sql",
  "0009_ai_usage_budget.sql",
] as const;

const configuredDatabaseUrl = process.env[DATABASE_URL_ENV];
const approved = process.env[APPROVAL_ENV] === "true";
if (approved && (!configuredDatabaseUrl || configuredDatabaseUrl.length === 0)) {
  throw new Error("Approved reconnect concurrency database is unavailable.");
}
const approvedDatabaseUrl = approved ? configuredDatabaseUrl : undefined;
const liveIt = approvedDatabaseUrl === undefined ? it.skip : it;

function sessionDatabase(client: PoolClient): VisionDatabase {
  return {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      const result = await client.query(query.sql, query.params as unknown[]);
      return { rows: result.rows };
    },
  } as unknown as VisionDatabase;
}

function quoteTestSchema(schema: string): string {
  if (!/^vision_auth_reconnect_[a-z0-9_]+$/u.test(schema)) {
    throw new Error("Invalid reconnect race-test schema.");
  }
  return `"${schema}"`;
}

async function waitForLock(observer: PoolClient, applicationName: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await observer.query<{
      wait_event_type: string | null;
    }>(
      `select wait_event_type
       from pg_stat_activity
       where application_name = $1 and state = 'active'`,
      [applicationName],
    );
    if (result.rows.some((row) => row.wait_event_type === "Lock")) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  throw new Error("Expected reconnect PostgreSQL lock wait was not observed.");
}

async function seedLiveShape(admin: PoolClient): Promise<void> {
  await admin.query(
    `insert into calendar_setup_states (
       owner_id, google_subject, setup_version, status, action_required, updated_at
     ) values ($1, $2, 4, 'connected', false, $3)`,
    [OWNER, SUBJECT, FAILURE_AT.toISOString()],
  );
  await admin.query(
    `insert into vision_calendar_connections (
       owner_id, google_subject, provider_calendar_id, summary,
       ownership_access_role, time_zone, provider_etag, verified_at,
       connection_kind
     ) values ($1, $2, $3, 'Vision', 'owner', 'America/Chicago',
       'etag-safe', $4, 'existing')`,
    [OWNER, SUBJECT, CALENDAR, FAILURE_AT.toISOString()],
  );
  await admin.query(
    `insert into sync_checkpoints (
       id, owner_id, provider, provider_calendar_id, sync_token_envelope,
       key_version, committed_at, version, status, last_error_category, updated_at
     ) values (
       'checkpoint_auth_reconnect', $1, 'google-calendar', $2, $3, 1,
       $4, 1, 'disconnected', 'authorization', $4
     )`,
    [OWNER, CALENDAR, new Uint8Array([1]), FAILURE_AT.toISOString()],
  );
  await admin.query(
    `insert into calendar_sync_maintenance (
       owner_id, provider, provider_calendar_id, connection_version,
       checkpoint_version, renewal_generation, renewal_failures,
       credential_failure_checkpoint_version, credential_failure_category,
       credential_failure_recorded_at, created_at, updated_at
     ) values (
       $1, 'google-calendar', $2, 4, 1, 3, 2,
       1, 'authorization', $3, $3, $3
     )`,
    [OWNER, CALENDAR, FAILURE_AT.toISOString()],
  );
  await admin.query(
    `insert into google_oauth_tokens (
       owner_id, google_subject, refresh_token_envelope,
       refresh_token_digest, access_token_envelope, access_expires_at,
       granted_scopes, token_version, updated_at
     ) values ($1, $2, $3, $4, $5, $6, $7, 2, $8)`,
    [
      OWNER,
      SUBJECT,
      new Uint8Array([2]),
      "R".repeat(43),
      new Uint8Array([3]),
      new Date(TOKEN_AT.getTime() + 3_600_000).toISOString(),
      "https://www.googleapis.com/auth/calendar.readonly",
      TOKEN_AT.toISOString(),
    ],
  );
}

interface RaceContext {
  readonly admin: PoolClient;
  readonly writer: PoolClient;
  readonly recovery: PoolClient;
  readonly follower: PoolClient;
  readonly observer: PoolClient;
  readonly recoveryApplication: string;
  readonly followerApplication: string;
  readonly advisoryKey: number;
}

interface RacePool {
  connect(): Promise<PoolClient>;
  end(): Promise<void>;
}

function attachCleanupFailures(
  primary: unknown,
  cleanupFailures: readonly unknown[],
): void {
  if (!(primary instanceof Error) || cleanupFailures.length === 0) return;
  const causes =
    primary.cause === undefined
      ? cleanupFailures
      : [primary.cause, ...cleanupFailures];
  primary.cause = new AggregateError(causes, "Reconnect race cleanup failed.");
}

function cleanupFailure(cleanupFailures: readonly unknown[]): unknown {
  return cleanupFailures.length === 1
    ? cleanupFailures[0]
    : new AggregateError(cleanupFailures, "Reconnect race cleanup failed.");
}

async function withRaceSchemaUsingPool(
  pool: RacePool,
  run: (context: RaceContext) => Promise<void>,
): Promise<void> {
  const clients: PoolClient[] = [];
  let admin: PoolClient | undefined;
  let writer: PoolClient | undefined;
  let recovery: PoolClient | undefined;
  let follower: PoolClient | undefined;
  let quotedSchema: string | undefined;
  let primary: unknown;
  let failed = false;
  try {
    admin = await pool.connect();
    clients.push(admin);
    writer = await pool.connect();
    clients.push(writer);
    recovery = await pool.connect();
    clients.push(recovery);
    follower = await pool.connect();
    clients.push(follower);
    const observer = await pool.connect();
    clients.push(observer);
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const schema = `vision_auth_reconnect_${suffix}`;
    quotedSchema = quoteTestSchema(schema);
    const recoveryApplication = `vision_auth_recovery_${suffix.slice(0, 12)}`;
    const followerApplication = `vision_auth_follower_${suffix.slice(0, 12)}`;
    const advisoryKey = Number.parseInt(suffix.slice(0, 7), 16);
    await admin.query(`create schema ${quotedSchema}`);
    await admin.query(`set search_path to ${quotedSchema}, public`);
    for (const migration of migrations) {
      await admin.query(
        await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
      );
    }
    for (const client of [writer, recovery, follower, observer]) {
      await client.query(`set search_path to ${quotedSchema}, public`);
      await client.query(`set statement_timeout to '15s'`);
    }
    await recovery.query(`select set_config('application_name', $1, false)`, [
      recoveryApplication,
    ]);
    await follower.query(`select set_config('application_name', $1, false)`, [
      followerApplication,
    ]);
    await seedLiveShape(admin);
    await run({
      admin,
      writer,
      recovery,
      follower,
      observer,
      recoveryApplication,
      followerApplication,
      advisoryKey,
    });
  } catch (cause) {
    failed = true;
    primary = cause;
  }

  const cleanupFailures: unknown[] = [];
  if (quotedSchema && writer && recovery && follower) {
    const rollbacks = await Promise.allSettled([
      writer.query("rollback"),
      recovery.query("rollback"),
      follower.query("rollback"),
    ]);
    for (const rollback of rollbacks) {
      if (rollback.status === "rejected") cleanupFailures.push(rollback.reason);
    }
  }
  if (quotedSchema && admin) {
    try {
      await admin.query(`drop schema if exists ${quotedSchema} cascade`);
    } catch (cause) {
      cleanupFailures.push(cause);
    }
  }
  for (const client of [...clients].reverse()) {
    try {
      client.release();
    } catch (cause) {
      cleanupFailures.push(cause);
    }
  }
  try {
    await pool.end();
  } catch (cause) {
    cleanupFailures.push(cause);
  }

  if (failed) {
    attachCleanupFailures(primary, cleanupFailures);
    throw primary;
  }
  if (cleanupFailures.length > 0) throw cleanupFailure(cleanupFailures);
}

async function withRaceSchema(
  run: (context: RaceContext) => Promise<void>,
): Promise<void> {
  if (!approvedDatabaseUrl) {
    throw new Error("Reconnect concurrency database was not approved.");
  }
  const pool = new Pool({ connectionString: approvedDatabaseUrl, max: 5 });
  await withRaceSchemaUsingPool(pool, run);
}

async function readClosedState(client: PoolClient): Promise<Record<string, unknown>> {
  const result = await client.query(
    `select
       token.token_version,
       checkpoint.status,
       checkpoint.last_error_category,
       checkpoint.updated_at,
       maintenance.credential_failure_checkpoint_version,
       maintenance.credential_failure_category,
       maintenance.credential_failure_recorded_at
     from google_oauth_tokens as token
     inner join sync_checkpoints as checkpoint
       on checkpoint.owner_id = token.owner_id
     inner join calendar_sync_maintenance as maintenance
       on maintenance.owner_id = checkpoint.owner_id
      and maintenance.provider = checkpoint.provider
      and maintenance.provider_calendar_id = checkpoint.provider_calendar_id
     where token.owner_id = $1`,
    [OWNER],
  );
  if (result.rows.length !== 1) {
    throw new Error("Reconnect race fixture lost its exact state row.");
  }
  return result.rows[0] as Record<string, unknown>;
}

describe("OAuth reconnect recovery on multi-session PostgreSQL", () => {
  it("releases race resources after acquisition and schema-drop failures", async () => {
    interface CleanupOutcome {
      readonly error: string;
      readonly released: readonly string[];
      readonly ended: boolean;
    }

    function fakeClient(
      name: string,
      released: string[],
      query?: (statement: string) => Promise<void>,
    ): PoolClient {
      return {
        query: async (statement: string) => {
          await query?.(statement);
          return { rows: [] };
        },
        release: () => released.push(name),
      } as unknown as PoolClient;
    }

    async function captureCleanup(
      clientNames: readonly string[],
      failConnectAt: number | undefined,
      failDrop: boolean,
    ): Promise<CleanupOutcome> {
      const released: string[] = [];
      const clients = clientNames.map((name) =>
        fakeClient(name, released, async (statement) => {
          if (failDrop && name === "admin" && statement.startsWith("drop schema")) {
            throw new Error("schema drop failed");
          }
        }),
      );
      let ended = false;
      let connectAttempt = 0;
      const pool: RacePool = {
        connect: async () => {
          if (connectAttempt === failConnectAt) {
            throw new Error("connect failed");
          }
          const client = clients[connectAttempt];
          connectAttempt += 1;
          if (!client) throw new Error("missing fake client");
          return client;
        },
        end: async () => {
          ended = true;
        },
      };
      let error = "none";
      try {
        await withRaceSchemaUsingPool(pool, async () => undefined);
      } catch (cause) {
        error = cause instanceof Error ? cause.message : "non-error failure";
      }
      return { error, released: [...released].sort(), ended };
    }

    const acquisition = await captureCleanup(["admin", "writer"], 2, false);
    const drop = await captureCleanup(
      ["admin", "writer", "recovery", "follower", "observer"],
      undefined,
      true,
    );

    expect({ acquisition, drop }).toEqual({
      acquisition: {
        error: "connect failed",
        released: ["admin", "writer"],
        ended: true,
      },
      drop: {
        error: "schema drop failed",
        released: ["admin", "follower", "observer", "recovery", "writer"],
        ended: true,
      },
    });
  });

  it("preserves primary failures and aggregates complete cleanup failures", async () => {
    async function exerciseCleanup(primary: Error | undefined): Promise<{
      readonly thrown: unknown;
      readonly released: readonly string[];
      readonly ended: boolean;
      readonly cleanupFailures: readonly Error[];
    }> {
      const rollbackFailure = new Error("rollback failed");
      const dropFailure = new Error("drop failed");
      const releaseFailure = new Error("release failed");
      const endFailure = new Error("end failed");
      const cleanupFailures = [
        rollbackFailure,
        dropFailure,
        releaseFailure,
        endFailure,
      ];
      const released: string[] = [];
      let ended = false;
      const clients = ["admin", "writer", "recovery", "follower", "observer"].map(
        (name) =>
          ({
            query: async (statement: string) => {
              if (name === "writer" && statement === "rollback") {
                throw rollbackFailure;
              }
              if (name === "admin" && statement.startsWith("drop schema")) {
                throw dropFailure;
              }
              return { rows: [] };
            },
            release: () => {
              released.push(name);
              if (name === "follower") throw releaseFailure;
            },
          }) as unknown as PoolClient,
      );
      let connectAttempt = 0;
      const pool: RacePool = {
        connect: async () => {
          const client = clients[connectAttempt];
          connectAttempt += 1;
          if (!client) throw new Error("missing fake client");
          return client;
        },
        end: async () => {
          ended = true;
          throw endFailure;
        },
      };
      let thrown: unknown;
      try {
        await withRaceSchemaUsingPool(pool, async () => {
          if (primary) throw primary;
        });
      } catch (cause) {
        thrown = cause;
      }
      return {
        thrown,
        released: [...released].sort(),
        ended,
        cleanupFailures,
      };
    }

    const primary = new Error("primary failed");
    const primaryOutcome = await exerciseCleanup(primary);
    const cleanupOnlyOutcome = await exerciseCleanup(undefined);
    const allClients = ["admin", "follower", "observer", "recovery", "writer"];

    expect(primaryOutcome.thrown).toBe(primary);
    expect(primary.cause).toBeInstanceOf(AggregateError);
    expect((primary.cause as AggregateError).errors).toEqual(
      primaryOutcome.cleanupFailures,
    );
    expect(primaryOutcome.released).toEqual(allClients);
    expect(primaryOutcome.ended).toBe(true);

    expect(cleanupOnlyOutcome.thrown).toBeInstanceOf(AggregateError);
    expect((cleanupOnlyOutcome.thrown as AggregateError).errors).toEqual(
      cleanupOnlyOutcome.cleanupFailures,
    );
    expect(cleanupOnlyOutcome.released).toEqual(allClients);
    expect(cleanupOnlyOutcome.ended).toBe(true);
  });

  liveIt(
    "fails an older callback after a newer token write wins",
    async () => {
      await withRaceSchema(async ({
        writer,
        recovery,
        observer,
        recoveryApplication,
      }) => {
        const repository = createChannelMaintenanceRepository(
          sessionDatabase(recovery),
          OWNER,
        );
        await writer.query("begin");
        await writer.query(
          `update google_oauth_tokens
           set token_version = 3, updated_at = $1
           where owner_id = $2`,
          [new Date(TOKEN_AT.getTime() + 1_000).toISOString(), OWNER],
        );
        const recoveryPromise = repository.recoverAuthorizationAfterReconnect({
          googleSubject: SUBJECT,
          tokenVersion: 2,
          tokenUpdatedAt: TOKEN_AT,
        });
        await waitForLock(observer, recoveryApplication);
        await writer.query("commit");
        await expect(recoveryPromise).resolves.toBe("conflict");
        await expect(readClosedState(observer)).resolves.toMatchObject({
          token_version: 3,
          status: "disconnected",
          last_error_category: "authorization",
          credential_failure_checkpoint_version: 1,
          credential_failure_category: "authorization",
          credential_failure_recorded_at: FAILURE_AT,
        });
      });
    },
    60_000,
  );

  liveIt(
    "preserves a scheduler failure that commits before recovery",
    async () => {
      await withRaceSchema(async ({
        admin,
        writer,
        recovery,
        observer,
        recoveryApplication,
      }) => {
        await admin.query(
          `update sync_checkpoints
           set status = 'connected', last_error_category = null, updated_at = $1
           where owner_id = $2`,
          [FAILURE_AT.toISOString(), OWNER],
        );
        await admin.query(
          `update calendar_sync_maintenance
           set credential_failure_checkpoint_version = null,
               credential_failure_category = null,
               credential_failure_recorded_at = null
           where owner_id = $1`,
          [OWNER],
        );
        const schedulerRepository = createChannelMaintenanceRepository(
          sessionDatabase(writer),
          OWNER,
        );
        const recoveryRepository = createChannelMaintenanceRepository(
          sessionDatabase(recovery),
          OWNER,
        );
        const newerFailureAt = new Date(TOKEN_AT.getTime() + 1_000);
        await writer.query("begin");
        await expect(
          schedulerRepository.recordCredentialFailure(
            new SyncCalendarError("authorization", "disconnected", false),
            newerFailureAt,
          ),
        ).resolves.toBe(true);
        const recoveryPromise =
          recoveryRepository.recoverAuthorizationAfterReconnect({
            googleSubject: SUBJECT,
            tokenVersion: 2,
            tokenUpdatedAt: TOKEN_AT,
          });
        await waitForLock(observer, recoveryApplication);
        await writer.query("commit");
        await expect(recoveryPromise).resolves.toBe("conflict");
        await expect(readClosedState(observer)).resolves.toMatchObject({
          status: "disconnected",
          last_error_category: "authorization",
          credential_failure_checkpoint_version: 1,
          credential_failure_category: "authorization",
          credential_failure_recorded_at: newerFailureAt,
        });
      });
    },
    60_000,
  );

  liveIt(
    "keeps a new scheduler failure written after successful recovery",
    async () => {
      await withRaceSchema(async ({ recovery, observer }) => {
        const repository = createChannelMaintenanceRepository(
          sessionDatabase(recovery),
          OWNER,
        );
        await expect(
          repository.recoverAuthorizationAfterReconnect({
            googleSubject: SUBJECT,
            tokenVersion: 2,
            tokenUpdatedAt: TOKEN_AT,
          }),
        ).resolves.toBe("recovered");
        const newerFailureAt = new Date(TOKEN_AT.getTime() + 1_000);
        await expect(
          repository.recordCredentialFailure(
            new SyncCalendarError("authorization", "disconnected", false),
            newerFailureAt,
          ),
        ).resolves.toBe(true);
        await expect(readClosedState(observer)).resolves.toMatchObject({
          status: "disconnected",
          last_error_category: "authorization",
          credential_failure_checkpoint_version: 1,
          credential_failure_category: "authorization",
          credential_failure_recorded_at: newerFailureAt,
        });
      });
    },
    60_000,
  );

  liveIt(
    "serializes two callbacks without a partial clear",
    async () => {
      await withRaceSchema(async ({
        admin,
        writer,
        recovery,
        follower,
        observer,
        recoveryApplication,
        followerApplication,
        advisoryKey,
      }) => {
        await admin.query(`
          create function pause_reconnect_checkpoint() returns trigger
          language plpgsql as $$
          begin
            perform pg_advisory_xact_lock(${advisoryKey});
            return new;
          end
          $$;
          create trigger pause_reconnect_checkpoint
          before update on sync_checkpoints
          for each row execute function pause_reconnect_checkpoint();
        `);
        const firstRepository = createChannelMaintenanceRepository(
          sessionDatabase(recovery),
          OWNER,
        );
        const followerRepository = createChannelMaintenanceRepository(
          sessionDatabase(follower),
          OWNER,
        );
        const input = {
          googleSubject: SUBJECT,
          tokenVersion: 2,
          tokenUpdatedAt: TOKEN_AT,
        } as const;
        let first: Promise<"recovered" | "not_needed" | "conflict"> | undefined;
        let second: Promise<"recovered" | "not_needed" | "conflict"> | undefined;
        let advisoryHeld = false;
        try {
          await writer.query(`select pg_advisory_lock($1)`, [advisoryKey]);
          advisoryHeld = true;
          first = firstRepository.recoverAuthorizationAfterReconnect(input);
          await waitForLock(observer, recoveryApplication);
          second = followerRepository.recoverAuthorizationAfterReconnect(input);
          await waitForLock(observer, followerApplication);
          await writer.query(`select pg_advisory_unlock($1)`, [advisoryKey]);
          advisoryHeld = false;
          const outcomes = await Promise.all([first, second]);
          expect([...outcomes].sort()).toEqual(["not_needed", "recovered"]);
          await expect(readClosedState(observer)).resolves.toMatchObject({
            status: "connected",
            last_error_category: null,
            credential_failure_checkpoint_version: null,
            credential_failure_category: null,
            credential_failure_recorded_at: null,
          });
        } finally {
          if (advisoryHeld) {
            await writer.query(`select pg_advisory_unlock($1)`, [advisoryKey]);
          }
          await Promise.allSettled(
            [first, second].filter(
              (promise): promise is Promise<"recovered" | "not_needed" | "conflict"> =>
                promise !== undefined,
            ),
          );
        }
      });
    },
    60_000,
  );

  liveIt(
    "rolls back the checkpoint when maintenance clear is suppressed",
    async () => {
      await withRaceSchema(async ({ admin, recovery, observer }) => {
        await admin.query(`
          create function suppress_marker_clear() returns trigger
          language plpgsql as $$
          begin
            if old.credential_failure_checkpoint_version is not null
               and new.credential_failure_checkpoint_version is null then
              return null;
            end if;
            return new;
          end
          $$;
          create trigger suppress_marker_clear
          before update on calendar_sync_maintenance
          for each row execute function suppress_marker_clear();
        `);
        const repository = createChannelMaintenanceRepository(
          sessionDatabase(recovery),
          OWNER,
        );
        await expect(
          repository.recoverAuthorizationAfterReconnect({
            googleSubject: SUBJECT,
            tokenVersion: 2,
            tokenUpdatedAt: TOKEN_AT,
          }),
        ).rejects.toThrow();
        await expect(readClosedState(observer)).resolves.toMatchObject({
          status: "disconnected",
          last_error_category: "authorization",
          credential_failure_checkpoint_version: 1,
          credential_failure_category: "authorization",
          credential_failure_recorded_at: FAILURE_AT,
        });
      });
    },
    60_000,
  );
});

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Pool,
  type PoolClient,
} from "@neondatabase/serverless";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  encodeBase64Url,
  serializeCipherEnvelope,
} from "../../../src/crypto/envelope";
import type { KeyProvider } from "../../../src/crypto/key-provider";
import { encryptProtectedFields } from "../../../src/crypto/protected-fields";
import { createTestKeyProvider } from "../../../src/crypto/test-key-provider";
import type { VisionDatabase } from "../../../src/data/db";
import { createDiagnosticRepository } from "../../../src/data/repositories/diagnostic-repository";
import {
  createEventRepository,
  type PlaintextEvent,
} from "../../../src/data/repositories/event-repository";
import { createSyncRepository } from "../../../src/data/repositories/sync-repository";
import { ProviderOrderKeySchema } from "../../../src/domain/events/event";
import type { ProviderEventChange } from "../../../src/domain/sync/change";
import { createTestEventRepositoryAccess } from "../../../src/server/authorization/test-event-content-authorization";

const DATABASE_URL_ENV = "VISION_SYNC_CONCURRENCY_TEST_DATABASE_URL";
const APPROVAL_ENV = "VISION_SYNC_CONCURRENCY_TEST_APPROVED";
const OWNER_ID = "owner_sync_correction_race";
const CALENDAR_ID = "calendar_sync_correction_race";
const EVENT_ID = "event_sync_correction_race";
const PROVIDER_EVENT_ID = "provider_event_sync_correction_race";
const ADVISORY_CLASS = 740_004;
const dialect = new PgDialect();
const textEncoder = new TextEncoder();
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
const approvedDatabaseUrl =
  process.env[APPROVAL_ENV] === "true" &&
  typeof configuredDatabaseUrl === "string" &&
  configuredDatabaseUrl.length > 0
    ? configuredDatabaseUrl
    : undefined;
const liveIt = approvedDatabaseUrl === undefined ? it.skip : it;

/** Compiles repository SQL onto one pinned PostgreSQL session. */
function sessionDatabase(client: PoolClient): VisionDatabase {
  return {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      const result = await client.query(query.sql, query.params as unknown[]);
      return { rows: result.rows };
    },
  } as unknown as VisionDatabase;
}

/** Restricts destructive cleanup to a generated test-only schema identifier. */
function quoteTestSchema(schema: string): string {
  if (!/^vision_sync_race_[a-z0-9_]+$/u.test(schema)) {
    throw new Error("Invalid synchronization race-test schema.");
  }
  return `"${schema}"`;
}

/** Waits until one named backend is blocked on the expected PostgreSQL lock class. */
async function waitForLock(
  observer: PoolClient,
  applicationName: string,
  waitEvent?: string,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await observer.query<{
      wait_event: string | null;
      wait_event_type: string | null;
    }>(
      `select wait_event, wait_event_type
       from pg_stat_activity
       where application_name = $1 and state = 'active'`,
      [applicationName],
    );
    if (
      result.rows.some(
        (row) =>
          row.wait_event_type === "Lock" &&
          (waitEvent === undefined || row.wait_event === waitEvent),
      )
    ) {
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  throw new Error("Expected PostgreSQL lock wait was not observed.");
}

/** Pauses synchronization after it loaded the old category but before its SQL begins. */
function activeKeyBarrier(base: KeyProvider): {
  readonly provider: KeyProvider;
  readonly reached: Promise<void>;
  release(): void;
} {
  let reached!: () => void;
  let release!: () => void;
  let blocked = false;
  const reachedPromise = new Promise<void>((resolveReached) => {
    reached = resolveReached;
  });
  const releasePromise = new Promise<void>((resolveRelease) => {
    release = resolveRelease;
  });
  return {
    provider: {
      async getDataKey(ownerId, domain, keyVersion) {
        if (!blocked && domain === "work" && keyVersion === undefined) {
          blocked = true;
          reached();
          await releasePromise;
        }
        return base.getDataKey(ownerId, domain, keyVersion);
      },
    },
    reached: reachedPromise,
    release,
  };
}

/** Produces one newer provider event for the exact lock-wait schedule. */
function newerUpsert(): Extract<ProviderEventChange, { type: "upsert" }> {
  return {
    type: "upsert",
    identity: {
      sourceSystem: "google-calendar",
      sourceCalendarId: CALENDAR_ID,
      sourceEventId: PROVIDER_EVENT_ID,
      sourceVersion: ProviderOrderKeySchema.parse("00000000000000000002"),
    },
    startsAt: "2026-07-25T18:30:00.000Z",
    endsAt: "2026-07-25T19:30:00.000Z",
    timeZone: "America/Chicago",
    busy: true,
    status: "confirmed",
    recurrence: { kind: "single" },
    protected: {
      title: "new provider title",
      description: "new provider description",
      attendees: ["newer@example.test"],
      location: "new provider location",
      meetingLinks: ["https://example.invalid/new-provider-link"],
      attachmentReferences: [],
    },
  };
}

describe("synchronization and category correction on multi-session PostgreSQL", () => {
  liveIt(
    "returns conflict without consuming the cursor when correction wins after the sync snapshot",
    async () => {
      const pool = new Pool({
        connectionString: approvedDatabaseUrl,
        max: 5,
      });
      const admin = await pool.connect();
      const controller = await pool.connect();
      const correctionClient = await pool.connect();
      const syncClient = await pool.connect();
      const observer = await pool.connect();
      const suffix = crypto.randomUUID().replaceAll("-", "");
      const schema = `vision_sync_race_${suffix}`;
      const quotedSchema = quoteTestSchema(schema);
      const advisoryKey = Number.parseInt(suffix.slice(0, 7), 16);
      const correctionApplication = `vision_correction_${suffix.slice(0, 12)}`;
      const syncApplication = `vision_sync_${suffix.slice(0, 12)}`;
      let correctionPromise: Promise<unknown> | undefined;
      let syncPromise: Promise<unknown> | undefined;
      let advisoryHeld = false;

      try {
        await admin.query(`create schema ${quotedSchema}`);
        await admin.query(`set search_path to ${quotedSchema}, public`);
        for (const migration of migrations) {
          await admin.query(
            await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
          );
        }
        for (const client of [controller, correctionClient, syncClient, observer]) {
          await client.query(`set search_path to ${quotedSchema}, public`);
          await client.query(`set statement_timeout to '15s'`);
        }
        await correctionClient.query(
          `select set_config('application_name', $1, false)`,
          [correctionApplication],
        );
        await syncClient.query(
          `select set_config('application_name', $1, false)`,
          [syncApplication],
        );

        const correctionDatabase = sessionDatabase(correctionClient);
        const syncDatabase = sessionDatabase(syncClient);
        const observerDatabase = sessionDatabase(observer);
        const keyProvider = await createTestKeyProvider({
          rootKeyBase64Url: encodeBase64Url(
            crypto.getRandomValues(new Uint8Array(32)),
          ),
        });
        await admin.query(
          `insert into nodes (
             id, owner_id, identity_kind, provider, provider_node_id, node_type,
             domain, domain_state, privacy, provenance, lifecycle, created_at,
             updated_at, valid_from, version, model_confidence
           ) values (
             $1, $2, 'provider', 'google-calendar', $3, 'event',
             'work', 'inferred', 'private', 'model', 'active', now(), now(),
             now(), 1, 900000
           )`,
          [
            EVENT_ID,
            OWNER_ID,
            JSON.stringify([CALENDAR_ID, PROVIDER_EVENT_ID]),
          ],
        );
        await admin.query(
          `insert into node_category_assignments (
             node_id, owner_id, domain, domain_state, provenance, assigned_at, version
           ) values ($1, $2, 'work', 'inferred', 'model', now(), 1)`,
          [EVENT_ID, OWNER_ID],
        );
        const originalEvent: PlaintextEvent = {
          nodeId: EVENT_ID,
          ownerId: OWNER_ID,
          identity: {
            sourceSystem: "google-calendar",
            sourceCalendarId: CALENDAR_ID,
            sourceEventId: PROVIDER_EVENT_ID,
            sourceVersion: ProviderOrderKeySchema.parse("00000000000000000001"),
          },
          startsAt: "2026-07-25T18:00:00.000Z",
          endsAt: "2026-07-25T19:00:00.000Z",
          timeZone: "America/Chicago",
          busy: true,
          status: "confirmed",
          domain: "work",
          domainState: "inferred",
          privacy: "private",
          version: 1,
          title: "old provider title",
          description: "old provider description",
          attendees: ["older@example.test"],
          location: "old provider location",
          meetingLink: "https://example.invalid/old-provider-link",
        };
        await createEventRepository(
          observerDatabase,
          keyProvider,
          createTestEventRepositoryAccess(OWNER_ID),
        ).save(originalEvent);
        const payload = await encryptProtectedFields(
          keyProvider,
          { ownerId: OWNER_ID, nodeId: EVENT_ID, domain: "work" },
          { providerPayload: JSON.stringify(newerUpsert().protected) },
        );
        if (payload.providerPayload === null) {
          throw new Error("Provider payload fixture encryption failed.");
        }
        await admin.query(
          `insert into event_sync_payloads (
             node_id, owner_id, protected_payload_envelope, protected_key_version
           ) values ($1, $2, $3, $4)`,
          [
            EVENT_ID,
            OWNER_ID,
            textEncoder.encode(serializeCipherEnvelope(payload.providerPayload)),
            payload.providerPayload.keyVersion,
          ],
        );
        await admin.query(
          `insert into sync_checkpoints (
             id, owner_id, provider, provider_calendar_id, committed_at, version,
             status, updated_at
           ) values ('checkpoint_sync_race', $1, 'google-calendar', $2, now(), 0,
             'pending', now())`,
          [OWNER_ID, CALENDAR_ID],
        );
        await admin.query(`
          create function pause_user_correction() returns trigger
          language plpgsql as $$
          begin
            if new.provenance = 'user' and old.provenance <> 'user' then
              perform pg_advisory_xact_lock(${ADVISORY_CLASS}, ${advisoryKey});
            end if;
            return new;
          end
          $$;
          create trigger pause_user_correction
          before update on nodes
          for each row execute function pause_user_correction();
        `);

        const barrier = activeKeyBarrier(keyProvider);
        const syncRepository = createSyncRepository(
          syncDatabase,
          barrier.provider,
          OWNER_ID,
        );
        syncPromise = syncRepository.applyChanges({
          ownerId: OWNER_ID,
          calendarId: CALENDAR_ID,
          expectedCheckpointVersion: 0,
          nextCheckpoint: {
            calendarId: CALENDAR_ID,
            syncToken: "sync-token-1",
            committedAt: "2026-07-25T17:00:00.000Z",
            version: 1,
          },
          changes: [newerUpsert()],
          jobId: "sync_job_loses_to_correction",
          reason: "repair",
          pageCount: 1,
          startedAt: "2026-07-25T16:59:00.000Z",
        });
        await barrier.reached;

        await controller.query(
          `select pg_advisory_lock($1, $2)`,
          [ADVISORY_CLASS, advisoryKey],
        );
        advisoryHeld = true;
        const diagnosticRepository = createDiagnosticRepository(
          correctionDatabase,
          keyProvider,
          createTestEventRepositoryAccess(OWNER_ID),
          { databaseUsageWarning: false, r2UsageWarning: false },
        );
        correctionPromise = diagnosticRepository.correctCategory(
          EVENT_ID,
          "school",
          new Date("2026-07-25T17:00:00.000Z"),
        );
        await waitForLock(observer, correctionApplication, "advisory");

        barrier.release();
        await waitForLock(observer, syncApplication);
        await controller.query(
          `select pg_advisory_unlock($1, $2)`,
          [ADVISORY_CLASS, advisoryKey],
        );
        advisoryHeld = false;

        await expect(correctionPromise).resolves.toMatchObject({
          domain: "school",
          version: 2,
        });
        await expect(syncPromise).resolves.toEqual({ outcome: "conflict" });
        expect(
          (
            await observer.query<{
              checkpoint_version: number;
              provider_version: string;
              run_count: number;
            }>(
              `select
                 checkpoint.version as checkpoint_version,
                 event.provider_version,
                 (select count(*)::integer from sync_runs) as run_count
               from sync_checkpoints checkpoint
               cross join events event`,
            )
          ).rows,
        ).toEqual([
          {
            checkpoint_version: 0,
            provider_version: "00000000000000000001",
            run_count: 0,
          },
        ]);

        const retry = createSyncRepository(
          syncDatabase,
          keyProvider,
          OWNER_ID,
        );
        await expect(
          retry.applyChanges({
            ownerId: OWNER_ID,
            calendarId: CALENDAR_ID,
            expectedCheckpointVersion: 0,
            nextCheckpoint: {
              calendarId: CALENDAR_ID,
              syncToken: "sync-token-1",
              committedAt: "2026-07-25T17:01:00.000Z",
              version: 1,
            },
            changes: [newerUpsert()],
            jobId: "sync_job_rebased_after_correction",
            reason: "repair",
            pageCount: 1,
            startedAt: "2026-07-25T17:00:30.000Z",
          }),
        ).resolves.toMatchObject({ outcome: "committed", upserted: 1 });
        await expect(
          createEventRepository(
            observerDatabase,
            keyProvider,
            createTestEventRepositoryAccess(OWNER_ID),
          ).get(EVENT_ID),
        ).resolves.toMatchObject({
          domain: "school",
          domainState: "confirmed",
          version: 2,
          title: "new provider title",
          identity: { sourceVersion: "00000000000000000002" },
        });
      } finally {
        if (advisoryHeld) {
          await controller.query(
            `select pg_advisory_unlock($1, $2)`,
            [ADVISORY_CLASS, advisoryKey],
          ).catch(() => undefined);
        }
        await Promise.allSettled(
          [correctionPromise, syncPromise].filter(
            (promise): promise is Promise<unknown> => promise !== undefined,
          ),
        );
        correctionClient.release();
        syncClient.release();
        observer.release();
        controller.release();
        await admin.query(`drop schema if exists ${quotedSchema} cascade`);
        admin.release();
        await pool.end();
      }
    },
    60_000,
  );
});

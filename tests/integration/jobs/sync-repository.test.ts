import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { KeyProvider } from "../../../src/crypto/key-provider";
import { createTestKeyProvider } from "../../../src/crypto/test-key-provider";
import { createEventRepository } from "../../../src/data/repositories/event-repository";
import { createSyncRepository } from "../../../src/data/repositories/sync-repository";
import type { VisionDatabase } from "../../../src/data/db";
import type { ProviderEventChange } from "../../../src/domain/sync/change";
import type {
  EventSyncClient,
  EventSyncPage,
} from "../../../src/integrations/google-calendar/event-sync-client";
import { syncCalendar } from "../../../src/jobs/sync-calendar";
import { encodeBase64Url } from "../../../src/crypto/envelope";
import { createTestEventRepositoryAccess } from "../../../src/server/authorization/test-event-content-authorization";

const ownerId = "owner-1";
const calendarId = "calendar-1";
const sentinel = "SYNC-PROTECTED-SENTINEL";
let pglite: PGlite;
let database: VisionDatabase;
let keyProvider: KeyProvider;
let executedSql: string[];
const dialect = new PgDialect();

beforeEach(async () => {
  pglite = new PGlite();
  for (const migration of [
    "0001_phase_b_foundation.sql",
    "0002_google_auth_sessions.sql",
    "0003_calendar_setup.sql",
    "0004_incremental_event_sync.sql",
    "0005_google_notification_jobs.sql",
    "0006_google_channel_lifecycle.sql",
    "0007_calendar_maintenance_state.sql",
    "0008_google_projection_rebuild.sql",
    "0009_ai_usage_budget.sql",
  ]) {
    await pglite.exec(
      await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
    );
  }
  const drizzleDatabase = drizzle(pglite);
  executedSql = [];
  database = {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      executedSql.push(query.sql);
      const result = await drizzleDatabase.execute(statement);
      return { rows: result.rows };
    },
  } as unknown as VisionDatabase;
  keyProvider = await createTestKeyProvider({
    rootKeyBase64Url: encodeBase64Url(
      crypto.getRandomValues(new Uint8Array(32)),
    ),
  });
});

afterEach(async () => {
  await pglite.close();
});

function upsert(
  version = "00000000000000000001",
  eventId = "event-1",
): Extract<ProviderEventChange, { type: "upsert" }> {
  return {
    type: "upsert",
    identity: {
      sourceSystem: "google-calendar",
      sourceCalendarId: calendarId,
      sourceEventId: eventId,
      sourceVersion: version as never,
    },
    startsAt: "2026-07-24T15:00:00.000Z",
    endsAt: "2026-07-24T16:00:00.000Z",
    timeZone: "America/Chicago",
    busy: true,
    status: "confirmed",
    recurrence: { kind: "single" },
    protected: {
      title: sentinel,
      description: `description:${sentinel}`,
      attendees: [`person:${sentinel}@example.invalid`],
      location: `location:${sentinel}`,
      meetingLinks: [`https://example.invalid/${sentinel}`],
      attachmentReferences: [
        {
          id: `attachment:${sentinel}`,
          mimeType: "text/plain",
          url: null,
        },
      ],
    },
  };
}

function deletion(): ProviderEventChange {
  return {
    type: "delete",
    target: {
      sourceSystem: "google-calendar",
      sourceCalendarId: calendarId,
      sourceEventId: "event-1",
    },
    recurrence: { kind: "single" },
  };
}

function client(...pages: EventSyncPage[]): EventSyncClient {
  return {
    async listChanges() {
      const page = pages.shift();
      if (!page) throw new Error("Unexpected page request.");
      return page;
    },
  };
}

async function repository() {
  return createSyncRepository(
    database,
    keyProvider,
    ownerId,
  );
}

async function run(
  syncClient: EventSyncClient,
  syncRepository?: Awaited<ReturnType<typeof repository>>,
  jobId: string = crypto.randomUUID(),
) {
  const selectedRepository = syncRepository ?? await repository();
  return syncCalendar(
    { ownerId, calendarId, reason: "repair", jobId },
    {
      client: syncClient,
      repository: selectedRepository,
      now: () => new Date("2026-07-24T15:00:00.000Z"),
      random: () => 0,
    },
  );
}

describe("encrypted atomic synchronization repository", () => {
  it("commits an event, complete protected payload, safe run metrics, and encrypted token together", async () => {
    await expect(
      run(
        client({
          changes: [upsert()],
          calendarTimeZone: "America/Chicago",
          nextSyncToken: "sync-token-1",
        }),
      ),
    ).resolves.toMatchObject({
      checkpointVersion: 1,
      upserted: 1,
      deleted: 0,
    });

    const event = await pglite.query<{
      lifecycle: string;
      status: string;
      title_envelope: Uint8Array;
      protected_payload_envelope: Uint8Array;
    }>(
      `select node.lifecycle, event.status, event.title_envelope,
              payload.protected_payload_envelope
       from events event
       join nodes node on node.id = event.node_id
       join event_sync_payloads payload on payload.node_id = event.node_id`,
    );
    expect(event.rows).toHaveLength(1);
    expect(event.rows[0]).toMatchObject({ lifecycle: "active", status: "confirmed" });
    expect(JSON.stringify(event.rows)).not.toContain(sentinel);

    const checkpoint = await pglite.query<{
      version: number;
      status: string;
      sync_token_envelope: Uint8Array;
    }>(
      `select version, status, sync_token_envelope from sync_checkpoints`,
    );
    expect(checkpoint.rows[0]).toMatchObject({ version: 1, status: "connected" });
    expect(JSON.stringify(checkpoint.rows)).not.toContain("sync-token-1");

    const runRows = await pglite.query(
      `select reason, page_count, staged_count, upserted_count,
              deleted_count, unchanged_count, checkpoint_version
       from sync_runs`,
    );
    expect(runRows.rows).toEqual([
      {
        reason: "repair",
        page_count: 1,
        staged_count: 1,
        upserted_count: 1,
        deleted_count: 0,
        unchanged_count: 0,
        checkpoint_version: 1,
      },
    ]);
    expect(JSON.stringify(runRows.rows)).not.toContain(sentinel);
  });

  it("locks existing nodes and events deterministically before admitting the checkpoint", async () => {
    const syncRepository = await repository();
    await run(
      client({
        changes: [
          upsert("00000000000000000001", "event-z"),
          upsert("00000000000000000001", "event-a"),
        ],
        calendarTimeZone: "America/Chicago",
        nextSyncToken: "sync-token-1",
      }),
      syncRepository,
      "job-lock-order-1",
    );
    await run(
      client({
        changes: [
          upsert("00000000000000000002", "event-a"),
          upsert("00000000000000000002", "event-z"),
        ],
        calendarTimeZone: "America/Chicago",
        nextSyncToken: "sync-token-2",
      }),
      syncRepository,
      "job-lock-order-2",
    );

    const atomicSql = executedSql.findLast((statement) =>
      statement.includes("jsonb_to_recordset"),
    );
    expect(atomicSql).toBeDefined();
    expect(atomicSql).toMatch(
      /locked_nodes as materialized[\s\S]*order by node\.id[\s\S]*for update of node/iu,
    );
    expect(atomicSql).toMatch(
      /locked_events as materialized[\s\S]*inner join locked_nodes[\s\S]*order by event\.node_id[\s\S]*for update of event/iu,
    );
    expect(atomicSql!.indexOf("locked_nodes as materialized")).toBeLessThan(
      atomicSql!.indexOf("locked_events as materialized"),
    );
    expect(atomicSql!.indexOf("locked_events as materialized")).toBeLessThan(
      atomicSql!.indexOf("checkpoint_guard as materialized"),
    );
    expect(atomicSql).toMatch(
      /checkpoint_guard as materialized[\s\S]*cross join context_valid[\s\S]*for update of checkpoint/iu,
    );
    expect(atomicSql).toMatch(
      /eligible_upserts as materialized[\s\S]*cross join checkpoint_guard/iu,
    );
    expect(atomicSql!.indexOf("write_completion as materialized")).toBeLessThan(
      atomicSql!.indexOf("checkpoint_write as"),
    );
    expect(atomicSql).toMatch(
      /checkpoint_write as[\s\S]*cross join write_completion completion[\s\S]*completion\.upserted = completion\."eligibleUpserts"[\s\S]*completion\."payloadWrites" = completion\.upserted/iu,
    );
    expect(atomicSql).toMatch(
      /run_write as[\s\S]*from checkpoint_write[\s\S]*cross join write_completion completion/iu,
    );
  });

  it("rolls back event and checkpoint mutations when the final run record fails, then reruns safely", async () => {
    await pglite.exec(`
      create function fail_sync_run() returns trigger language plpgsql as $$
      begin
        raise exception 'synthetic final write failure';
      end
      $$;
      create trigger fail_sync_run before insert on sync_runs
      for each row execute function fail_sync_run();
    `);
    const syncRepository = await repository();

    await expect(
      run(
        client({
          changes: [upsert()],
          calendarTimeZone: "America/Chicago",
          nextSyncToken: "sync-token-1",
        }),
        syncRepository,
        "job-retry",
      ),
    ).rejects.toMatchObject({ category: "database", retry: true });
    expect((await pglite.query(`select * from events`)).rows).toHaveLength(0);
    expect(
      (await pglite.query<{ version: number }>(`select version from sync_checkpoints`))
        .rows[0]!.version,
    ).toBe(0);

    await pglite.exec(`drop trigger fail_sync_run on sync_runs`);
    await expect(
      run(
        client({
          changes: [upsert()],
          calendarTimeZone: "America/Chicago",
          nextSyncToken: "sync-token-1",
        }),
        syncRepository,
        "job-retry",
      ),
    ).resolves.toMatchObject({ checkpointVersion: 1, upserted: 1 });
    expect((await pglite.query(`select * from events`)).rows).toHaveLength(1);
  });

  it("applies an unversioned tombstone while preserving Vision category metadata and encrypted recovery", async () => {
    const syncRepository = await repository();
    await run(
      client({
        changes: [upsert()],
        calendarTimeZone: "America/Chicago",
        nextSyncToken: "sync-token-1",
      }),
      syncRepository,
      "job-upsert",
    );
    await pglite.exec(`
      update nodes
      set domain = 'work', domain_state = 'confirmed', version = 2
      where node_type = 'event'
    `);
    await expect(
      run(
        client({
          changes: [upsert("00000000000000000002")],
          calendarTimeZone: "America/Chicago",
          nextSyncToken: "sync-token-2",
        }),
        syncRepository,
        "job-upsert-2",
      ),
    ).resolves.toMatchObject({ checkpointVersion: 2, upserted: 1 });

    await expect(
      run(
        client({
          changes: [deletion()],
          calendarTimeZone: "America/Chicago",
          nextSyncToken: "sync-token-3",
        }),
        syncRepository,
        "job-delete",
      ),
    ).resolves.toMatchObject({ checkpointVersion: 3, deleted: 1 });

    const deleted = await pglite.query<{
      domain: string;
      domain_state: string;
      lifecycle: string;
      status: string;
      node_id: string;
    }>(
      `select node.domain, node.domain_state, node.lifecycle, event.status, event.node_id
       from nodes node
       join events event on event.node_id = node.id`,
    );
    expect(deleted.rows[0]).toMatchObject({
      domain: "work",
      domain_state: "confirmed",
      lifecycle: "deleted",
      status: "cancelled",
    });
    expect((await pglite.query(`select * from event_sync_payloads`)).rows).toEqual([]);
    expect((await pglite.query(`select * from recoverable_deletions`)).rows).toHaveLength(1);

    await expect(
      run(
        client({
          changes: [upsert("00000000000000000003")],
          calendarTimeZone: "America/Chicago",
          nextSyncToken: "sync-token-4",
        }),
        syncRepository,
        "job-reactivate",
      ),
    ).resolves.toMatchObject({ checkpointVersion: 4, upserted: 1 });
    const reactivated = await pglite.query<{
      domain: string;
      domain_state: string;
      privacy: string;
      lifecycle: string;
      status: string;
      node_id: string;
    }>(
      `select node.domain, node.domain_state, node.privacy, node.lifecycle,
              event.status, event.node_id
       from nodes node join events event on event.node_id = node.id`,
    );
    expect(reactivated.rows[0]).toMatchObject({
      domain: "work",
      domain_state: "confirmed",
      privacy: "private",
      lifecycle: "active",
      status: "confirmed",
      node_id: deleted.rows[0]!.node_id,
    });
    expect((await pglite.query(`select * from recoverable_deletions`)).rows).toHaveLength(0);
  });

  it("preserves unresolved, confirmed, inferred, and explicit authority across sparse updates", async () => {
    const syncRepository = await repository();
    await run(
      client({
        changes: [upsert()],
        calendarTimeZone: "America/Chicago",
        nextSyncToken: "sync-token-1",
      }),
      syncRepository,
      "job-authority-1",
    );
    const nodeId = (
      await pglite.query<{ node_id: string }>(
        `select node_id from events where provider_event_id = 'event-1'`,
      )
    ).rows[0]!.node_id;
    const eventRepository = createEventRepository(
      database,
      keyProvider,
      createTestEventRepositoryAccess(ownerId),
    );
    const cases = [
      {
        domain: "unresolved",
        domainState: "unresolved",
        provenance: "provider",
        modelConfidence: null,
        nodeVersion: 1,
        assignment: null,
      },
      {
        domain: "personal",
        domainState: "confirmed",
        provenance: "provider",
        modelConfidence: null,
        nodeVersion: 2,
        assignment: null,
      },
      {
        domain: "work",
        domainState: "inferred",
        provenance: "model",
        modelConfidence: 900000,
        nodeVersion: 3,
        assignment: { provenance: "model" },
      },
      {
        domain: "school",
        domainState: "confirmed",
        provenance: "user",
        modelConfidence: null,
        nodeVersion: 4,
        assignment: { provenance: "user" },
      },
    ] as const;

    for (const [index, authority] of cases.entries()) {
      await pglite.query(
        `update nodes
         set domain = $1, domain_state = $2, provenance = $3,
             model_confidence = $4, version = $5
         where id = $6`,
        [
          authority.domain,
          authority.domainState,
          authority.provenance,
          authority.modelConfidence,
          authority.nodeVersion,
          nodeId,
        ],
      );
      await pglite.query(
        `delete from node_category_assignments where node_id = $1`,
        [nodeId],
      );
      if (authority.assignment !== null) {
        await pglite.query(
          `insert into node_category_assignments (
             node_id, owner_id, domain, domain_state, provenance, assigned_at, version
           ) values ($1, $2, $3, $4, $5, now(), $6)`,
          [
            nodeId,
            ownerId,
            authority.domain,
            authority.domainState,
            authority.assignment.provenance,
            authority.nodeVersion,
          ],
        );
      }
      const providerVersion = String(index + 2).padStart(20, "0");
      const sparse = {
        ...upsert(providerVersion),
        protected: {
          title: null,
          description: null,
          attendees: [],
          location: null,
          meetingLinks: [],
          attachmentReferences: [],
        },
      };

      await expect(
        run(
          client({
            changes: [sparse],
            calendarTimeZone: "America/Chicago",
            nextSyncToken: `sync-token-${index + 2}`,
          }),
          syncRepository,
          `job-authority-${index + 2}`,
        ),
      ).resolves.toMatchObject({
        checkpointVersion: index + 2,
        upserted: 1,
        unchanged: 0,
      });

      await expect(eventRepository.get(nodeId)).resolves.toMatchObject({
        domain: authority.domain,
        domainState: authority.domainState,
        version: authority.nodeVersion,
        title: null,
        description: null,
        attendees: [],
        location: null,
        meetingLink: null,
      });
      expect(
        (
          await pglite.query<{
            domain: string;
            domain_state: string;
            provenance: string;
            model_confidence: number | null;
            provider_version: string;
          }>(
            `select node.domain, node.domain_state, node.provenance,
                    node.model_confidence, event.provider_version
             from nodes node
             inner join events event on event.node_id = node.id
             where node.id = $1`,
            [nodeId],
          )
        ).rows,
      ).toEqual([
        {
          domain: authority.domain,
          domain_state: authority.domainState,
          provenance: authority.provenance,
          model_confidence: authority.modelConfidence,
          provider_version: providerVersion,
        },
      ]);
      expect(
        (
          await pglite.query(
            `select domain, domain_state, provenance, version
             from node_category_assignments where node_id = $1`,
            [nodeId],
          )
        ).rows,
      ).toEqual(
        authority.assignment === null
          ? []
          : [
              {
                domain: authority.domain,
                domain_state: authority.domainState,
                provenance: authority.assignment.provenance,
                version: authority.nodeVersion,
              },
            ],
      );
    }
    expect(
      (
        await pglite.query<{ version: number }>(
          `select version from sync_checkpoints`,
        )
      ).rows,
    ).toEqual([{ version: 5 }]);
  });

  it("rejects a stale checkpoint before provider or run writes consume its revision", async () => {
    const syncRepository = await repository();
    await run(
      client({
        changes: [upsert()],
        calendarTimeZone: "America/Chicago",
        nextSyncToken: "sync-token-1",
      }),
      syncRepository,
      "job-current",
    );

    await expect(
      syncRepository.applyChanges({
        ownerId,
        calendarId,
        expectedCheckpointVersion: 0,
        nextCheckpoint: {
          calendarId,
          syncToken: "stale-sync-token",
          committedAt: "2026-07-24T16:00:00.000Z",
          version: 1,
        },
        changes: [upsert("00000000000000000002")],
        jobId: "job-stale",
        reason: "repair",
        pageCount: 1,
        startedAt: "2026-07-24T15:59:00.000Z",
      }),
    ).resolves.toEqual({ outcome: "conflict" });
    expect(
      (
        await pglite.query<{
          checkpoint_version: number;
          provider_version: string;
        }>(
          `select checkpoint.version as checkpoint_version, event.provider_version
           from sync_checkpoints checkpoint cross join events event`,
        )
      ).rows,
    ).toEqual([
      {
        checkpoint_version: 1,
        provider_version: "00000000000000000001",
      },
    ]);
    expect(
      (
        await pglite.query<{ job_id: string }>(
          `select job_id from sync_runs order by job_id`,
        )
      ).rows,
    ).toEqual([{ job_id: "job-current" }]);
  });

  it("does not let a stale failure generation overwrite a newer connected checkpoint", async () => {
    const syncRepository = await repository();
    await run(
      client({
        changes: [upsert()],
        calendarTimeZone: "America/Chicago",
        nextSyncToken: "sync-token-1",
      }),
      syncRepository,
      "job-generation-1",
    );
    await run(
      client({
        changes: [],
        calendarTimeZone: "America/Chicago",
        nextSyncToken: "sync-token-2",
      }),
      syncRepository,
      "job-generation-2",
    );

    await syncRepository.recordFailure({
      ownerId,
      calendarId,
      category: "authorization",
      state: "disconnected",
      occurredAt: "2026-07-24T16:00:00.000Z",
      jobId: "stale-generation-1",
      expectedCheckpointVersion: 1,
    });
    const checkpoint = await pglite.query<{
      version: number;
      status: string;
      last_error_category: string | null;
    }>(`select version, status, last_error_category from sync_checkpoints`);
    expect(checkpoint.rows).toEqual([
      { version: 2, status: "connected", last_error_category: null },
    ]);
  });
});

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestKeyProvider } from "../../../src/crypto/test-key-provider";
import { createSyncRepository } from "../../../src/data/repositories/sync-repository";
import type { VisionDatabase } from "../../../src/data/db";
import type { ProviderEventChange } from "../../../src/domain/sync/change";
import type {
  EventSyncClient,
  EventSyncPage,
} from "../../../src/integrations/google-calendar/event-sync-client";
import { syncCalendar } from "../../../src/jobs/sync-calendar";
import { encodeBase64Url } from "../../../src/crypto/envelope";

const ownerId = "owner-1";
const calendarId = "calendar-1";
const sentinel = "SYNC-PROTECTED-SENTINEL";
let pglite: PGlite;
let database: VisionDatabase;

beforeEach(async () => {
  pglite = new PGlite();
  for (const migration of [
    "0001_phase_b_foundation.sql",
    "0002_google_auth_sessions.sql",
    "0003_calendar_setup.sql",
    "0004_incremental_event_sync.sql",
  ]) {
    await pglite.exec(
      await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
    );
  }
  database = drizzle(pglite) as unknown as VisionDatabase;
});

afterEach(async () => {
  await pglite.close();
});

function upsert(version = "00000000000000000001"): ProviderEventChange {
  return {
    type: "upsert",
    identity: {
      sourceSystem: "google-calendar",
      sourceCalendarId: calendarId,
      sourceEventId: "event-1",
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
    await createTestKeyProvider({
      rootKeyBase64Url: encodeBase64Url(
        crypto.getRandomValues(new Uint8Array(32)),
      ),
    }),
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
      protected_payload_envelope: Uint8Array;
    }>(
      `select node.domain, node.domain_state, node.lifecycle, event.status,
              payload.protected_payload_envelope
       from nodes node
       join events event on event.node_id = node.id
       join event_sync_payloads payload on payload.node_id = node.id`,
    );
    expect(deleted.rows[0]).toMatchObject({
      domain: "work",
      domain_state: "confirmed",
      lifecycle: "deleted",
      status: "cancelled",
    });
    expect(deleted.rows[0]!.protected_payload_envelope).toBeInstanceOf(Uint8Array);
    expect((await pglite.query(`select * from recoverable_deletions`)).rows).toHaveLength(1);
  });
});

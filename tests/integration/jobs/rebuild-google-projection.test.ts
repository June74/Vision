import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  encodeBase64Url,
  serializeCipherEnvelope,
} from "../../../src/crypto/envelope";
import { encryptProtectedFields } from "../../../src/crypto/protected-fields";
import { createTestKeyProvider } from "../../../src/crypto/test-key-provider";
import type { VisionDatabase } from "../../../src/data/db";
import {
  createProjectionRepository,
  type ProjectionRepository,
} from "../../../src/data/repositories/projection-repository";
import { createSyncRepository } from "../../../src/data/repositories/sync-repository";
import type { ProviderEventChange } from "../../../src/domain/sync/change";
import {
  EventSyncClientError,
  type EventSyncClient,
  type EventSyncListRequest,
  type EventSyncPage,
} from "../../../src/integrations/google-calendar/event-sync-client";
import { rebuildGoogleProjection } from "../../../src/jobs/rebuild-google-projection";
import { syncCalendar } from "../../../src/jobs/sync-calendar";

const ownerId = "owner-rebuild";
const calendarId = "calendar-rebuild";
const annotationSentinel = "VISION-ONLY-ANNOTATION-SENTINEL";
const providerSentinel = "PROVIDER-REBUILD-CONTENT-SENTINEL";
let postgres: PGlite;
let database: VisionDatabase;
let keyProvider: Awaited<ReturnType<typeof createTestKeyProvider>>;

beforeEach(async () => {
  postgres = new PGlite();
  for (const migration of [
    "0001_phase_b_foundation.sql",
    "0002_google_auth_sessions.sql",
    "0003_calendar_setup.sql",
    "0004_incremental_event_sync.sql",
    "0005_google_notification_jobs.sql",
    "0006_google_channel_lifecycle.sql",
    "0007_calendar_maintenance_state.sql",
    "0008_google_projection_rebuild.sql",
  ]) {
    await postgres.exec(
      await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
    );
  }
  database = drizzle(postgres) as unknown as VisionDatabase;
  keyProvider = await createTestKeyProvider({
    rootKeyBase64Url: encodeBase64Url(
      crypto.getRandomValues(new Uint8Array(32)),
    ),
  });
});

afterEach(async () => {
  await postgres.close();
});

function upsert(
  eventId: string,
  version: number,
  options: {
    recurrence?:
      | { readonly kind: "single" }
      | { readonly kind: "master"; readonly masterEventId: string }
      | {
          readonly kind: "occurrence";
          readonly masterEventId: string;
          readonly originalStartAt: string;
        };
    title?: string;
  } = {},
): Extract<ProviderEventChange, { type: "upsert" }> {
  const hour = 8 + (eventId.length % 6);
  return {
    type: "upsert",
    identity: {
      sourceSystem: "google-calendar",
      sourceCalendarId: calendarId,
      sourceEventId: eventId,
      sourceVersion: String(version).padStart(20, "0") as never,
    },
    startsAt: `2026-07-25T${String(hour).padStart(2, "0")}:00:00.000Z`,
    endsAt: `2026-07-25T${String(hour + 1).padStart(2, "0")}:00:00.000Z`,
    timeZone: "America/Chicago",
    busy: true,
    status: "confirmed",
    recurrence: options.recurrence ?? { kind: "single" },
    protected: {
      title: options.title ?? `${providerSentinel}:${eventId}:${version}`,
      description: `description:${providerSentinel}:${eventId}`,
      attendees: [],
      location: null,
      meetingLinks: [],
      attachmentReferences: [],
    },
  };
}

function deletion(eventId: string): ProviderEventChange {
  return {
    type: "delete",
    target: {
      sourceSystem: "google-calendar",
      sourceCalendarId: calendarId,
      sourceEventId: eventId,
    },
    recurrence: { kind: "single" },
  };
}

function pageClient(
  handler: (request: EventSyncListRequest) => EventSyncPage | Promise<EventSyncPage>,
): EventSyncClient {
  return { async listChanges(request) { return handler(request); } };
}

async function runInitial(
  changes: readonly ProviderEventChange[],
  syncToken = "initial-sync-token",
) {
  return syncCalendar(
    {
      ownerId,
      calendarId,
      reason: "initial",
      jobId: crypto.randomUUID(),
    },
    {
      client: pageClient(async () => ({
        changes,
        calendarTimeZone: "America/Chicago",
        nextSyncToken: syncToken,
      })),
      repository: createSyncRepository(database, keyProvider, ownerId),
      projectionRepository: createProjectionRepository(
        database,
        keyProvider,
        ownerId,
      ),
      now: () => new Date("2026-07-25T12:00:00.000Z"),
      random: () => 0,
    },
  );
}

async function eventNodeId(eventId: string): Promise<string> {
  const result = await postgres.query<{ node_id: string }>(
    `select node_id from events
     where owner_id = $1 and provider = 'google-calendar'
       and provider_calendar_id = $2 and provider_event_id = $3`,
    [ownerId, calendarId, eventId],
  );
  const nodeId = result.rows[0]?.node_id;
  if (!nodeId) throw new Error("Test event is missing.");
  return nodeId;
}

async function seedVisionMetadata(): Promise<{
  readonly unchangedNodeId: string;
  readonly changedNodeId: string;
  readonly removedNodeId: string;
  readonly explicitRemovedNodeId: string;
  readonly noteNodeId: string;
  readonly annotationBytes: Uint8Array;
}> {
  const unchangedNodeId = await eventNodeId("unchanged");
  const changedNodeId = await eventNodeId("changed");
  const removedNodeId = await eventNodeId("removed");
  const explicitRemovedNodeId = await eventNodeId("explicit-removed");
  const noteNodeId = "vision-note-1";
  await postgres.query(
    `update nodes
     set domain = case id
       when $1 then 'personal'
       when $2 then 'work'
       when $3 then 'school'
       else domain
     end,
     domain_state = case
       when id in ($1, $2, $3) then 'confirmed'
       else domain_state
     end,
     version = case when id in ($1, $2, $3) then 2 else version end
     where owner_id = $4`,
    [unchangedNodeId, changedNodeId, removedNodeId, ownerId],
  );
  await postgres.query(
    `insert into node_category_assignments (
       node_id, owner_id, domain, domain_state, provenance, assigned_at, version
     ) values
       ($1, $4, 'personal', 'confirmed', 'user', '2026-07-25T12:01:00Z', 1),
       ($2, $4, 'work', 'confirmed', 'user', '2026-07-25T12:01:00Z', 1),
       ($3, $4, 'school', 'confirmed', 'user', '2026-07-25T12:01:00Z', 1),
       ($5, $4, 'school', 'confirmed', 'user', '2026-07-25T12:01:00Z', 1)`,
    [
      unchangedNodeId,
      changedNodeId,
      removedNodeId,
      ownerId,
      explicitRemovedNodeId,
    ],
  );
  await postgres.query(
    `insert into nodes (
       id, owner_id, identity_kind, provider, provider_node_id, node_type,
       domain, domain_state, privacy, provenance, lifecycle,
       created_at, updated_at, valid_from, valid_to, version, model_confidence
     ) values (
       $1, $2, 'first_party', 'vision', 'note:rebuild', 'note',
       'personal', 'confirmed', 'private', 'user', 'active',
       '2026-07-25T12:01:00Z', '2026-07-25T12:01:00Z',
       '2026-07-25T12:01:00Z', null, 1, null
     )`,
    [noteNodeId, ownerId],
  );
  await postgres.query(
    `insert into edges (
       id, owner_id, source_node_id, source_node_type,
       destination_node_id, destination_node_type, relation,
       origin, evidence, confidence, lifecycle, privacy,
       valid_from, valid_to, version
     ) values (
       'edge-note-unchanged', $1, $2, 'note', $3, 'event',
       'note_about_event', 'user', 'explicit', null, 'confirmed',
       'private', '2026-07-25T12:01:00Z', null, 1
     ), (
       'edge-note-missing', $1, $2, 'note', $4, 'event',
       'note_about_event', 'user', 'explicit', null, 'confirmed',
       'private', '2026-07-25T12:01:00Z', null, 1
     ), (
       'edge-note-explicit', $1, $2, 'note', $5, 'event',
       'note_about_event', 'user', 'explicit', null, 'confirmed',
       'private', '2026-07-25T12:01:00Z', null, 1
     )`,
    [
      ownerId,
      noteNodeId,
      unchangedNodeId,
      removedNodeId,
      explicitRemovedNodeId,
    ],
  );
  const encrypted = await encryptProtectedFields(
    keyProvider,
    { ownerId, nodeId: unchangedNodeId, domain: "personal" },
    { annotation: annotationSentinel },
  );
  if (encrypted.annotation === null) {
    throw new Error("Test annotation did not encrypt.");
  }
  const annotationBytes = new TextEncoder().encode(
    serializeCipherEnvelope(encrypted.annotation),
  );
  await postgres.query(
    `insert into node_annotations (
       id, owner_id, node_id, provenance, annotation_envelope,
       key_version, created_at, updated_at
     ) values (
       'annotation-1', $1, $2, 'user', $3, $4,
       '2026-07-25T12:01:00Z', '2026-07-25T12:01:00Z'
     )`,
    [
      ownerId,
      unchangedNodeId,
      annotationBytes,
      encrypted.annotation.keyVersion,
    ],
  );
  for (const [id, nodeId] of [
    ["annotation-missing", removedNodeId],
    ["annotation-explicit", explicitRemovedNodeId],
  ] as const) {
    const retained = await encryptProtectedFields(
      keyProvider,
      { ownerId, nodeId, domain: "school" },
      { annotation: `${annotationSentinel}:${id}` },
    );
    if (retained.annotation === null) {
      throw new Error("Deleted-event annotation did not encrypt.");
    }
    await postgres.query(
      `insert into node_annotations (
         id, owner_id, node_id, provenance, annotation_envelope,
         key_version, created_at, updated_at
       ) values ($1, $2, $3, 'user', $4, $5,
         '2026-07-25T12:01:00Z', '2026-07-25T12:01:00Z')`,
      [
        id,
        ownerId,
        nodeId,
        new TextEncoder().encode(serializeCipherEnvelope(retained.annotation)),
        retained.annotation.keyVersion,
      ],
    );
  }
  return {
    unchangedNodeId,
    changedNodeId,
    removedNodeId,
    explicitRemovedNodeId,
    noteNodeId,
    annotationBytes,
  };
}

describe("invalid Google projection rebuild", () => {
  it("rebuilds a full paginated projection while preserving Vision categories, annotation, edge, and recurrence identity", async () => {
    await runInitial([
      upsert("unchanged", 1),
      upsert("changed", 1),
      upsert("removed", 1),
      upsert("explicit-removed", 1),
      upsert("series", 1, {
        recurrence: { kind: "master", masterEventId: "series" },
      }),
      upsert("series_20260725", 1, {
        recurrence: {
          kind: "occurrence",
          masterEventId: "series",
          originalStartAt: "2026-07-25T14:00:00.000Z",
        },
      }),
    ]);
    const metadata = await seedVisionMetadata();
    const requests: EventSyncListRequest[] = [];
    const rebuildPages: EventSyncPage[] = [
      {
        changes: [
          upsert("unchanged", 1),
          upsert("changed", 2, { title: `${providerSentinel}:changed:new` }),
          upsert("series", 1, {
            recurrence: { kind: "master", masterEventId: "series" },
          }),
        ],
        calendarTimeZone: "America/Chicago",
        nextPageToken: "page-2",
      },
      {
        changes: [
          upsert("series_20260725", 1, {
            recurrence: {
              kind: "occurrence",
              masterEventId: "series",
              originalStartAt: "2026-07-25T14:00:00.000Z",
            },
          }),
          upsert("new", 1),
          deletion("explicit-removed"),
        ],
        calendarTimeZone: "America/Chicago",
        nextSyncToken: "rebuilt-sync-token",
      },
    ];
    let incrementalAttempted = false;
    const client = pageClient(async (request) => {
      requests.push({ ...request });
      if (request.syncToken !== undefined) {
        incrementalAttempted = true;
        throw new EventSyncClientError("sync_token_invalid", 410);
      }
      const next = rebuildPages.shift();
      if (!next) throw new Error("Unexpected rebuild page.");
      return next;
    });

    const result = await syncCalendar(
      {
        ownerId,
        calendarId,
        reason: "repair",
        jobId: "job-invalid-token-rebuild",
      },
      {
        client,
        repository: createSyncRepository(database, keyProvider, ownerId),
        projectionRepository: createProjectionRepository(
          database,
          keyProvider,
          ownerId,
        ),
        now: () => new Date("2026-07-25T13:00:00.000Z"),
        random: () => 0,
      },
    );

    expect(incrementalAttempted).toBe(true);
    expect(requests).toEqual([
      { calendarId, syncToken: "initial-sync-token", pageToken: undefined },
      { calendarId, syncToken: undefined, pageToken: undefined },
      { calendarId, syncToken: undefined, pageToken: "page-2" },
    ]);
    expect(result).toMatchObject({
      status: "succeeded",
      reason: "rebuild",
      pages: 2,
      staged: 6,
      upserted: 2,
      deleted: 2,
      unchanged: 3,
      checkpointVersion: 2,
    });

    const eventRows = await postgres.query<{
      node_id: string;
      provider_event_id: string;
      provider_version: string;
      recurrence_id: string | null;
      status: string;
      lifecycle: string;
      domain: string;
      domain_state: string;
      provenance: string;
    }>(
      `select event.node_id, event.provider_event_id, event.provider_version,
              event.recurrence_id, event.status, node.lifecycle, node.domain,
              node.domain_state, node.provenance
       from events event
       join nodes node on node.id = event.node_id and node.owner_id = event.owner_id
       where event.owner_id = $1 and event.provider_calendar_id = $2
       order by event.provider_event_id`,
      [ownerId, calendarId],
    );
    const byId = new Map(eventRows.rows.map((row) => [row.provider_event_id, row]));
    expect(byId.get("unchanged")).toMatchObject({
      node_id: metadata.unchangedNodeId,
      domain: "personal",
      domain_state: "confirmed",
      provenance: "provider",
      lifecycle: "active",
    });
    expect(byId.get("changed")).toMatchObject({
      node_id: metadata.changedNodeId,
      domain: "work",
      domain_state: "confirmed",
      provenance: "provider",
      provider_version: "00000000000000000002",
    });
    expect(byId.get("removed")).toMatchObject({
      node_id: metadata.removedNodeId,
      domain: "school",
      domain_state: "confirmed",
      lifecycle: "deleted",
      status: "cancelled",
    });
    expect(byId.get("explicit-removed")).toMatchObject({
      node_id: metadata.explicitRemovedNodeId,
      lifecycle: "deleted",
      status: "cancelled",
    });
    expect(byId.get("series_20260725")).toMatchObject({
      recurrence_id: "series",
      lifecycle: "active",
    });
    expect(byId.get("new")).toMatchObject({
      domain: "unresolved",
      domain_state: "unresolved",
      lifecycle: "active",
    });
    expect(
      (
        await postgres.query(
          `select node_id, domain, domain_state, provenance, version
           from node_category_assignments
           where node_id <> $1
           order by domain`,
          [metadata.explicitRemovedNodeId],
        )
      ).rows,
    ).toEqual([
      {
        node_id: metadata.unchangedNodeId,
        domain: "personal",
        domain_state: "confirmed",
        provenance: "user",
        version: 1,
      },
      {
        node_id: metadata.removedNodeId,
        domain: "school",
        domain_state: "confirmed",
        provenance: "user",
        version: 1,
      },
      {
        node_id: metadata.changedNodeId,
        domain: "work",
        domain_state: "confirmed",
        provenance: "user",
        version: 1,
      },
    ]);
    expect(
      (
        await postgres.query(
          `select node_id, domain, domain_state, provenance, version
           from node_category_assignments where node_id = $1`,
          [metadata.explicitRemovedNodeId],
        )
      ).rows,
    ).toEqual([
      {
        node_id: metadata.explicitRemovedNodeId,
        domain: "school",
        domain_state: "confirmed",
        provenance: "user",
        version: 1,
      },
    ]);

    expect(
      (
        await postgres.query(
          `select id, source_node_id, destination_node_id, lifecycle
           from edges where id = 'edge-note-unchanged'`,
        )
      ).rows,
    ).toEqual([
      {
        id: "edge-note-unchanged",
        source_node_id: metadata.noteNodeId,
        destination_node_id: metadata.unchangedNodeId,
        lifecycle: "confirmed",
      },
    ]);
    expect(
      (
        await postgres.query(
          `select id, destination_node_id, lifecycle
           from edges where id in ('edge-note-missing', 'edge-note-explicit')
           order by id`,
        )
      ).rows,
    ).toEqual([
      {
        id: "edge-note-explicit",
        destination_node_id: metadata.explicitRemovedNodeId,
        lifecycle: "confirmed",
      },
      {
        id: "edge-note-missing",
        destination_node_id: metadata.removedNodeId,
        lifecycle: "confirmed",
      },
    ]);
    const annotations = await postgres.query<{
      id: string;
      node_id: string;
      annotation_envelope: Uint8Array;
    }>(
      `select id, node_id, annotation_envelope
       from node_annotations where id = 'annotation-1'`,
    );
    expect(annotations.rows).toEqual([
      {
        id: "annotation-1",
        node_id: metadata.unchangedNodeId,
        annotation_envelope: metadata.annotationBytes,
      },
    ]);
    expect(
      (
        await postgres.query(
          `select id, node_id from node_annotations
           where id in ('annotation-missing', 'annotation-explicit')
           order by id`,
        )
      ).rows,
    ).toEqual([
      {
        id: "annotation-explicit",
        node_id: metadata.explicitRemovedNodeId,
      },
      {
        id: "annotation-missing",
        node_id: metadata.removedNodeId,
      },
    ]);
    expect(
      (
        await postgres.query<{ node_id: string }>(
          `select node_id from recoverable_deletions
           where node_id in ($1, $2) order by node_id`,
          [metadata.removedNodeId, metadata.explicitRemovedNodeId],
        )
      ).rows.map(({ node_id }) => node_id).sort(),
    ).toEqual(
      [metadata.removedNodeId, metadata.explicitRemovedNodeId].sort(),
    );
    expect(
      (
        await postgres.query(
          `select node_id from event_sync_payloads
           where node_id in ($1, $2) order by node_id`,
          [metadata.removedNodeId, metadata.explicitRemovedNodeId],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await postgres.query(
          `select status, page_count from projection_rebuild_generations`,
        )
      ).rows,
    ).toEqual([{ status: "activated", page_count: 2 }]);
    expect(
      (await postgres.query(`select * from projection_rebuild_changes`)).rows,
    ).toEqual([]);
    const checkpoint = await postgres.query<{
      version: number;
      status: string;
      sync_token_envelope: Uint8Array;
    }>(
      `select version, status, sync_token_envelope from sync_checkpoints`,
    );
    expect(checkpoint.rows[0]).toMatchObject({ version: 2, status: "connected" });
    expect(JSON.stringify(checkpoint.rows)).not.toContain("rebuilt-sync-token");

    const protectedRows = await postgres.query(
      `select event.title_envelope, event.description_envelope,
              event.attendees_envelope, payload.protected_payload_envelope
       from events event
       join event_sync_payloads payload on payload.node_id = event.node_id`,
    );
    expect(JSON.stringify(protectedRows.rows)).not.toContain(providerSentinel);
    expect(JSON.stringify(annotations.rows)).not.toContain(annotationSentinel);
    expect(
      JSON.stringify(
        (await postgres.query(`select * from projection_rebuild_generations`))
          .rows,
      ),
    ).not.toContain("initial-sync-token");
  });

  it("discards partial incremental pages when a later page invalidates the cursor and activates only the full rebuild", async () => {
    await runInitial([
      upsert("retained-after-late-410", 1),
      upsert("missing-after-late-410", 1),
    ]);
    const requests: EventSyncListRequest[] = [];
    const client = pageClient(async (request) => {
      requests.push({ ...request });
      if (
        request.syncToken === "initial-sync-token" &&
        request.pageToken === undefined
      ) {
        return {
          changes: [upsert("incremental-partial-must-discard", 1)],
          calendarTimeZone: "America/Chicago",
          nextPageToken: "incremental-page-2",
        };
      }
      if (
        request.syncToken === "initial-sync-token" &&
        request.pageToken === "incremental-page-2"
      ) {
        throw new EventSyncClientError("sync_token_invalid", 410);
      }
      if (request.syncToken === undefined && request.pageToken === undefined) {
        return {
          changes: [
            upsert("retained-after-late-410", 2),
            upsert("rebuilt-only", 1),
          ],
          calendarTimeZone: "America/Chicago",
          nextSyncToken: "late-410-rebuilt-token",
        };
      }
      throw new Error("Unexpected late-410 request.");
    });

    await expect(
      syncCalendar(
        {
          ownerId,
          calendarId,
          reason: "repair",
          jobId: "job-late-page-invalid-token",
        },
        {
          client,
          repository: createSyncRepository(database, keyProvider, ownerId),
          projectionRepository: createProjectionRepository(
            database,
            keyProvider,
            ownerId,
          ),
          now: () => new Date("2026-07-25T14:00:00.000Z"),
          random: () => 0,
        },
      ),
    ).resolves.toMatchObject({
      status: "succeeded",
      reason: "rebuild",
      checkpointVersion: 2,
      staged: 2,
    });
    expect(requests).toEqual([
      {
        calendarId,
        syncToken: "initial-sync-token",
        pageToken: undefined,
      },
      {
        calendarId,
        syncToken: "initial-sync-token",
        pageToken: "incremental-page-2",
      },
      { calendarId, syncToken: undefined, pageToken: undefined },
    ]);
    expect(
      (
        await postgres.query(
          `select event.provider_event_id, event.provider_version,
                  event.status, node.lifecycle
           from events event
           join nodes node on node.id = event.node_id
           where event.owner_id = $1 and event.provider_calendar_id = $2
           order by event.provider_event_id`,
          [ownerId, calendarId],
        )
      ).rows,
    ).toEqual([
      {
        provider_event_id: "missing-after-late-410",
        provider_version: "00000000000000000001",
        status: "cancelled",
        lifecycle: "deleted",
      },
      {
        provider_event_id: "rebuilt-only",
        provider_version: "00000000000000000001",
        status: "confirmed",
        lifecycle: "active",
      },
      {
        provider_event_id: "retained-after-late-410",
        provider_version: "00000000000000000002",
        status: "confirmed",
        lifecycle: "active",
      },
    ]);
    expect(
      (
        await postgres.query(
          `select provider_event_id from events
           where provider_event_id = 'incremental-partial-must-discard'`,
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await postgres.query(
          `select version, status from sync_checkpoints
           where owner_id = $1 and provider_calendar_id = $2`,
          [ownerId, calendarId],
        )
      ).rows,
    ).toEqual([{ version: 2, status: "connected" }]);
  });

  it("revives a recoverable event with the same provider revision while retaining its user category", async () => {
    const syncRepository = createSyncRepository(
      database,
      keyProvider,
      ownerId,
    );
    await runInitial([upsert("revival", 1)]);
    const revivalNodeId = await eventNodeId("revival");
    await postgres.query(
      `update nodes
       set domain = 'personal', domain_state = 'confirmed', version = 2
       where id = $1 and owner_id = $2`,
      [revivalNodeId, ownerId],
    );
    await postgres.query(
      `insert into node_category_assignments (
         node_id, owner_id, domain, domain_state, provenance, assigned_at, version
       ) values ($1, $2, 'personal', 'confirmed', 'user', now(), 1)`,
      [revivalNodeId, ownerId],
    );
    await syncCalendar(
      {
        ownerId,
        calendarId,
        reason: "push",
        jobId: "job-delete-before-rebuild",
      },
      {
        client: pageClient(async () => ({
          changes: [deletion("revival")],
          calendarTimeZone: "America/Chicago",
          nextSyncToken: "deleted-sync-token",
        })),
        repository: syncRepository,
        now: () => new Date("2026-07-25T13:30:00.000Z"),
      },
    );
    let invalidated = false;
    const result = await syncCalendar(
      {
        ownerId,
        calendarId,
        reason: "repair",
        jobId: "job-revive-during-rebuild",
      },
      {
        client: pageClient(async (request) => {
          if (request.syncToken !== undefined) {
            invalidated = true;
            throw new EventSyncClientError("sync_token_invalid", 410);
          }
          return {
            changes: [upsert("revival", 1)],
            calendarTimeZone: "America/Chicago",
            nextSyncToken: "revived-sync-token",
          };
        }),
        repository: syncRepository,
        projectionRepository: createProjectionRepository(
          database,
          keyProvider,
          ownerId,
        ),
        now: () => new Date("2026-07-25T14:00:00.000Z"),
      },
    );
    expect(invalidated).toBe(true);
    expect(result).toMatchObject({
      reason: "rebuild",
      upserted: 1,
      deleted: 0,
      checkpointVersion: 3,
    });
    expect(
      (
        await postgres.query(
          `select node.lifecycle, node.domain, event.status, event.node_id
           from nodes node join events event on event.node_id = node.id
           where event.provider_event_id = 'revival'`,
        )
      ).rows,
    ).toEqual([
      {
        lifecycle: "active",
        domain: "personal",
        status: "confirmed",
        node_id: revivalNodeId,
      },
    ]);
    expect(
      (
        await postgres.query(
          `select * from recoverable_deletions where node_id = $1`,
          [revivalNodeId],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await postgres.query(
          `select domain, provenance from node_category_assignments
           where node_id = $1`,
          [revivalNodeId],
        )
      ).rows,
    ).toEqual([{ domain: "personal", provenance: "user" }]);
  });

  it("leaves the active projection and cursor intact when a crash occurs before activation", async () => {
    await runInitial([upsert("crash-safe", 1)]);
    const nodeId = await eventNodeId("crash-safe");
    const productionRepository = createProjectionRepository(
      database,
      keyProvider,
      ownerId,
    );
    const crashingRepository: ProjectionRepository = {
      beginRebuild(input) {
        return productionRepository.beginRebuild(input);
      },
      stageChanges(generationId, ordinalStart, changes) {
        return productionRepository.stageChanges(
          generationId,
          ordinalStart,
          changes,
        );
      },
      async markReady(generationId, pageCount, now) {
        await productionRepository.markReady(generationId, pageCount, now);
        throw new Error("synthetic pre-activation crash");
      },
      loadStagedChanges(generationId) {
        return productionRepository.loadStagedChanges(generationId);
      },
      abandon(generationId, now) {
        return productionRepository.abandon(generationId, now);
      },
      cleanupExpired(now) {
        return productionRepository.cleanupExpired(now);
      },
    };
    await expect(
      syncCalendar(
        {
          ownerId,
          calendarId,
          reason: "repair",
          jobId: "job-crash-before-activation",
        },
        {
          client: pageClient(async (request) => {
            if (request.syncToken !== undefined) {
              throw new EventSyncClientError("sync_token_invalid", 410);
            }
            return {
              changes: [upsert("crash-safe", 2), upsert("never-active", 1)],
              calendarTimeZone: "America/Chicago",
              nextSyncToken: "never-activated-token",
            };
          }),
          repository: createSyncRepository(database, keyProvider, ownerId),
          projectionRepository: crashingRepository,
          now: () => new Date("2026-07-25T15:00:00.000Z"),
          random: () => 0,
        },
      ),
    ).rejects.toMatchObject({ category: "transient", retry: true });
    expect(
      (
        await postgres.query(
          `select version, provider_version, node_id
           from sync_checkpoints checkpoint
           cross join events event
           where event.provider_event_id = 'crash-safe'`,
        )
      ).rows,
    ).toEqual([
      {
        version: 1,
        provider_version: "00000000000000000001",
        node_id: nodeId,
      },
    ]);
    expect(
      (
        await postgres.query(
          `select status from projection_rebuild_generations`,
        )
      ).rows,
    ).toEqual([{ status: "abandoned" }]);
    expect(
      (
        await postgres.query(`select count(*)::integer as count from projection_rebuild_changes`)
      ).rows,
    ).toEqual([{ count: 2 }]);
    expect(
      JSON.stringify(
        (
          await postgres.query(
            `select planning_json, protected_payload_envelope
             from projection_rebuild_changes order by ordinal`,
          )
        ).rows,
      ),
    ).not.toContain(providerSentinel);
    expect(
      (
        await postgres.query(
          `select * from events where provider_event_id = 'never-active'`,
        )
      ).rows,
    ).toEqual([]);
  });

  it("retries the same job after an abandoned pre-activation generation", async () => {
    await runInitial([upsert("retry-generation", 1)]);
    const productionRepository = createProjectionRepository(
      database,
      keyProvider,
      ownerId,
    );
    const crashingRepository: ProjectionRepository = {
      beginRebuild(input) {
        return productionRepository.beginRebuild(input);
      },
      stageChanges(generationId, ordinalStart, changes) {
        return productionRepository.stageChanges(
          generationId,
          ordinalStart,
          changes,
        );
      },
      async markReady(generationId, pageCount, now) {
        await productionRepository.markReady(generationId, pageCount, now);
        throw new Error("synthetic first-attempt crash");
      },
      loadStagedChanges(generationId) {
        return productionRepository.loadStagedChanges(generationId);
      },
      abandon(generationId, now) {
        return productionRepository.abandon(generationId, now);
      },
      cleanupExpired(now) {
        return productionRepository.cleanupExpired(now);
      },
    };
    const request = {
      ownerId,
      calendarId,
      reason: "repair" as const,
      jobId: "job-retry-abandoned-generation",
    };
    const rebuildClient = () =>
      pageClient(async (pageRequest) => {
        if (pageRequest.syncToken !== undefined) {
          throw new EventSyncClientError("sync_token_invalid", 410);
        }
        return {
          changes: [upsert("retry-generation", 2)],
          calendarTimeZone: "America/Chicago",
          nextSyncToken: "retry-generation-token",
        };
      });
    await expect(
      syncCalendar(request, {
        client: rebuildClient(),
        repository: createSyncRepository(database, keyProvider, ownerId),
        projectionRepository: crashingRepository,
        now: () => new Date("2026-07-25T15:30:00.000Z"),
        random: () => 0,
      }),
    ).rejects.toMatchObject({ category: "transient", retry: true });

    await expect(
      syncCalendar(request, {
        client: rebuildClient(),
        repository: createSyncRepository(database, keyProvider, ownerId),
        projectionRepository: productionRepository,
        now: () => new Date("2026-07-25T15:31:00.000Z"),
        random: () => 0,
      }),
    ).resolves.toMatchObject({
      status: "succeeded",
      reason: "rebuild",
      checkpointVersion: 2,
      upserted: 1,
    });
    expect(
      (
        await postgres.query(
          `select status, count(*)::integer as count
           from projection_rebuild_generations group by status`,
        )
      ).rows,
    ).toEqual([{ status: "activated", count: 1 }]);
  });

  it("removes only this owner's nonactivated generations at the seven-day retention boundary", async () => {
    await runInitial([upsert("retention-anchor", 1)]);
    const cleanupNow = new Date("2026-08-02T12:00:00.000Z");
    const cutoff = new Date(cleanupNow.getTime() - 7 * 24 * 60 * 60 * 1_000);
    const recent = new Date(cutoff.getTime() + 1);
    const repository = createProjectionRepository(
      database,
      keyProvider,
      ownerId,
    );
    const otherRepository = createProjectionRepository(
      database,
      keyProvider,
      "owner-rebuild-other",
    );
    const createGeneration = async (
      target: ProjectionRepository,
      input: {
        readonly id: string;
        readonly jobId: string;
        readonly at: Date;
        readonly status: "staging" | "ready" | "abandoned";
        readonly eventId: string;
        readonly owner?: string;
      },
    ) => {
      const generationOwner = input.owner ?? ownerId;
      await target.beginRebuild({
        generationId: input.id,
        ownerId: generationOwner,
        calendarId,
        jobId: input.jobId,
        baseCheckpointVersion: 1,
        now: input.at,
      });
      await target.stageChanges(input.id, 0, [upsert(input.eventId, 2)]);
      if (input.status === "ready") {
        await target.markReady(input.id, 1, input.at);
      } else if (input.status === "abandoned") {
        await target.abandon(input.id, input.at);
      }
    };
    const createJob = async (input: {
      readonly jobId: string;
      readonly owner: string;
      readonly updatedAt: Date;
      readonly status: "failed" | "in_progress";
    }) => {
      const createdAt = new Date(cutoff.getTime() - 1);
      await postgres.query(
        `insert into calendar_sync_jobs (
           job_id, owner_id, provider, provider_calendar_id, reason,
           status, attempts, claim_id, claimed_at, completed_at,
           last_error_category, action_required, checkpoint_version,
           page_count, staged_count, upserted_count, deleted_count,
           unchanged_count, created_at, updated_at
         ) values (
           $1, $2, 'google-calendar', $3, 'rebuild', $4, 1,
           case when $4 = 'in_progress' then 'claim-retention' else null end,
           case when $4 = 'in_progress' then $5::timestamptz else null end,
           case when $4 = 'failed' then $5::timestamptz else null end,
           case when $4 = 'failed' then 'database' else null end,
           false, null, null, null, null, null, null, $6, $5
         )`,
        [
          input.jobId,
          input.owner,
          calendarId,
          input.status,
          input.updatedAt.toISOString(),
          createdAt.toISOString(),
        ],
      );
    };
    await createGeneration(repository, {
      id: "generation-stale-staging",
      jobId: "job-stale-staging",
      at: cutoff,
      status: "staging",
      eventId: "stale-staging",
    });
    await createGeneration(repository, {
      id: "generation-stale-ready",
      jobId: "job-stale-ready",
      at: cutoff,
      status: "ready",
      eventId: "stale-ready",
    });
    await createGeneration(repository, {
      id: "generation-stale-abandoned",
      jobId: "job-stale-abandoned",
      at: cutoff,
      status: "abandoned",
      eventId: "stale-abandoned",
    });
    await createGeneration(repository, {
      id: "generation-recent-abandoned",
      jobId: "job-recent-abandoned",
      at: recent,
      status: "abandoned",
      eventId: "recent-abandoned",
    });
    await createGeneration(repository, {
      id: "generation-stale-failed-job",
      jobId: "job-stale-failed",
      at: cutoff,
      status: "staging",
      eventId: "stale-failed-job",
    });
    await createJob({
      jobId: "job-stale-failed",
      owner: ownerId,
      updatedAt: cutoff,
      status: "failed",
    });
    await createGeneration(repository, {
      id: "generation-stale-recent-job",
      jobId: "job-recent-in-progress",
      at: cutoff,
      status: "ready",
      eventId: "stale-recent-job",
    });
    await createJob({
      jobId: "job-recent-in-progress",
      owner: ownerId,
      updatedAt: recent,
      status: "in_progress",
    });
    await createGeneration(repository, {
      id: "generation-stale-mismatched-job",
      jobId: "job-mismatched-owner",
      at: cutoff,
      status: "abandoned",
      eventId: "stale-mismatched-job",
    });
    await createJob({
      jobId: "job-mismatched-owner",
      owner: "owner-rebuild-other",
      updatedAt: cutoff,
      status: "failed",
    });
    await createGeneration(otherRepository, {
      id: "generation-other-owner-stale",
      jobId: "job-other-owner-stale",
      at: cutoff,
      status: "abandoned",
      eventId: "other-owner-stale",
      owner: "owner-rebuild-other",
    });
    await postgres.query(
      `insert into projection_rebuild_generations (
         id, owner_id, provider, provider_calendar_id, job_id,
         queue_claim_id, base_checkpoint_version, status, page_count,
         created_at, updated_at, activated_at
       ) values (
         'generation-activated-evidence', $1, 'google-calendar', $2,
         'job-activated-evidence', null, 1, 'activated', 1, $3, $3, $3
       )`,
      [ownerId, calendarId, cutoff.toISOString()],
    );

    await expect(repository.cleanupExpired(cleanupNow)).resolves.toBe(4);
    expect(
      (
        await postgres.query(
          `select id, owner_id, status
           from projection_rebuild_generations order by id`,
        )
      ).rows,
    ).toEqual([
      {
        id: "generation-activated-evidence",
        owner_id: ownerId,
        status: "activated",
      },
      {
        id: "generation-other-owner-stale",
        owner_id: "owner-rebuild-other",
        status: "abandoned",
      },
      {
        id: "generation-recent-abandoned",
        owner_id: ownerId,
        status: "abandoned",
      },
      {
        id: "generation-stale-mismatched-job",
        owner_id: ownerId,
        status: "abandoned",
      },
      {
        id: "generation-stale-recent-job",
        owner_id: ownerId,
        status: "ready",
      },
    ]);
    expect(
      (
        await postgres.query(
          `select generation_id from projection_rebuild_changes
           order by generation_id`,
        )
      ).rows,
    ).toEqual([
      { generation_id: "generation-other-owner-stale" },
      { generation_id: "generation-recent-abandoned" },
      { generation_id: "generation-stale-mismatched-job" },
      { generation_id: "generation-stale-recent-job" },
    ]);
  });

  it("serializes stale cleanup against activation without deleting activated evidence or partially replacing projection", async () => {
    await runInitial([upsert("cleanup-race", 1)]);
    const repository = createProjectionRepository(
      database,
      keyProvider,
      ownerId,
    );
    const syncRepository = createSyncRepository(
      database,
      keyProvider,
      ownerId,
    );
    const staleAt = new Date("2026-07-25T12:00:00.000Z");
    const cleanupNow = new Date("2026-08-02T12:00:00.000Z");
    await repository.beginRebuild({
      generationId: "generation-cleanup-activation-race",
      ownerId,
      calendarId,
      jobId: "job-cleanup-activation-race",
      baseCheckpointVersion: 1,
      now: staleAt,
    });
    await repository.stageChanges(
      "generation-cleanup-activation-race",
      0,
      [upsert("cleanup-race", 2)],
    );
    await repository.markReady(
      "generation-cleanup-activation-race",
      1,
      staleAt,
    );
    const staged = await repository.loadStagedChanges(
      "generation-cleanup-activation-race",
    );
    const [activation, removed] = await Promise.all([
      syncRepository.applyChanges({
        ownerId,
        calendarId,
        expectedCheckpointVersion: 1,
        changes: staged,
        nextCheckpoint: {
          calendarId,
          syncToken: "cleanup-race-token",
          committedAt: cleanupNow.toISOString(),
          version: 2,
        },
        jobId: "job-cleanup-activation-race",
        reason: "rebuild",
        pageCount: 1,
        startedAt: staleAt.toISOString(),
        replaceProjection: true,
        rebuildGenerationId: "generation-cleanup-activation-race",
      }),
      repository.cleanupExpired(cleanupNow),
    ]);
    const state = await postgres.query<{
      checkpoint_version: number;
      provider_version: string;
      generation_status: string | null;
    }>(
      `select checkpoint.version as checkpoint_version,
              event.provider_version,
              generation.status as generation_status
       from sync_checkpoints checkpoint
       cross join events event
       left join projection_rebuild_generations generation
         on generation.id = 'generation-cleanup-activation-race'
       where checkpoint.owner_id = $1
         and checkpoint.provider_calendar_id = $2
         and event.provider_event_id = 'cleanup-race'`,
      [ownerId, calendarId],
    );
    if (activation.outcome === "committed") {
      expect(removed).toBe(0);
      expect(state.rows).toEqual([
        {
          checkpoint_version: 2,
          provider_version: "00000000000000000002",
          generation_status: "activated",
        },
      ]);
    } else {
      expect(removed).toBe(1);
      expect(state.rows).toEqual([
        {
          checkpoint_version: 1,
          provider_version: "00000000000000000001",
          generation_status: null,
        },
      ]);
    }
  });

  it("refuses activation after the durable queue claim is superseded", async () => {
    await runInitial([upsert("lease-bound", 1)]);
    await postgres.query(
      `insert into calendar_sync_jobs (
         job_id, owner_id, provider, provider_calendar_id, reason, status,
         attempts, claim_id, claimed_at, completed_at, last_error_category,
         action_required, checkpoint_version, page_count, staged_count,
         upserted_count, deleted_count, unchanged_count, created_at, updated_at
       ) values (
         'job-stale-rebuild', $1, 'google-calendar', $2, 'repair',
         'in_progress', 1, 'claim-old', now(), null, null, false, 1,
         null, null, null, null, null, now(), now()
       )`,
      [ownerId, calendarId],
    );
    await expect(
      syncCalendar(
        {
          ownerId,
          calendarId,
          reason: "repair",
          jobId: "job-stale-rebuild",
          expectedCheckpointVersion: 1,
        },
        {
          client: pageClient(async (request) => {
            if (request.syncToken !== undefined) {
              throw new EventSyncClientError("sync_token_invalid", 410);
            }
            await postgres.query(
              `update calendar_sync_jobs
               set claim_id = 'claim-new', updated_at = clock_timestamp()
               where job_id = 'job-stale-rebuild'`,
            );
            return {
              changes: [upsert("lease-bound", 2)],
              calendarTimeZone: "America/Chicago",
              nextSyncToken: "stale-lease-token",
            };
          }),
          repository: createSyncRepository(database, keyProvider, ownerId),
          projectionRepository: createProjectionRepository(
            database,
            keyProvider,
            ownerId,
          ),
          queueLease: { claimId: "claim-old" },
          persistFailure: false,
          now: () => new Date("2026-07-25T16:00:00.000Z"),
          random: () => 0,
        },
      ),
    ).rejects.toMatchObject({ category: "concurrency", retry: true });
    expect(
      (
        await postgres.query(
          `select checkpoint.version, event.provider_version
           from sync_checkpoints checkpoint
           cross join events event
           where event.provider_event_id = 'lease-bound'`,
        )
      ).rows,
    ).toEqual([
      {
        version: 1,
        provider_version: "00000000000000000001",
      },
    ]);
    expect(
      (
        await postgres.query(
          `select status from projection_rebuild_generations`,
        )
      ).rows,
    ).toEqual([{ status: "abandoned" }]);
  });

  it("activates under the current Queue claim using the original job reason", async () => {
    await runInitial([upsert("active-lease", 1)]);
    await postgres.query(
      `insert into calendar_sync_jobs (
         job_id, owner_id, provider, provider_calendar_id, reason, status,
         attempts, claim_id, claimed_at, completed_at, last_error_category,
         action_required, checkpoint_version, page_count, staged_count,
         upserted_count, deleted_count, unchanged_count, created_at, updated_at
       ) values (
         'job-active-rebuild', $1, 'google-calendar', $2, 'repair',
         'in_progress', 1, 'claim-active', now(), null, null, false, 1,
         null, null, null, null, null, now(), now()
       )`,
      [ownerId, calendarId],
    );
    await expect(
      syncCalendar(
        {
          ownerId,
          calendarId,
          reason: "repair",
          jobId: "job-active-rebuild",
          expectedCheckpointVersion: 1,
        },
        {
          client: pageClient(async (request) => {
            if (request.syncToken !== undefined) {
              throw new EventSyncClientError("sync_token_invalid", 410);
            }
            return {
              changes: [upsert("active-lease", 2)],
              calendarTimeZone: "America/Chicago",
              nextSyncToken: "active-lease-token",
            };
          }),
          repository: createSyncRepository(database, keyProvider, ownerId),
          projectionRepository: createProjectionRepository(
            database,
            keyProvider,
            ownerId,
          ),
          queueLease: { claimId: "claim-active" },
          persistFailure: false,
          now: () => new Date("2026-07-25T16:30:00.000Z"),
          random: () => 0,
        },
      ),
    ).resolves.toMatchObject({
      status: "succeeded",
      reason: "rebuild",
      checkpointVersion: 2,
      upserted: 1,
    });
    expect(
      (
        await postgres.query(
          `select checkpoint.version, event.provider_version
           from sync_checkpoints checkpoint
           cross join events event
           where event.provider_event_id = 'active-lease'`,
        )
      ).rows,
    ).toEqual([
      {
        version: 2,
        provider_version: "00000000000000000002",
      },
    ]);
  });

  it("converges concurrent invalid-token generations through checkpoint CAS without duplicating the projection", async () => {
    await runInitial([upsert("concurrent", 1)]);
    const syncRepository = createSyncRepository(
      database,
      keyProvider,
      ownerId,
    );
    const checkpoint = await syncRepository.loadCheckpoint(ownerId, calendarId);
    if (!checkpoint) throw new Error("Committed test checkpoint is missing.");
    let arrivals = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate;
    });
    const concurrentClient = (): EventSyncClient =>
      pageClient(async () => {
        arrivals += 1;
        if (arrivals === 2) release();
        await gate;
        return {
          changes: [upsert("concurrent", 2), upsert("concurrent-new", 1)],
          calendarTimeZone: "America/Chicago",
          nextSyncToken: `concurrent-token-${arrivals}`,
        };
      });
    const projectionRepository = createProjectionRepository(
      database,
      keyProvider,
      ownerId,
    );
    const settled = await Promise.allSettled([
      rebuildGoogleProjection(ownerId, calendarId, {
        client: concurrentClient(),
        repository: syncRepository,
        projectionRepository,
        checkpoint,
        jobId: "job-concurrent-a",
        now: () => new Date("2026-07-25T17:00:00.000Z"),
      }),
      rebuildGoogleProjection(ownerId, calendarId, {
        client: concurrentClient(),
        repository: syncRepository,
        projectionRepository,
        checkpoint,
        jobId: "job-concurrent-b",
        now: () => new Date("2026-07-25T17:00:00.000Z"),
      }),
    ]);
    expect(settled.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = settled.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { category: "concurrency", retry: true },
    });
    expect(
      (
        await postgres.query(
          `select version from sync_checkpoints
           where owner_id = $1 and provider_calendar_id = $2`,
          [ownerId, calendarId],
        )
      ).rows,
    ).toEqual([{ version: 2 }]);
    expect(
      (
        await postgres.query(
          `select provider_event_id, count(*)::integer as count
           from events
           where owner_id = $1 and provider_calendar_id = $2
           group by provider_event_id
           order by provider_event_id`,
          [ownerId, calendarId],
        )
      ).rows,
    ).toEqual([
      { provider_event_id: "concurrent", count: 1 },
      { provider_event_id: "concurrent-new", count: 1 },
    ]);
    expect(
      (
        await postgres.query(
          `select status, count(*)::integer as count
           from projection_rebuild_generations
           group by status order by status`,
        )
      ).rows,
    ).toEqual([
      { status: "abandoned", count: 1 },
      { status: "activated", count: 1 },
    ]);
  });
});

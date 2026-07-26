import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  encodeBase64Url,
  parseCipherEnvelope,
  serializeCipherEnvelope,
} from "../../../src/crypto/envelope";
import type { KeyProvider } from "../../../src/crypto/key-provider";
import {
  decryptProtectedFields,
  encryptProtectedFields,
} from "../../../src/crypto/protected-fields";
import { createTestKeyProvider } from "../../../src/crypto/test-key-provider";
import type { VisionDatabase } from "../../../src/data/db";
import {
  createDiagnosticRepository,
} from "../../../src/data/repositories/diagnostic-repository";
import {
  createEventRepository,
  type PlaintextEvent,
} from "../../../src/data/repositories/event-repository";
import { createSyncRepository } from "../../../src/data/repositories/sync-repository";
import { ProviderOrderKeySchema } from "../../../src/domain/events/event";
import type { ProviderEventChange } from "../../../src/domain/sync/change";
import { createTestEventRepositoryAccess } from "../../../src/server/authorization/test-event-content-authorization";

const NOW = new Date("2026-07-25T17:00:00.000Z");
const OWNER_ID = "owner_1";
const OTHER_OWNER_ID = "owner_2";
const EVENT_ID = "event_node_1";
const TITLE = "Encrypted diagnostic title";
const PROVIDER_PAYLOAD = JSON.stringify({
  title: TITLE,
  description: "not returned by diagnostics",
  attendees: ["not-returned@example.test"],
  location: "not returned",
  meetingLinks: ["https://example.invalid/not-returned"],
  attachmentReferences: [],
});
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const dialect = new PgDialect();
const migrationNames = [
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

let postgres: PGlite;
let database: VisionDatabase;

beforeEach(async () => {
  postgres = new PGlite();
  for (const migrationName of migrationNames) {
    await postgres.exec(
      await readFile(resolve(process.cwd(), "migrations", migrationName), "utf8"),
    );
  }
  database = {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      const result = await postgres.query(query.sql, query.params as never[]);
      return { rows: result.rows };
    },
  } as unknown as VisionDatabase;
});

afterEach(async () => {
  await postgres.close();
});

async function seedEncryptedEvent(
  protectedOverrides: Partial<
    Pick<
      PlaintextEvent,
      "title" | "description" | "attendees" | "location" | "meetingLink"
    >
  > = {},
): Promise<{
  keyProvider: Awaited<ReturnType<typeof createTestKeyProvider>>;
  event: PlaintextEvent;
}> {
  const event: PlaintextEvent = {
    nodeId: EVENT_ID,
    ownerId: OWNER_ID,
    identity: {
      sourceSystem: "google-calendar",
      sourceCalendarId: "calendar_1",
      sourceEventId: "provider_event_1",
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
    title: TITLE,
    description: "not returned by diagnostics",
    attendees: ["not-returned@example.test"],
    location: "not returned",
    meetingLink: "https://example.invalid/not-returned",
    ...protectedOverrides,
  };
  await postgres.query(
    `insert into nodes (
      id, owner_id, identity_kind, provider, provider_node_id, node_type,
      domain, domain_state, privacy, provenance, lifecycle, created_at,
      updated_at, valid_from, version, model_confidence
    ) values (
      $1, $2, 'provider', 'google-calendar', $4, 'event',
      'work', 'inferred', 'private', 'model', 'active', $3, $3, $3, 1, 900000
    )`,
    [
      EVENT_ID,
      OWNER_ID,
      "2026-07-25T16:00:00.000Z",
      JSON.stringify(["calendar_1", "provider_event_1"]),
    ],
  );
  await postgres.query(
    `insert into node_category_assignments (
      node_id, owner_id, domain, domain_state, provenance, assigned_at, version
    ) values ($1, $2, 'work', 'inferred', 'model', $3, 1)`,
    [EVENT_ID, OWNER_ID, "2026-07-25T16:00:00.000Z"],
  );
  const keyProvider = await createTestKeyProvider({
    rootKeyBase64Url: encodeBase64Url(
      crypto.getRandomValues(new Uint8Array(32)),
    ),
  });
  await createEventRepository(
    database,
    keyProvider,
    createTestEventRepositoryAccess(OWNER_ID),
  ).save(event);
  const encryptedPayload = await encryptProtectedFields(
    keyProvider,
    { ownerId: OWNER_ID, nodeId: EVENT_ID, domain: "work" },
    { providerPayload: PROVIDER_PAYLOAD },
  );
  if (encryptedPayload.providerPayload === null) {
    throw new Error("Test provider payload encryption failed.");
  }
  await postgres.query(
    `insert into event_sync_payloads (
      node_id, owner_id, protected_payload_envelope, protected_key_version
    ) values ($1, $2, $3, $4)`,
    [
      EVENT_ID,
      OWNER_ID,
      textEncoder.encode(serializeCipherEnvelope(encryptedPayload.providerPayload)),
      encryptedPayload.providerPayload.keyVersion,
    ],
  );
  return { keyProvider, event };
}

function syncUpsert(
  version: string,
  title = "newer synchronized title",
): Extract<ProviderEventChange, { type: "upsert" }> {
  return {
    type: "upsert",
    identity: {
      sourceSystem: "google-calendar",
      sourceCalendarId: "calendar_1",
      sourceEventId: "provider_event_1",
      sourceVersion: ProviderOrderKeySchema.parse(version),
    },
    startsAt: "2026-07-25T18:30:00.000Z",
    endsAt: "2026-07-25T19:30:00.000Z",
    timeZone: "America/Chicago",
    busy: true,
    status: "confirmed",
    recurrence: { kind: "single" },
    protected: {
      title,
      description: "newer description",
      attendees: ["newer@example.test"],
      location: "newer location",
      meetingLinks: ["https://example.invalid/newer"],
      attachmentReferences: [],
    },
  };
}

async function seedInitialCheckpoint(): Promise<void> {
  await postgres.query(
    `insert into sync_checkpoints (
      id, owner_id, provider, provider_calendar_id, committed_at, version,
      status, updated_at
    ) values ('checkpoint_1', $1, 'google-calendar', 'calendar_1', $2, 0,
      'pending', $2)`,
    [OWNER_ID, "2026-07-25T16:00:00.000Z"],
  );
}

function activeKeyBarrier(
  base: KeyProvider,
  blockedDomain: "school" | "work" | "personal",
): {
  readonly provider: KeyProvider;
  readonly reached: Promise<void>;
  release(): void;
} {
  let reached!: () => void;
  let release!: () => void;
  let blocked = false;
  const reachedPromise = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const releasePromise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    provider: {
      async getDataKey(ownerId, domain, keyVersion) {
        if (!blocked && domain === blockedDomain && keyVersion === undefined) {
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

describe("diagnostic repository", () => {
  it("lists only owner-authorized display fields and decrypts the title", async () => {
    const { keyProvider } = await seedEncryptedEvent();
    const repository = createDiagnosticRepository(
      database,
      keyProvider,
      createTestEventRepositoryAccess(OWNER_ID),
      { databaseUsageWarning: false, r2UsageWarning: false },
    );
    const wrongOwner = createDiagnosticRepository(
      database,
      keyProvider,
      createTestEventRepositoryAccess(OTHER_OWNER_ID),
      { databaseUsageWarning: false, r2UsageWarning: false },
    );

    await expect(repository.listEvents()).resolves.toEqual([
      {
        id: EVENT_ID,
        title: TITLE,
        startsAt: "2026-07-25T18:00:00.000Z",
        endsAt: "2026-07-25T19:00:00.000Z",
        timeZone: "America/Chicago",
        status: "confirmed",
        domain: "work",
        domainState: "inferred",
        categoryProvenance: "model",
      },
    ]);
    await expect(wrongOwner.listEvents()).resolves.toEqual([]);
  });

  it("rekeys every domain-bound event value while preserving provider and schedule facts", async () => {
    const { keyProvider, event } = await seedEncryptedEvent();
    const repository = createDiagnosticRepository(
      database,
      keyProvider,
      createTestEventRepositoryAccess(OWNER_ID),
      { databaseUsageWarning: false, r2UsageWarning: false },
    );
    const before = await postgres.query<{
      provider: string;
      provider_calendar_id: string;
      provider_event_id: string;
      provider_version: string;
      starts_at: Date;
      ends_at: Date;
      time_zone: string;
      busy: boolean;
      status: string;
      title_envelope: Uint8Array;
      description_envelope: Uint8Array;
      attendees_envelope: Uint8Array;
      location_envelope: Uint8Array;
      meeting_link_envelope: Uint8Array;
      protected_payload_envelope: Uint8Array;
    }>(
      `select
         event.provider, event.provider_calendar_id, event.provider_event_id,
         event.provider_version, event.starts_at, event.ends_at, event.time_zone,
         event.busy, event.status, event.title_envelope,
         event.description_envelope, event.attendees_envelope,
         event.location_envelope, event.meeting_link_envelope,
         payload.protected_payload_envelope
       from events event
       join event_sync_payloads payload on payload.node_id = event.node_id
       where event.node_id = $1`,
      [EVENT_ID],
    );

    await expect(
      repository.correctCategory(EVENT_ID, "school", NOW),
    ).resolves.toEqual({
      id: EVENT_ID,
      domain: "school",
      domainState: "confirmed",
      categoryProvenance: "user",
      assignedAt: NOW.toISOString(),
      version: 2,
    });

    const node = await postgres.query<Record<string, unknown>>(
      `select domain, domain_state, provenance, model_confidence, version
       from nodes where id = $1 and owner_id = $2`,
      [EVENT_ID, OWNER_ID],
    );
    const assignment = await postgres.query<Record<string, unknown>>(
      `select domain, domain_state, provenance, version
       from node_category_assignments where node_id = $1`,
      [EVENT_ID],
    );
    const after = await postgres.query<{
      provider: string;
      provider_calendar_id: string;
      provider_event_id: string;
      provider_version: string;
      starts_at: Date;
      ends_at: Date;
      time_zone: string;
      busy: boolean;
      status: string;
      title_envelope: Uint8Array;
      description_envelope: Uint8Array;
      attendees_envelope: Uint8Array;
      location_envelope: Uint8Array;
      meeting_link_envelope: Uint8Array;
      protected_payload_envelope: Uint8Array;
      protected_key_version: number;
    }>(
      `select
         event.provider, event.provider_calendar_id, event.provider_event_id,
         event.provider_version, event.starts_at, event.ends_at, event.time_zone,
         event.busy, event.status, event.title_envelope,
         event.description_envelope, event.attendees_envelope,
         event.location_envelope, event.meeting_link_envelope,
         payload.protected_payload_envelope, payload.protected_key_version
       from events event
       join event_sync_payloads payload on payload.node_id = event.node_id
       where event.node_id = $1`,
      [EVENT_ID],
    );

    expect(node.rows[0]).toMatchObject({
      domain: "school",
      domain_state: "confirmed",
      provenance: "user",
      model_confidence: null,
      version: 2,
    });
    expect(assignment.rows[0]).toMatchObject({
      domain: "school",
      domain_state: "confirmed",
      provenance: "user",
      version: 2,
    });
    expect(after.rows[0]).toMatchObject({
      provider: before.rows[0]?.provider,
      provider_calendar_id: before.rows[0]?.provider_calendar_id,
      provider_event_id: before.rows[0]?.provider_event_id,
      provider_version: before.rows[0]?.provider_version,
      starts_at: before.rows[0]?.starts_at,
      ends_at: before.rows[0]?.ends_at,
      time_zone: before.rows[0]?.time_zone,
      busy: before.rows[0]?.busy,
      status: before.rows[0]?.status,
    });
    expect(after.rows[0]?.title_envelope).not.toEqual(
      before.rows[0]?.title_envelope,
    );
    expect(after.rows[0]?.description_envelope).not.toEqual(
      before.rows[0]?.description_envelope,
    );
    expect(after.rows[0]?.attendees_envelope).not.toEqual(
      before.rows[0]?.attendees_envelope,
    );
    expect(after.rows[0]?.location_envelope).not.toEqual(
      before.rows[0]?.location_envelope,
    );
    expect(after.rows[0]?.meeting_link_envelope).not.toEqual(
      before.rows[0]?.meeting_link_envelope,
    );
    expect(after.rows[0]?.protected_payload_envelope).not.toEqual(
      before.rows[0]?.protected_payload_envelope,
    );

    await expect(
      createEventRepository(
        database,
        keyProvider,
        createTestEventRepositoryAccess(OWNER_ID),
      ).get(EVENT_ID),
    ).resolves.toEqual({
      ...event,
      domain: "school",
      domainState: "confirmed",
      version: 2,
    });
    await expect(repository.listEvents()).resolves.toEqual([
      expect.objectContaining({
        id: EVENT_ID,
        title: TITLE,
        domain: "school",
        domainState: "confirmed",
        categoryProvenance: "user",
      }),
    ]);

    const payloadEnvelope = parseCipherEnvelope(
      textDecoder.decode(after.rows[0]!.protected_payload_envelope),
    );
    expect(payloadEnvelope.keyVersion).toBe(
      after.rows[0]!.protected_key_version,
    );
    await expect(
      decryptProtectedFields(
        keyProvider,
        { ownerId: OWNER_ID, nodeId: EVENT_ID, domain: "school" },
        { providerPayload: payloadEnvelope },
      ),
    ).resolves.toEqual({ providerPayload: PROVIDER_PAYLOAD });
  });

  it("preserves null protected fields while rekeying the required attendee and provider payload envelopes", async () => {
    const { keyProvider, event } = await seedEncryptedEvent({
      title: null,
      description: null,
      attendees: [],
      location: null,
      meetingLink: null,
    });
    const repository = createDiagnosticRepository(
      database,
      keyProvider,
      createTestEventRepositoryAccess(OWNER_ID),
      { databaseUsageWarning: false, r2UsageWarning: false },
    );

    await expect(
      repository.correctCategory(EVENT_ID, "personal", NOW),
    ).resolves.toMatchObject({
      domain: "personal",
      domainState: "confirmed",
      version: 2,
    });
    await expect(
      createEventRepository(
        database,
        keyProvider,
        createTestEventRepositoryAccess(OWNER_ID),
      ).get(EVENT_ID),
    ).resolves.toEqual({
      ...event,
      domain: "personal",
      domainState: "confirmed",
      version: 2,
    });
    await expect(repository.listEvents()).resolves.toEqual([
      expect.objectContaining({
        id: EVENT_ID,
        title: null,
        domain: "personal",
      }),
    ]);

    const raw = await postgres.query<{
      title_envelope: Uint8Array | null;
      description_envelope: Uint8Array | null;
      attendees_envelope: Uint8Array;
      location_envelope: Uint8Array | null;
      meeting_link_envelope: Uint8Array | null;
      protected_payload_envelope: Uint8Array;
      protected_key_version: number;
    }>(
      `select
         event.title_envelope, event.description_envelope,
         event.attendees_envelope, event.location_envelope,
         event.meeting_link_envelope, payload.protected_payload_envelope,
         payload.protected_key_version
       from events event
       join event_sync_payloads payload on payload.node_id = event.node_id
       where event.node_id = $1`,
      [EVENT_ID],
    );
    expect(raw.rows[0]).toMatchObject({
      title_envelope: null,
      description_envelope: null,
      location_envelope: null,
      meeting_link_envelope: null,
    });
    expect(raw.rows[0]?.attendees_envelope).toBeInstanceOf(Uint8Array);
    const providerEnvelope = parseCipherEnvelope(
      textDecoder.decode(raw.rows[0]!.protected_payload_envelope),
    );
    expect(providerEnvelope.keyVersion).toBe(
      raw.rows[0]!.protected_key_version,
    );
    await expect(
      decryptProtectedFields(
        keyProvider,
        { ownerId: OWNER_ID, nodeId: EVENT_ID, domain: "personal" },
        { providerPayload: providerEnvelope },
      ),
    ).resolves.toEqual({ providerPayload: PROVIDER_PAYLOAD });
  });

  it("does not mutate any row when target-domain encryption fails", async () => {
    const { keyProvider } = await seedEncryptedEvent();
    const failingProvider: KeyProvider = {
      async getDataKey(ownerId, domain, keyVersion) {
        if (domain === "school" && keyVersion === undefined) {
          throw new Error("injected target encryption failure");
        }
        return keyProvider.getDataKey(ownerId, domain, keyVersion);
      },
    };
    const repository = createDiagnosticRepository(
      database,
      failingProvider,
      createTestEventRepositoryAccess(OWNER_ID),
      { databaseUsageWarning: false, r2UsageWarning: false },
    );
    const before = await postgres.query(
      `select
         node.domain, node.domain_state, node.provenance, node.version,
         event.*, payload.protected_payload_envelope,
         payload.protected_key_version as payload_key_version,
         assignment.domain as assignment_domain,
         assignment.domain_state as assignment_domain_state,
         assignment.provenance as assignment_provenance,
         assignment.version as assignment_version
       from nodes node
       join events event on event.node_id = node.id
       join event_sync_payloads payload on payload.node_id = node.id
       left join node_category_assignments assignment on assignment.node_id = node.id
       where node.id = $1`,
      [EVENT_ID],
    );

    await expect(
      repository.correctCategory(EVENT_ID, "school", NOW),
    ).rejects.toThrow("injected target encryption failure");
    const after = await postgres.query(
      `select
         node.domain, node.domain_state, node.provenance, node.version,
         event.*, payload.protected_payload_envelope,
         payload.protected_key_version as payload_key_version,
         assignment.domain as assignment_domain,
         assignment.domain_state as assignment_domain_state,
         assignment.provenance as assignment_provenance,
         assignment.version as assignment_version
       from nodes node
       join events event on event.node_id = node.id
       join event_sync_payloads payload on payload.node_id = node.id
       left join node_category_assignments assignment on assignment.node_id = node.id
       where node.id = $1`,
      [EVENT_ID],
    );
    expect(after.rows).toEqual(before.rows);
  });

  it("rejects stale sync ciphertext prepared before a category correction", async () => {
    const { keyProvider } = await seedEncryptedEvent();
    await seedInitialCheckpoint();
    const syncBarrier = activeKeyBarrier(keyProvider, "work");
    const syncRepository = createSyncRepository(
      database,
      syncBarrier.provider,
      OWNER_ID,
    );
    const syncPromise = syncRepository.applyChanges({
      ownerId: OWNER_ID,
      calendarId: "calendar_1",
      expectedCheckpointVersion: 0,
      nextCheckpoint: {
        calendarId: "calendar_1",
        syncToken: "sync-token-1",
        committedAt: NOW.toISOString(),
        version: 1,
      },
      changes: [syncUpsert("00000000000000000002")],
      jobId: "sync_job_1",
      reason: "repair",
      pageCount: 1,
      startedAt: "2026-07-25T16:59:00.000Z",
    });
    await syncBarrier.reached;

    const diagnosticRepository = createDiagnosticRepository(
      database,
      keyProvider,
      createTestEventRepositoryAccess(OWNER_ID),
      { databaseUsageWarning: false, r2UsageWarning: false },
    );
    await expect(
      diagnosticRepository.correctCategory(EVENT_ID, "school", NOW),
    ).resolves.toMatchObject({ domain: "school", version: 2 });
    syncBarrier.release();

    await expect(syncPromise).resolves.toEqual({ outcome: "conflict" });
    expect(
      (
        await postgres.query<{
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
    await expect(diagnosticRepository.listEvents()).resolves.toEqual([
      expect.objectContaining({
        id: EVENT_ID,
        title: TITLE,
        domain: "school",
      }),
    ]);
  });

  it("retries from the newer provider snapshot when synchronization commits first", async () => {
    const { keyProvider } = await seedEncryptedEvent();
    await seedInitialCheckpoint();
    const correctionBarrier = activeKeyBarrier(keyProvider, "school");
    const diagnosticRepository = createDiagnosticRepository(
      database,
      correctionBarrier.provider,
      createTestEventRepositoryAccess(OWNER_ID),
      { databaseUsageWarning: false, r2UsageWarning: false },
    );
    const correctionPromise = diagnosticRepository.correctCategory(
      EVENT_ID,
      "school",
      NOW,
    );
    await correctionBarrier.reached;

    const syncRepository = createSyncRepository(
      database,
      keyProvider,
      OWNER_ID,
    );
    await expect(
      syncRepository.applyChanges({
        ownerId: OWNER_ID,
        calendarId: "calendar_1",
        expectedCheckpointVersion: 0,
        nextCheckpoint: {
          calendarId: "calendar_1",
          syncToken: "sync-token-1",
          committedAt: NOW.toISOString(),
          version: 1,
        },
        changes: [syncUpsert("00000000000000000002")],
        jobId: "sync_job_2",
        reason: "repair",
        pageCount: 1,
        startedAt: "2026-07-25T16:59:00.000Z",
      }),
    ).resolves.toMatchObject({ outcome: "committed", upserted: 1 });
    correctionBarrier.release();

    await expect(correctionPromise).resolves.toMatchObject({
      domain: "school",
      version: 2,
    });
    expect(
      (
        await postgres.query<{
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
        checkpoint_version: 1,
        provider_version: "00000000000000000002",
        run_count: 1,
      },
    ]);
    await expect(
      createEventRepository(
        database,
        keyProvider,
        createTestEventRepositoryAccess(OWNER_ID),
      ).get(EVENT_ID),
    ).resolves.toMatchObject({
      identity: {
        sourceVersion: "00000000000000000002",
      },
      startsAt: "2026-07-25T18:30:00.000Z",
      endsAt: "2026-07-25T19:30:00.000Z",
      title: "newer synchronized title",
      description: "newer description",
      attendees: ["newer@example.test"],
      location: "newer location",
      meetingLink: "https://example.invalid/newer",
      domain: "school",
      domainState: "confirmed",
      version: 2,
    });
  });

  it("serializes two category corrections and makes a repeated winner idempotent", async () => {
    const { keyProvider } = await seedEncryptedEvent();
    const schoolBarrier = activeKeyBarrier(keyProvider, "school");
    const personalBarrier = activeKeyBarrier(keyProvider, "personal");
    const schoolRepository = createDiagnosticRepository(
      database,
      schoolBarrier.provider,
      createTestEventRepositoryAccess(OWNER_ID),
      { databaseUsageWarning: false, r2UsageWarning: false },
    );
    const personalRepository = createDiagnosticRepository(
      database,
      personalBarrier.provider,
      createTestEventRepositoryAccess(OWNER_ID),
      { databaseUsageWarning: false, r2UsageWarning: false },
    );
    const schoolPromise = schoolRepository.correctCategory(
      EVENT_ID,
      "school",
      new Date("2026-07-25T17:01:00.000Z"),
    );
    const personalPromise = personalRepository.correctCategory(
      EVENT_ID,
      "personal",
      new Date("2026-07-25T17:02:00.000Z"),
    );
    await Promise.all([schoolBarrier.reached, personalBarrier.reached]);
    schoolBarrier.release();
    personalBarrier.release();

    const corrections = await Promise.all([schoolPromise, personalPromise]);
    expect(
      corrections.map((correction) => correction?.version).sort(),
    ).toEqual([2, 3]);
    const winner = corrections.find((correction) => correction?.version === 3);
    expect(winner).toBeDefined();
    const beforeRepeat = await postgres.query<{
      version: number;
      title_envelope: Uint8Array;
      protected_payload_envelope: Uint8Array;
    }>(
      `select
         node.version, event.title_envelope,
         payload.protected_payload_envelope
       from nodes node
       join events event on event.node_id = node.id
       join event_sync_payloads payload on payload.node_id = node.id
       where node.id = $1`,
      [EVENT_ID],
    );

    await expect(
      schoolRepository.correctCategory(
        EVENT_ID,
        winner!.domain,
        new Date("2026-07-25T17:03:00.000Z"),
      ),
    ).resolves.toEqual(winner);
    const afterRepeat = await postgres.query<{
      version: number;
      title_envelope: Uint8Array;
      protected_payload_envelope: Uint8Array;
    }>(
      `select
         node.version, event.title_envelope,
         payload.protected_payload_envelope
       from nodes node
       join events event on event.node_id = node.id
       join event_sync_payloads payload on payload.node_id = node.id
       where node.id = $1`,
      [EVENT_ID],
    );
    expect(afterRepeat.rows).toEqual(beforeRepeat.rows);
    await expect(
      createEventRepository(
        database,
        keyProvider,
        createTestEventRepositoryAccess(OWNER_ID),
      ).get(EVENT_ID),
    ).resolves.toMatchObject({
      domain: winner!.domain,
      domainState: "confirmed",
      version: 3,
      title: TITLE,
    });
  });

  it("cannot correct another owner's event", async () => {
    const { keyProvider } = await seedEncryptedEvent();
    const wrongOwner = createDiagnosticRepository(
      database,
      keyProvider,
      createTestEventRepositoryAccess(OTHER_OWNER_ID),
      { databaseUsageWarning: false, r2UsageWarning: false },
    );

    await expect(
      wrongOwner.correctCategory(EVENT_ID, "school", NOW),
    ).resolves.toBeUndefined();
    await expect(
      createEventRepository(
        database,
        keyProvider,
        createTestEventRepositoryAccess(OWNER_ID),
      ).get(EVENT_ID),
    ).resolves.toMatchObject({
      domain: "work",
      domainState: "inferred",
      version: 1,
      title: TITLE,
    });
  });

  it("does not select or decrypt protected fields without a verified privacy decision", async () => {
    const { keyProvider } = await seedEncryptedEvent();
    await postgres.query(
      "update nodes set privacy = 'restricted' where id = $1 and owner_id = $2",
      [EVENT_ID, OWNER_ID],
    );
    let keyCalls = 0;
    const unreachableKeyProvider: KeyProvider = {
      async getDataKey() {
        keyCalls += 1;
        throw new Error("protected key lookup must remain unreachable");
      },
    };
    const repository = createDiagnosticRepository(
      database,
      unreachableKeyProvider,
      createTestEventRepositoryAccess(
        OWNER_ID,
        (request) => request.privacy !== "restricted",
      ),
      { databaseUsageWarning: false, r2UsageWarning: false },
    );

    await expect(repository.listEvents()).resolves.toEqual([]);
    await expect(
      repository.correctCategory(EVENT_ID, "school", NOW),
    ).rejects.toThrow("Protected event content access is not authorized.");
    expect(keyCalls).toBe(0);
    expect(() =>
      createDiagnosticRepository(
        database,
        keyProvider,
        {
          authenticatedOwnerId: OWNER_ID,
          authorize: () => undefined,
        } as never,
        { databaseUsageWarning: false, r2UsageWarning: false },
      ),
    ).toThrow("Invalid diagnostic repository scope.");
  });

  it("aggregates content-free operational facts for the current Chicago month", async () => {
    const { keyProvider } = await seedEncryptedEvent();
    await postgres.query(
      `insert into google_oauth_tokens (
        owner_id, google_subject, refresh_token_envelope, refresh_token_digest,
        access_token_envelope, access_expires_at, granted_scopes, token_version,
        updated_at
      ) values ($1, 'subject', '\\x01', $2, null, $3, $4, 1, $5)`,
      [
        OWNER_ID,
        "A".repeat(43),
        "2026-07-25T18:00:00.000Z",
        "scope",
        "2026-07-25T16:00:00.000Z",
      ],
    );
    await postgres.query(
      `insert into sync_checkpoints (
        id, owner_id, provider, provider_calendar_id, committed_at, version,
        status, last_error_category, updated_at
      ) values ('checkpoint', $1, 'google-calendar', 'calendar_1', $2, 0,
        'connected', null, $2)`,
      [OWNER_ID, "2026-07-25T16:59:00.000Z"],
    );
    await postgres.query(
      `insert into sync_runs (
        job_id, owner_id, provider, provider_calendar_id, reason, page_count,
        staged_count, upserted_count, deleted_count, unchanged_count,
        started_at, completed_at, checkpoint_version
      ) values ('run', $1, 'google-calendar', 'calendar_1', 'repair', 1,
        1, 1, 0, 0, $2, $3, 1)`,
      [
        OWNER_ID,
        "2026-07-25T16:58:00.000Z",
        "2026-07-25T16:59:00.000Z",
      ],
    );
    await postgres.query(
      `insert into sync_channels (
        id, owner_id, provider, provider_calendar_id, provider_channel_id,
        provider_resource_id, verification_token_envelope, expires_at,
        lifecycle, created_at, activated_at
      ) values ('channel', $1, 'google-calendar', 'calendar_1', 'channel_1',
        'resource_1', '\\x01', $2, 'active', $3, $3)`,
      [
        OWNER_ID,
        "2026-07-27T17:00:00.000Z",
        "2026-07-25T16:00:00.000Z",
      ],
    );
    await postgres.query(
      `insert into calendar_sync_jobs (
        job_id, owner_id, provider, provider_calendar_id, reason, status,
        attempts, created_at, updated_at
      ) values ('job', $1, 'google-calendar', 'calendar_1', 'push',
        'retry_scheduled', 2, $2, $2)`,
      [OWNER_ID, "2026-07-25T16:55:00.000Z"],
    );
    await postgres.query(
      `insert into ai_usage_months (
        owner_id, budget_month, settled_cents, reserved_cents, created_at,
        updated_at
      ) values ($1, '2026-07', 940, 10, $2, $2)`,
      [OWNER_ID, "2026-07-25T16:00:00.000Z"],
    );
    await postgres.query(
      `insert into sync_checkpoints (
        id, owner_id, provider, provider_calendar_id, committed_at, version,
        status, last_error_category, updated_at
      ) values ('foreign_checkpoint', $1, 'future-provider', 'calendar_2', $2,
        0, 'action_required', 'provider', $2)`,
      [OWNER_ID, "2026-07-25T16:59:30.000Z"],
    );
    await postgres.query(
      `insert into sync_runs (
        job_id, owner_id, provider, provider_calendar_id, reason, page_count,
        staged_count, upserted_count, deleted_count, unchanged_count,
        started_at, completed_at, checkpoint_version
      ) values ('foreign_run', $1, 'future-provider', 'calendar_2', 'repair',
        1, 0, 0, 0, 0, $2, $3, 1)`,
      [
        OWNER_ID,
        "2026-07-25T16:59:20.000Z",
        "2026-07-25T16:59:30.000Z",
      ],
    );
    await postgres.query(
      `insert into sync_channels (
        id, owner_id, provider, provider_calendar_id, provider_channel_id,
        provider_resource_id, verification_token_envelope, expires_at,
        lifecycle, created_at, activated_at
      ) values ('foreign_channel', $1, 'future-provider', 'calendar_2',
        'channel_2', 'resource_2', '\\x01', $2, 'active', $3, $3)`,
      [
        OWNER_ID,
        "2026-07-30T17:00:00.000Z",
        "2026-07-25T16:00:00.000Z",
      ],
    );
    await postgres.query(
      `insert into calendar_sync_jobs (
        job_id, owner_id, provider, provider_calendar_id, reason, status,
        attempts, completed_at, last_error_category, action_required,
        created_at, updated_at
      ) values ('foreign_job', $1, 'future-provider', 'calendar_2', 'repair',
        'failed', 5, $2, 'provider', true, $3, $2)`,
      [
        OWNER_ID,
        "2026-07-25T16:59:30.000Z",
        "2026-07-25T16:59:00.000Z",
      ],
    );
    const repository = createDiagnosticRepository(
      database,
      keyProvider,
      createTestEventRepositoryAccess(OWNER_ID),
      { databaseUsageWarning: true, r2UsageWarning: false },
    );

    await expect(repository.readFoundationFacts(NOW)).resolves.toEqual({
      authorizationState: "connected",
      checkpointStatus: "connected",
      lastSuccessfulSyncAt: new Date("2026-07-25T16:59:00.000Z"),
      oldestQueuedJobAt: new Date("2026-07-25T16:55:00.000Z"),
      queueRetryCount: 2,
      failedJobCount: 0,
      channelExpiresAt: new Date("2026-07-27T17:00:00.000Z"),
      databaseAvailable: true,
      databaseUsageWarning: true,
      r2UsageWarning: false,
      aiMonthlyCents: 950,
      safeErrorCode: null,
    });
  });
});

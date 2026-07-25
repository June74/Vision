import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encodeBase64Url } from "../../../src/crypto/envelope";
import { createTestKeyProvider } from "../../../src/crypto/test-key-provider";
import type { VisionDatabase } from "../../../src/data/db";
import {
  createDiagnosticRepository,
} from "../../../src/data/repositories/diagnostic-repository";
import {
  createEventRepository,
  type PlaintextEvent,
} from "../../../src/data/repositories/event-repository";
import { ProviderOrderKeySchema } from "../../../src/domain/events/event";
import { createTestEventRepositoryAccess } from "../../../src/server/authorization/test-event-content-authorization";

const NOW = new Date("2026-07-25T17:00:00.000Z");
const OWNER_ID = "owner_1";
const OTHER_OWNER_ID = "owner_2";
const EVENT_ID = "event_node_1";
const TITLE = "Encrypted diagnostic title";
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

async function seedEncryptedEvent(): Promise<{
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
  };
  await postgres.query(
    `insert into nodes (
      id, owner_id, identity_kind, provider, provider_node_id, node_type,
      domain, domain_state, privacy, provenance, lifecycle, created_at,
      updated_at, valid_from, version, model_confidence
    ) values (
      $1, $2, 'provider', 'google-calendar', 'provider_event_1', 'event',
      'work', 'inferred', 'private', 'model', 'active', $3, $3, $3, 1, 900000
    )`,
    [EVENT_ID, OWNER_ID, "2026-07-25T16:00:00.000Z"],
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
  return { keyProvider, event };
}

describe("diagnostic repository", () => {
  it("lists only owner-authorized display fields and decrypts the title", async () => {
    const { keyProvider } = await seedEncryptedEvent();
    const repository = createDiagnosticRepository(
      database,
      keyProvider,
      OWNER_ID,
      { databaseUsageWarning: false, r2UsageWarning: false },
    );
    const wrongOwner = createDiagnosticRepository(
      database,
      keyProvider,
      OTHER_OWNER_ID,
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

  it("records explicit category authority and leaves provider event state untouched", async () => {
    const { keyProvider } = await seedEncryptedEvent();
    const repository = createDiagnosticRepository(
      database,
      keyProvider,
      OWNER_ID,
      { databaseUsageWarning: false, r2UsageWarning: false },
    );
    const before = await postgres.query<{
      provider_version: string;
      title_envelope: Uint8Array;
    }>(
      "select provider_version, title_envelope from events where node_id = $1",
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
      provider_version: string;
      title_envelope: Uint8Array;
    }>(
      "select provider_version, title_envelope from events where node_id = $1",
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
    expect(after.rows).toEqual(before.rows);
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
      OWNER_ID,
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

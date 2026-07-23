import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAuditWriter } from "../../../src/audit/audit-writer";
import { encodeBase64Url } from "../../../src/crypto/envelope";
import { createTestKeyProvider } from "../../../src/crypto/test-key-provider";
import type { VisionDatabase } from "../../../src/data/db";
import { ProviderOrderKeySchema } from "../../../src/domain/events/event";
import {
  EventContentAccessDeniedError,
  EventNodeSnapshotConflictError,
  EventOwnerMismatchError,
  EventPersistenceConflictError,
  createEventRepository,
  type PlaintextEvent,
} from "../../../src/data/repositories/event-repository";
import { createTestEventRepositoryAccess } from "../../../src/server/authorization/test-event-content-authorization";

const SENTINEL = "VISION_PROTECTED_SENTINEL_7F9A";
const ownerId = "owner_1";
const nodeId = "node_event_1";
const dialect = new PgDialect();

const event: PlaintextEvent = {
  nodeId,
  ownerId,
  identity: {
    sourceSystem: "google_calendar",
    sourceCalendarId: "calendar_1",
    sourceEventId: "event_1",
    sourceVersion: ProviderOrderKeySchema.parse("00000000000000000001"),
  },
  startsAt: "2026-07-23T14:00:00.000Z",
  endsAt: "2026-07-23T15:00:00.000Z",
  timeZone: "America/Chicago",
  busy: true,
  status: "confirmed",
  domain: "work",
  domainState: "confirmed",
  privacy: "private",
  version: 1,
  title: SENTINEL,
  description: SENTINEL,
  attendees: [`person:${SENTINEL}`],
  location: SENTINEL,
  meetingLink: `https://example.invalid/${SENTINEL}`,
};

interface RawEventRow {
  title_envelope: Uint8Array;
  description_envelope: Uint8Array;
  attendees_envelope: Uint8Array;
  location_envelope: Uint8Array;
  meeting_link_envelope: Uint8Array;
  provider_version: string;
}

let pglite: PGlite;
let database: VisionDatabase;
let executedSql: string[];
let repository: ReturnType<typeof createEventRepository>;

async function seedEventNode(id = nodeId, owner = ownerId): Promise<void> {
  await pglite.query(
    `insert into nodes (
      id, owner_id, identity_kind, provider, provider_node_id, node_type, domain, domain_state,
      privacy, provenance, lifecycle, created_at, updated_at, valid_from, version, model_confidence
    ) values ($1, $2, 'provider', 'google_calendar', $3, 'event', 'work', 'confirmed',
      'private', 'provider', 'active', $4, $4, $4, 1, null)`,
    [id, owner, `provider_${id}`, "2026-07-23T12:00:00.000Z"],
  );
}

function countProtectedSelects(): number {
  return executedSql.filter(
    (statement) =>
      statement.trimStart().toLowerCase().startsWith("select") &&
      statement.includes("title_envelope"),
  ).length;
}

async function readRawEvent(): Promise<RawEventRow> {
  const result = await pglite.query<RawEventRow>(
    `select title_envelope, description_envelope, attendees_envelope, location_envelope,
      meeting_link_envelope, provider_version from events where node_id = $1`,
    [nodeId],
  );
  return result.rows[0]!;
}

beforeEach(async () => {
  pglite = new PGlite();
  await pglite.exec(
    await readFile(
      resolve(process.cwd(), "migrations/0001_phase_b_foundation.sql"),
      "utf8",
    ),
  );
  executedSql = [];
  database = {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      executedSql.push(query.sql);
      const result = await pglite.query(query.sql, query.params as never[]);
      return { rows: result.rows };
    },
  } as unknown as VisionDatabase;
  await seedEventNode();
  const keyProvider = await createTestKeyProvider({
    rootKeyBase64Url: encodeBase64Url(crypto.getRandomValues(new Uint8Array(32))),
  });
  repository = createEventRepository(
    database,
    keyProvider,
    createTestEventRepositoryAccess(ownerId),
  );
});

afterEach(async () => {
  await pglite.close();
});

describe("encrypted event repository with production PostgreSQL adapter", () => {
  it("persists only bytea envelopes in actual schema rows", async () => {
    await repository.save(event);

    const raw = await readRawEvent();
    expect(JSON.stringify(raw)).not.toContain(SENTINEL);
    for (const value of [
      raw.title_envelope,
      raw.description_envelope,
      raw.attendees_envelope,
      raw.location_envelope,
      raw.meeting_link_envelope,
    ]) {
      expect(value).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(value)).not.toContain(SENTINEL);
    }
  });

  it("decrypts only through the owner-scoped branded privacy policy decision", async () => {
    await repository.save(event);

    await expect(repository.get(nodeId)).resolves.toEqual(event);
    const protectedReads = countProtectedSelects();

    const wrongOwner = createEventRepository(
      database,
      await createTestKeyProvider({
        rootKeyBase64Url: encodeBase64Url(crypto.getRandomValues(new Uint8Array(32))),
      }),
      createTestEventRepositoryAccess("owner_2"),
    );
    await expect(wrongOwner.get(nodeId)).resolves.toBeUndefined();
    expect(countProtectedSelects()).toBe(protectedReads);

    const denied = createEventRepository(
      database,
      await createTestKeyProvider({
        rootKeyBase64Url: encodeBase64Url(crypto.getRandomValues(new Uint8Array(32))),
      }),
      createTestEventRepositoryAccess(ownerId, () => false),
    );
    await expect(denied.get(nodeId)).rejects.toBeInstanceOf(
      EventContentAccessDeniedError,
    );
    expect(countProtectedSelects()).toBe(protectedReads);
  });

  it("never selects protected columns for planning-only access", async () => {
    await repository.save(event);
    const baseline = countProtectedSelects();

    const planning = await repository.getPlanning(nodeId);

    expect(planning).toMatchObject({ nodeId, ownerId, privacy: "private" });
    expect(JSON.stringify(planning)).not.toContain(SENTINEL);
    expect(countProtectedSelects()).toBe(baseline);
  });

  it("rejects cross-owner saves before encryption or SQL", async () => {
    const keyProvider = await createTestKeyProvider({
      rootKeyBase64Url: encodeBase64Url(crypto.getRandomValues(new Uint8Array(32))),
    });
    const wrongOwner = createEventRepository(
      database,
      keyProvider,
      createTestEventRepositoryAccess("owner_2"),
    );
    const baseline = executedSql.length;

    await expect(wrongOwner.save(event)).rejects.toBeInstanceOf(
      EventOwnerMismatchError,
    );
    expect(executedSql).toHaveLength(baseline);
  });

  it("keeps the strictly newer provider version under concurrent saves", async () => {
    const newer = {
      ...event,
      identity: {
        ...event.identity,
        sourceVersion: ProviderOrderKeySchema.parse("00000000000000000002"),
      },
      version: 2,
      title: `new:${SENTINEL}`,
    };
    await pglite.query(
      "update nodes set version = 2, updated_at = $1 where id = $2",
      ["2026-07-23T13:00:00.000Z", nodeId],
    );

    const olderAtCurrentNode = { ...event, version: 2 };
    await Promise.all([
      repository.save(newer),
      repository.save(olderAtCurrentNode),
    ]);

    expect((await readRawEvent()).provider_version).toBe("00000000000000000002");
    await expect(repository.get(nodeId)).resolves.toEqual(newer);
  });

  it("keeps exact equal-version replays and rejects conflicting equal versions", async () => {
    await repository.save(event);
    const firstRaw = await readRawEvent();

    await repository.save(event);
    const replayRaw = await readRawEvent();
    expect(replayRaw.title_envelope).toEqual(firstRaw.title_envelope);

    await expect(
      repository.save({ ...event, title: `conflict:${SENTINEL}` }),
    ).rejects.toBeInstanceOf(EventPersistenceConflictError);
    expect((await readRawEvent()).title_envelope).toEqual(firstRaw.title_envelope);
  });

  it("rejects a stale node snapshot without changing the persisted event", async () => {
    await repository.save(event);
    const firstRaw = await readRawEvent();
    await pglite.query(
      "update nodes set version = 2, privacy = 'restricted', updated_at = $1 where id = $2",
      ["2026-07-23T13:00:00.000Z", nodeId],
    );

    await expect(
      repository.save({
        ...event,
        identity: {
          ...event.identity,
          sourceVersion: ProviderOrderKeySchema.parse("00000000000000000002"),
        },
      }),
    ).rejects.toBeInstanceOf(EventNodeSnapshotConflictError);

    expect(await readRawEvent()).toEqual(firstRaw);
  });

  it("returns a typed conflict for denied equal replay without selecting envelopes", async () => {
    await repository.save(event);
    const baseline = countProtectedSelects();
    const denied = createEventRepository(
      database,
      await createTestKeyProvider({
        rootKeyBase64Url: encodeBase64Url(crypto.getRandomValues(new Uint8Array(32))),
      }),
      createTestEventRepositoryAccess(ownerId, () => false),
    );

    await expect(denied.save(event)).rejects.toBeInstanceOf(
      EventPersistenceConflictError,
    );
    expect(countProtectedSelects()).toBe(baseline);
  });

  it("never selects protected columns for a cross-owner provider collision", async () => {
    const otherOwner = "owner_2";
    const otherNode = "node_event_2";
    await seedEventNode(otherNode, otherOwner);
    const otherRepository = createEventRepository(
      database,
      await createTestKeyProvider({
        rootKeyBase64Url: encodeBase64Url(crypto.getRandomValues(new Uint8Array(32))),
      }),
      createTestEventRepositoryAccess(otherOwner),
    );
    await otherRepository.save({
      ...event,
      nodeId: otherNode,
      ownerId: otherOwner,
    });
    const baseline = countProtectedSelects();

    await expect(repository.save(event)).rejects.toBeInstanceOf(
      EventPersistenceConflictError,
    );
    expect(countProtectedSelects()).toBe(baseline);
  });

  it("writes the strict audit allowlist into the real audit table", async () => {
    const writer = createAuditWriter(database);
    await writer.write({
      id: "audit_1",
      ownerId,
      nodeId,
      action: "event.saved",
      actorType: "system",
      occurredAt: "2026-07-23T12:00:00.000Z",
      outcome: "succeeded",
      provider: "google_calendar",
    });

    const result = await pglite.query("select * from audit_events where id = 'audit_1'");
    expect(result.rows).toHaveLength(1);
    expect(JSON.stringify(result.rows)).not.toContain(SENTINEL);
    expect(Object.keys(result.rows[0] as object).sort()).toEqual(
      [
        "action",
        "actor_type",
        "error_category",
        "id",
        "node_id",
        "occurred_at",
        "outcome",
        "owner_id",
        "provider",
      ].sort(),
    );
  });
});

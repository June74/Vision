import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDeletionRepository } from "../../../src/data/repositories/deletion-repository";
import type { VisionDatabase } from "../../../src/data/db";
import { createPurgeExpiredDeletionsJob } from "../../../src/jobs/purge-expired-deletions";

const ownerId = "owner_1";
const nodeId = "node_event_1";
const calendarNodeId = "node_calendar_1";
const sentinel = "VISION_PROTECTED_SENTINEL_7F9A";
const deletedAt = new Date("2026-07-23T12:00:00.000Z");
const purgeAfter = new Date("2026-08-22T12:00:00.000Z");
const dialect = new PgDialect();

let pglite: PGlite;
let database: VisionDatabase;

async function seedNode(
  id: string,
  providerNodeId: string,
  nodeType: "event" | "calendar",
): Promise<void> {
  await pglite.query(
    `insert into nodes (
      id, owner_id, identity_kind, provider, provider_node_id, node_type, domain, domain_state,
      privacy, provenance, lifecycle, created_at, updated_at, valid_from, version, model_confidence
    ) values ($1, $2, 'provider', 'google_calendar', $3, $4, 'work', 'confirmed',
      'private', 'provider', 'active', $5, $5, $5, 1, null)`,
    [id, ownerId, providerNodeId, nodeType, deletedAt.toISOString()],
  );
}

beforeEach(async () => {
  pglite = new PGlite();
  await pglite.exec(
    await readFile(resolve(process.cwd(), "migrations/0001_phase_b_foundation.sql"), "utf8"),
  );
  database = {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      const result = await pglite.query(query.sql, query.params as never[]);
      return { rows: result.rows };
    },
  } as unknown as VisionDatabase;
  await seedNode(nodeId, "event_1", "event");
  await seedNode(calendarNodeId, "calendar_1", "calendar");
  await pglite.query(
    `insert into events (
      node_id, owner_id, provider, provider_calendar_id, provider_event_id, provider_version,
      starts_at, ends_at, time_zone, busy, status, title_envelope, attendees_envelope
    ) values ($1, $2, 'google_calendar', 'calendar_1', 'event_1', '1',
      $3, $4, 'America/Chicago', true, 'confirmed', $5, $5)`,
    [
      nodeId,
      ownerId,
      "2026-07-23T14:00:00.000Z",
      "2026-07-23T15:00:00.000Z",
      new TextEncoder().encode(sentinel),
    ],
  );
  await pglite.query(
    `insert into edges (
      id, owner_id, source_node_id, source_node_type, destination_node_id, destination_node_type,
      relation, origin, lifecycle, privacy, version
    ) values ('edge_1', $1, $2, 'event', $3, 'calendar', 'event_in_calendar', 'provider', 'confirmed', 'private', 1)`,
    [ownerId, nodeId, calendarNodeId],
  );
  await pglite.query(
    `insert into audit_events (id, owner_id, node_id, actor_type, action, outcome, occurred_at)
     values ('audit_1', $1, $2, 'system', 'event.saved', 'succeeded', $3)`,
    [ownerId, nodeId, deletedAt.toISOString()],
  );
});

afterEach(async () => {
  await pglite.close();
});

describe("expired-deletion purge job", () => {
  it("deletes ciphertext, connected edges, and recovery data while retaining only privacy-safe audit facts idempotently", async () => {
    const repository = createDeletionRepository(database);
    await repository.markDeleted(nodeId, deletedAt, purgeAfter);
    const job = createPurgeExpiredDeletionsJob(repository);

    expect(await job.purgeExpiredDeletions(purgeAfter)).toEqual({ purgedNodeIds: [nodeId] });
    expect(await pglite.query("select * from events where node_id = $1", [nodeId])).toMatchObject({ rows: [] });
    expect(await pglite.query("select * from edges where source_node_id = $1 or destination_node_id = $1", [nodeId])).toMatchObject({ rows: [] });
    expect(await pglite.query("select * from recoverable_deletions where node_id = $1", [nodeId])).toMatchObject({ rows: [] });
    expect(await pglite.query("select * from nodes where id = $1", [nodeId])).toMatchObject({ rows: [] });

    const audit = await pglite.query("select action, outcome, node_id from audit_events order by id");
    expect(audit.rows).toEqual([
      { action: "event.saved", outcome: "succeeded", node_id: null },
      { action: "record.purged", outcome: "succeeded", node_id: null },
    ]);
    expect(JSON.stringify(audit.rows)).not.toContain(sentinel);
    expect(await job.purgeExpiredDeletions(new Date(purgeAfter.getTime() + 1))).toEqual({ purgedNodeIds: [] });
  });

  it("restores only before expiry without changing persisted ciphertext", async () => {
    const repository = createDeletionRepository(database);
    const ciphertextBefore = await pglite.query("select title_envelope, attendees_envelope from events where node_id = $1", [nodeId]);
    await repository.markDeleted(nodeId, deletedAt, purgeAfter);

    expect(await repository.restoreDeleted(nodeId, new Date(purgeAfter.getTime() - 1))).toBe(true);
    expect(await pglite.query("select title_envelope, attendees_envelope from events where node_id = $1", [nodeId])).toEqual(ciphertextBefore);
    expect((await pglite.query("select lifecycle from nodes where id = $1", [nodeId])).rows).toEqual([{ lifecycle: "active" }]);
    expect(await pglite.query("select * from recoverable_deletions where node_id = $1", [nodeId])).toMatchObject({ rows: [] });
  });
});

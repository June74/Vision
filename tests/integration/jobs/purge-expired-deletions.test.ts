import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DeletionStateConflictError,
  createDeletionPurgeRepository,
  createDeletionRepository,
} from "../../../src/data/repositories/deletion-repository";
import type { VisionDatabase } from "../../../src/data/db";
import { createPurgeExpiredDeletionsJob } from "../../../src/jobs/purge-expired-deletions";
import {
  createTestDeletionPurgeAccess,
  createTestDeletionRepositoryAccess,
} from "../../../src/server/authorization/test-deletion-repository-authorization";

const ownerId = "owner_1";
const otherOwnerId = "owner_2";
const nodeId = "node_event_1";
const calendarNodeId = "node_calendar_1";
const sentinel = "VISION_PROTECTED_SENTINEL_7F9A";
const deletedAt = new Date("2026-07-23T12:00:00.000Z");
const purgeAfter = new Date("2026-08-22T12:00:00.000Z");
const dialect = new PgDialect();

let pglite: PGlite;
let database: VisionDatabase;
let executedSql: string[];

async function seedNode(
  id: string,
  owner: string,
  providerNodeId: string,
  nodeType: "event" | "calendar",
): Promise<void> {
  await pglite.query(
    `insert into nodes (
      id, owner_id, identity_kind, provider, provider_node_id, node_type, domain, domain_state,
      privacy, provenance, lifecycle, created_at, updated_at, valid_from, version, model_confidence
    ) values ($1, $2, 'provider', 'google_calendar', $3, $4, 'work', 'confirmed',
      'private', 'provider', 'active', $5, $5, $5, 1, null)`,
    [id, owner, providerNodeId, nodeType, deletedAt.toISOString()],
  );
}

async function seedEvent(id = nodeId, owner = ownerId, suffix = "1"): Promise<void> {
  await seedNode(id, owner, `event_${suffix}`, "event");
  await pglite.query(
    `insert into events (
      node_id, owner_id, provider, provider_calendar_id, provider_event_id, provider_version,
      starts_at, ends_at, time_zone, busy, status, title_envelope, attendees_envelope
    ) values ($1, $2, 'google_calendar', 'calendar_1', $3, '1',
      $4, $5, 'America/Chicago', true, 'confirmed', $6, $6)`,
    [id, owner, `event_${suffix}`, "2026-07-23T14:00:00.000Z", "2026-07-23T15:00:00.000Z", new TextEncoder().encode(sentinel)],
  );
}

function ownerRepository(owner = ownerId) {
  return createDeletionRepository(database, createTestDeletionRepositoryAccess(owner));
}

function purgeJob() {
  return createPurgeExpiredDeletionsJob(
    createDeletionPurgeRepository(database, createTestDeletionPurgeAccess()),
  );
}

async function markForDeletion(id = nodeId, when = deletedAt, deadline = purgeAfter, owner = ownerId): Promise<void> {
  await ownerRepository(owner).markDeleted(id, when, deadline);
}

async function episodeAuditId(id = nodeId): Promise<string> {
  const result = await pglite.query<{ id: string }>(
    `select 'purge_' || md5(owner_id || chr(31) || node_id || chr(31) || deleted_at::text) as id
     from recoverable_deletions where node_id = $1`,
    [id],
  );
  return result.rows[0]!.id;
}

async function seedPurgeAuditConflict(
  overrides: { readonly occurredAt?: Date; readonly provider?: string | null; readonly errorCategory?: string | null } = {},
): Promise<void> {
  await pglite.query(
    `insert into audit_events (id, owner_id, node_id, actor_type, action, outcome, provider, error_category, occurred_at)
     values ($1, $2, null, 'system', 'record.purged', 'succeeded', $3, $4, $5)`,
    [
      await episodeAuditId(),
      ownerId,
      overrides.provider ?? null,
      overrides.errorCategory ?? null,
      (overrides.occurredAt ?? purgeAfter).toISOString(),
    ],
  );
}

async function expectAuditConflictRollback(): Promise<void> {
  await expect(purgeJob().purgeExpiredDeletions(purgeAfter)).rejects.toThrow();
  expect((await pglite.query("select * from events where node_id = $1", [nodeId])).rows).toHaveLength(1);
  expect((await pglite.query("select * from recoverable_deletions where node_id = $1", [nodeId])).rows).toHaveLength(1);
}

beforeEach(async () => {
  pglite = new PGlite();
  await pglite.exec(await readFile(resolve(process.cwd(), "migrations/0001_phase_b_foundation.sql"), "utf8"));
  executedSql = [];
  database = {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      executedSql.push(query.sql);
      const result = await pglite.query(query.sql, query.params as never[]);
      return { rows: result.rows };
    },
  } as unknown as VisionDatabase;
  await seedEvent();
  await seedNode(calendarNodeId, ownerId, "calendar_1", "calendar");
  await pglite.query(
    `insert into edges (id, owner_id, source_node_id, source_node_type, destination_node_id, destination_node_type, relation, origin, lifecycle, privacy, version)
     values ('edge_1', $1, $2, 'event', $3, 'calendar', 'event_in_calendar', 'provider', 'confirmed', 'private', 1)`,
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
    await markForDeletion();
    const job = purgeJob();

    expect(await job.purgeExpiredDeletions(purgeAfter)).toEqual({ purgedNodeIds: [nodeId] });
    expect((await pglite.query("select * from events where node_id = $1", [nodeId])).rows).toEqual([]);
    expect((await pglite.query("select * from edges where source_node_id = $1 or destination_node_id = $1", [nodeId])).rows).toEqual([]);
    expect((await pglite.query("select * from recoverable_deletions where node_id = $1", [nodeId])).rows).toEqual([]);
    expect((await pglite.query("select * from nodes where id = $1", [nodeId])).rows).toEqual([]);
    const audit = await pglite.query("select action, outcome, node_id from audit_events order by id");
    expect(audit.rows).toEqual([{ action: "event.saved", outcome: "succeeded", node_id: null }, { action: "record.purged", outcome: "succeeded", node_id: null }]);
    expect(JSON.stringify(audit.rows)).not.toContain(sentinel);
    expect(await job.purgeExpiredDeletions(new Date(purgeAfter.getTime() + 1))).toEqual({ purgedNodeIds: [] });
  });

  it("owner-scopes mark and restore so another owner cannot mutate a node or recovery record", async () => {
    await seedEvent("node_event_2", otherOwnerId, "2");
    const other = ownerRepository(otherOwnerId);
    await expect(ownerRepository().markDeleted("node_event_2", deletedAt, purgeAfter)).rejects.toBeInstanceOf(DeletionStateConflictError);
    await other.markDeleted("node_event_2", deletedAt, purgeAfter);
    expect(await ownerRepository().restoreDeleted("node_event_2", new Date(purgeAfter.getTime() - 1))).toBe(false);
    expect((await pglite.query("select lifecycle from nodes where id = 'node_event_2'")).rows).toEqual([{ lifecycle: "deleted" }]);
  });

  it("restores only before expiry without changing ciphertext and makes no mutation at the deadline", async () => {
    const ciphertextBefore = await pglite.query("select title_envelope, attendees_envelope from events where node_id = $1", [nodeId]);
    await markForDeletion();
    expect(await ownerRepository().restoreDeleted(nodeId, purgeAfter)).toBe(false);
    expect(await pglite.query("select title_envelope, attendees_envelope from events where node_id = $1", [nodeId])).toEqual(ciphertextBefore);
    expect((await pglite.query("select lifecycle, version from nodes where id = $1", [nodeId])).rows).toEqual([{ lifecycle: "deleted", version: 2 }]);
    expect(await ownerRepository().restoreDeleted(nodeId, new Date(purgeAfter.getTime() - 1))).toBe(true);
  });

  it("does not purge a fresh record before its deadline and purges fresh records at and after it", async () => {
    await markForDeletion();
    const job = purgeJob();
    expect(await job.purgeExpiredDeletions(new Date(purgeAfter.getTime() - 1))).toEqual({ purgedNodeIds: [] });
    expect(await job.purgeExpiredDeletions(purgeAfter)).toEqual({ purgedNodeIds: [nodeId] });

    const afterNodeId = "node_event_after";
    await seedEvent(afterNodeId, ownerId, "after");
    const afterDeletedAt = new Date("2026-09-01T12:00:00.000Z");
    const afterPurgeAfter = new Date("2026-10-01T12:00:00.000Z");
    await markForDeletion(afterNodeId, afterDeletedAt, afterPurgeAfter);
    expect(await job.purgeExpiredDeletions(new Date(afterPurgeAfter.getTime() + 1))).toEqual({ purgedNodeIds: [afterNodeId] });
  });

  it("aborts the whole purge when an unrelated audit-ID collision exists", async () => {
    await markForDeletion();
    await pglite.query(
      `insert into audit_events (id, owner_id, actor_type, action, outcome, occurred_at)
       values ($1, 'owner_conflict', 'system', 'unrelated.action', 'succeeded', $2)`,
      [await episodeAuditId(), purgeAfter.toISOString()],
    );

    await expectAuditConflictRollback();
  });

  it("aborts when an episode-ID collision has the required fields but a different occurred_at", async () => {
    await markForDeletion();
    await seedPurgeAuditConflict({ occurredAt: new Date(purgeAfter.getTime() - 1) });
    await expectAuditConflictRollback();
  });

  it("aborts when an episode-ID collision retains a provider that the purge fact must not retain", async () => {
    await markForDeletion();
    await seedPurgeAuditConflict({ provider: "google_calendar" });
    await expectAuditConflictRollback();
  });

  it("aborts when an episode-ID collision retains an error category that the purge fact must not retain", async () => {
    await markForDeletion();
    await seedPurgeAuditConflict({ errorCategory: "database_conflict" });
    await expectAuditConflictRollback();
  });

  it("aborts a fully lookalike pre-existing fact because it cannot prove the current recovery episode emitted it", async () => {
    await markForDeletion();
    await seedPurgeAuditConflict();
    await expectAuditConflictRollback();
  });

  it("records distinct purge facts when a node ID is recreated for a later deletion episode", async () => {
    await markForDeletion();
    expect(await purgeJob().purgeExpiredDeletions(purgeAfter)).toEqual({ purgedNodeIds: [nodeId] });
    await seedEvent(nodeId, ownerId, "recreated");
    const nextDeletedAt = new Date("2026-09-01T12:00:00.000Z");
    const nextPurgeAfter = new Date("2026-10-01T12:00:00.000Z");
    await markForDeletion(nodeId, nextDeletedAt, nextPurgeAfter);
    expect(await purgeJob().purgeExpiredDeletions(nextPurgeAfter)).toEqual({ purgedNodeIds: [nodeId] });
    expect((await pglite.query("select * from audit_events where action = 'record.purged'")).rows).toHaveLength(2);
  });

  it("serializes competing restore and purge transitions without a false-result mutation", async () => {
    await markForDeletion();
    const restore = ownerRepository();
    const job = purgeJob();
    const [firstRestore, secondRestore] = await Promise.all([
      restore.restoreDeleted(nodeId, new Date(purgeAfter.getTime() - 1)),
      restore.restoreDeleted(nodeId, new Date(purgeAfter.getTime() - 1)),
    ]);
    expect([firstRestore, secondRestore].sort()).toEqual([false, true]);
    expect((await pglite.query("select lifecycle, version from nodes where id = $1", [nodeId])).rows).toEqual([{ lifecycle: "active", version: 3 }]);

    await seedEvent("node_event_purge", ownerId, "purge");
    await markForDeletion("node_event_purge");
    const [firstPurge, secondPurge] = await Promise.all([
      job.purgeExpiredDeletions(purgeAfter),
      job.purgeExpiredDeletions(purgeAfter),
    ]);
    expect([firstPurge, secondPurge]).toContainEqual({ purgedNodeIds: ["node_event_purge"] });
    expect([firstPurge, secondPurge]).toContainEqual({ purgedNodeIds: [] });

    await seedEvent("node_event_race", ownerId, "race");
    await markForDeletion("node_event_race");
    const [purgeWins, restoreAfterPurge] = await Promise.all([
      job.purgeExpiredDeletions(purgeAfter),
      restore.restoreDeleted("node_event_race", new Date(purgeAfter.getTime() - 1)),
    ]);
    expect(purgeWins.purgedNodeIds).toContain("node_event_race");
    expect(restoreAfterPurge).toBe(false);
    expect((await pglite.query("select * from events where node_id = 'node_event_race'")).rows).toEqual([]);
  });

  it("renders owner predicates, deterministic recovery/node locks, and current eligibility checks", async () => {
    await markForDeletion();
    await ownerRepository().restoreDeleted(nodeId, new Date(purgeAfter.getTime() - 1));
    await markForDeletion();
    await purgeJob().purgeExpiredDeletions(purgeAfter);

    const sqlText = executedSql.join("\n").toLowerCase();
    expect(sqlText).toContain("for update of recovery, node");
    expect(sqlText).toContain("recovery.owner_id =");
    expect(sqlText).toContain("node.lifecycle = 'deleted'");
    expect(sqlText).toContain("recovery.purge_after <=");
  });

  it("keeps test-only authority issuers out of production lifecycle source", async () => {
    const source = await readFile(resolve(process.cwd(), "src/data/repositories/deletion-repository.ts"), "utf8");
    expect(source).not.toContain("test-deletion-repository-authorization");
  });
});

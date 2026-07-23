import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  ProviderOrderKeySchema,
  type VisionEvent,
} from "../../../src/domain/events/event";
import type { NodeEnvelope } from "../../../src/domain/graph/node";
import type { VisionDatabase } from "../../../src/data/db";
import {
  DrizzleGraphRepository,
  GraphIdentityConflictError,
} from "../../../src/data/repositories/graph-repository";

const repositorySource = readFileSync(resolve(process.cwd(), "src/data/repositories/graph-repository.ts"), "utf8");
const dialect = new PgDialect();

const node: NodeEnvelope = {
  id: "node_event_1",
  ownerId: "owner_1",
  identity: {
    kind: "provider",
    system: "calendar",
    id: "provider_node_1",
  },
  nodeType: "event",
  domain: "work",
  domainState: "confirmed",
  privacy: "private",
  provenance: "provider",
  lifecycle: "active",
  createdAt: "2026-07-22T09:00:00.000Z",
  updatedAt: "2026-07-22T09:00:00.000Z",
  validFrom: "2026-07-22T09:00:00.000Z",
  version: 2,
};

const event: VisionEvent = {
  nodeId: node.id,
  ownerId: node.ownerId,
  identity: {
    sourceSystem: "calendar",
    sourceCalendarId: "calendar_1",
    sourceEventId: "event_1",
    sourceVersion: ProviderOrderKeySchema.parse("00000000000000000002"),
  },
  startsAt: "2026-07-22T09:00:00.000Z",
  endsAt: "2026-07-22T10:00:00.000Z",
  timeZone: "America/Chicago",
  busy: true,
  status: "confirmed",
  domain: "work",
  domainState: "confirmed",
  privacy: "private",
  version: 2,
};

interface ReturnedUpsertRow {
  ownerId: string;
  stableId: string;
  identitySystem: string;
  identityScope: string | null;
  identityId: string;
  versionState: "requested" | "newer" | "invalid";
}

function createExecutableBoundary(rows: ReturnedUpsertRow[], failure?: unknown): {
  database: VisionDatabase;
  statements: SQL[];
} {
  const statements: SQL[] = [];
  const database = {
    execute: async (statement: SQL) => {
      statements.push(statement);
      if (failure !== undefined) {
        throw failure;
      }
      return { rows };
    },
  } as unknown as VisionDatabase;

  return { database, statements };
}

function renderStatement(statement: SQL): string {
  return dialect.sqlToQuery(statement).sql.replaceAll('"', "").replace(/\s+/g, " ").trim().toLowerCase();
}

describe("GraphRepository atomic upsert boundary", () => {
  it("classifies a concurrent node conflict from the one statement's returned row", async () => {
    const boundary = createExecutableBoundary([
      {
        ownerId: node.ownerId,
        stableId: node.id,
        identitySystem: node.identity.system,
        identityScope: null,
        identityId: node.identity.id,
        versionState: "newer",
      },
    ]);
    const repository = new DrizzleGraphRepository(boundary.database);

    await expect(repository.upsertNode(node)).resolves.toBe("no_newer_version");
    expect(boundary.statements).toHaveLength(1);
    expect(renderStatement(boundary.statements[0]!)).toContain("with incoming");
  });

  it("treats a concurrent event result at the requested version as applied without a pre-read", async () => {
    const boundary = createExecutableBoundary([
      {
        ownerId: event.ownerId,
        stableId: event.nodeId,
        identitySystem: event.identity.sourceSystem,
        identityScope: event.identity.sourceCalendarId,
        identityId: event.identity.sourceEventId,
        versionState: "requested",
      },
    ]);
    const repository = new DrizzleGraphRepository(boundary.database);

    await expect(repository.upsertEvent(event)).resolves.toBe("applied");
    expect(boundary.statements).toHaveLength(1);
    expect(renderStatement(boundary.statements[0]!)).toContain("with incoming");
  });

  it("rejects cross-owner and changed-stable-ID identities returned by the atomic statement", async () => {
    const crossOwner = createExecutableBoundary([
      {
        ownerId: "owner_2",
        stableId: node.id,
        identitySystem: node.identity.system,
        identityScope: null,
        identityId: node.identity.id,
        versionState: "requested",
      },
    ]);
    const changedStableId = createExecutableBoundary([
      {
        ownerId: event.ownerId,
        stableId: "node_event_other",
        identitySystem: event.identity.sourceSystem,
        identityScope: event.identity.sourceCalendarId,
        identityId: event.identity.sourceEventId,
        versionState: "requested",
      },
    ]);

    await expect(new DrizzleGraphRepository(crossOwner.database).upsertNode(node)).rejects.toBeInstanceOf(
      GraphIdentityConflictError,
    );
    await expect(new DrizzleGraphRepository(changedStableId.database).upsertEvent(event)).rejects.toBeInstanceOf(
      GraphIdentityConflictError,
    );
  });

  it("translates PostgreSQL unique violations without exposing database or provider details", async () => {
    const privateDetails =
      "postgresql://vision_app:private-password@private.example/db provider_node_1 confidential-title";
    const uniqueViolation = Object.assign(new Error(privateDetails), { code: "23505" });
    const boundary = createExecutableBoundary([], uniqueViolation);
    const repository = new DrizzleGraphRepository(boundary.database);

    const caught = await repository.upsertNode(node).catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(GraphIdentityConflictError);
    expect((caught as Error).message).not.toContain("postgresql://");
    expect((caught as Error).message).not.toContain("provider_node_1");
    expect((caught as Error).message).not.toContain("confidential-title");
    expect(boundary.statements).toHaveLength(1);
  });

  it("keeps newer node and provider-event versions and never assigns owner or stable IDs", async () => {
    const nodeBoundary = createExecutableBoundary([
      {
        ownerId: node.ownerId,
        stableId: node.id,
        identitySystem: node.identity.system,
        identityScope: null,
        identityId: node.identity.id,
        versionState: "newer",
      },
    ]);
    const eventBoundary = createExecutableBoundary([
      {
        ownerId: event.ownerId,
        stableId: event.nodeId,
        identitySystem: event.identity.sourceSystem,
        identityScope: event.identity.sourceCalendarId,
        identityId: event.identity.sourceEventId,
        versionState: "newer",
      },
    ]);

    await expect(new DrizzleGraphRepository(nodeBoundary.database).upsertNode(node)).resolves.toBe(
      "no_newer_version",
    );
    await expect(new DrizzleGraphRepository(eventBoundary.database).upsertEvent(event)).resolves.toBe(
      "no_newer_version",
    );

    const nodeSql = renderStatement(nodeBoundary.statements[0]!);
    const eventSql = renderStatement(eventBoundary.statements[0]!);
    const nodeConflictSet = nodeSql.slice(nodeSql.indexOf("do update set"), nodeSql.indexOf("returning"));
    const eventConflictSet = eventSql.slice(eventSql.indexOf("do update set"), eventSql.indexOf("returning"));
    expect(nodeSql).toMatch(/persisted\.version < excluded\.version/);
    expect(nodeConflictSet).not.toMatch(/(?:do update set|,\s)(owner_id|id)\s*=/);
    expect(eventSql).toMatch(/persisted\.provider_version < excluded\.provider_version/);
    expect(eventConflictSet).not.toMatch(/(?:do update set|,\s)(owner_id|node_id)\s*=/);
  });

  it("contains no preflight select in either upsert and preserves the planning-only lookup", () => {
    const nodeUpsert = repositorySource.slice(
      repositorySource.indexOf("async upsertNode"),
      repositorySource.indexOf("async upsertEvent"),
    );
    const eventUpsert = repositorySource.slice(
      repositorySource.indexOf("async upsertEvent"),
      repositorySource.indexOf("async replaceEdges"),
    );
    const lookup = repositorySource.slice(repositorySource.indexOf("async getEventByProviderIdentity"));

    expect(nodeUpsert).not.toContain("this.database.select");
    expect(eventUpsert).not.toContain("this.database.select");
    expect(lookup).toContain(".select({");
    expect(lookup).not.toMatch(
      /titleEnvelope|descriptionEnvelope|attendeesEnvelope|locationEnvelope|meetingLinkEnvelope/,
    );
    expect(repositorySource).toMatch(/pre-existing same-owner event node/i);
  });
});

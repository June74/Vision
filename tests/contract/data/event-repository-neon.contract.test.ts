import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import {
  DrizzleAtomicEventStore,
  EventNodeSnapshotConflictError,
  type StoredEventRow,
} from "../../../src/data/repositories/event-repository";
import {
  ProviderOrderKeySchema,
  VisionEventSchema,
} from "../../../src/domain/events/event";

const dialect = new PgDialect();
const planning = VisionEventSchema.parse({
  nodeId: "node_event_1",
  ownerId: "owner_1",
  identity: {
    sourceSystem: "google_calendar",
    sourceCalendarId: "calendar_1",
    sourceEventId: "event_1",
    sourceVersion: "00000000000000000001",
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
});
const rawPlanning = {
  nodeId: planning.nodeId,
  ownerId: planning.ownerId,
  provider: planning.identity.sourceSystem,
  providerCalendarId: planning.identity.sourceCalendarId,
  providerEventId: planning.identity.sourceEventId,
  providerVersion: planning.identity.sourceVersion,
  startsAt: "2026-07-23 14:00:00+00",
  endsAt: "2026-07-23 15:00:00+00",
  timeZone: planning.timeZone,
  busy: "t",
  status: planning.status,
  recurrenceId: null,
  domain: planning.domain,
  domainState: planning.domainState,
  privacy: planning.privacy,
  version: "1",
};
const stored: StoredEventRow = {
  ...planning,
  titleEnvelope: new Uint8Array([0]),
  descriptionEnvelope: null,
  attendeesEnvelope: new Uint8Array([1, 255]),
  locationEnvelope: null,
  meetingLinkEnvelope: null,
  protectedKeyVersion: 1,
};

function databaseWithRows(
  rowsByCall: readonly (readonly Record<string, unknown>[])[],
): { database: VisionDatabase; statements: SQL[] } {
  const statements: SQL[] = [];
  let call = 0;
  return {
    statements,
    database: {
      execute: async (statement: SQL) => {
        statements.push(statement);
        return { rows: rowsByCall[call++] ?? [] };
      },
    } as unknown as VisionDatabase,
  };
}

function render(statement: SQL): string {
  return dialect.sqlToQuery(statement).sql.replace(/\s+/gu, " ").toLowerCase();
}

class TwoLogicalSessionLockHarness {
  readonly statements: SQL[] = [];
  readonly order: string[] = [];
  private nodeLocked = false;
  private releaseEvent!: () => void;
  private releaseNodeUpdate!: () => void;
  private eligibleReached!: () => void;
  private readonly eventMayCommit = new Promise<void>((resolve) => {
    this.releaseEvent = resolve;
  });
  private readonly nodeMayUpdate = new Promise<void>((resolve) => {
    this.releaseNodeUpdate = resolve;
  });
  readonly eligible = new Promise<void>((resolve) => {
    this.eligibleReached = resolve;
  });

  readonly database = {
    execute: async (statement: SQL) => {
      this.statements.push(statement);
      const rendered = render(statement);
      this.nodeLocked = /\bfor update of node\b/u.test(rendered);
      this.order.push(this.nodeLocked ? "eligible-locked" : "eligible-unlocked");
      this.eligibleReached();
      await this.eventMayCommit;
      this.order.push("event-commit");
      this.nodeLocked = false;
      this.releaseNodeUpdate();
      return { rows: [rawPlanning] };
    },
  } as unknown as VisionDatabase;

  /** Models the node-reclassification session waiting on the row lock owned by the event statement. */
  async updateNodeSnapshot(): Promise<void> {
    this.order.push("node-update-attempt");
    if (this.nodeLocked) {
      await this.nodeMayUpdate;
    }
    this.order.push("node-update-commit");
  }

  /** Allows the event statement to commit and release its simulated row lock. */
  commitEvent(): void {
    this.releaseEvent();
  }
}

describe("event repository Neon raw-response contract", () => {
  it("strictly decodes raw text booleans, integers, timestamps, and canonical bytea", async () => {
    const boundary = databaseWithRows([
      [rawPlanning],
      [
        {
          ...rawPlanning,
          titleEnvelope: "\\x00",
          descriptionEnvelope: null,
          attendeesEnvelope: "\\x01ff",
          locationEnvelope: null,
          meetingLinkEnvelope: null,
          protectedKeyVersion: "1",
        },
      ],
    ]);
    const store = new DrizzleAtomicEventStore(boundary.database);

    await expect(store.selectPlanningEvent(planning.nodeId, planning.ownerId)).resolves.toEqual(
      planning,
    );
    await expect(
      store.selectProtectedEvent(
        planning.nodeId,
        planning.ownerId,
        planning.version,
        planning.identity.sourceVersion,
      ),
    ).resolves.toEqual(stored);
  });

  it("rejects noncanonical raw cells instead of coercing them", async () => {
    for (const invalid of [
      { busy: "true" },
      { version: "01" },
      { startsAt: "2026-07-23 14:00:00" },
    ]) {
      const boundary = databaseWithRows([[{ ...rawPlanning, ...invalid }]]);
      await expect(
        new DrizzleAtomicEventStore(boundary.database).selectPlanningEvent(
          planning.nodeId,
          planning.ownerId,
        ),
      ).rejects.toThrow(/PostgreSQL|validation/iu);
    }

    const byteaBoundary = databaseWithRows([
      [{ ...rawPlanning, titleEnvelope: null, descriptionEnvelope: null, attendeesEnvelope: "\\xFF" }],
    ]);
    await expect(
      new DrizzleAtomicEventStore(byteaBoundary.database).selectProtectedEvent(
        planning.nodeId,
        planning.ownerId,
        1,
        ProviderOrderKeySchema.parse("00000000000000000001"),
      ),
    ).rejects.toThrow(/PostgreSQL/iu);
  });

  it("retries an empty write in a fresh statement and classifies the visible equal winner", async () => {
    const boundary = databaseWithRows([[], [rawPlanning]]);
    const result = await new DrizzleAtomicEventStore(boundary.database).saveAtomically(stored);

    expect(result).toEqual({ outcome: "equal", event: planning });
    expect(boundary.statements).toHaveLength(2);
    const winnerSql = render(boundary.statements[1]!);
    expect(winnerSql).toContain("from events");
    expect(winnerSql).not.toMatch(
      /title_envelope|description_envelope|attendees_envelope|location_envelope|meeting_link_envelope/u,
    );
  });

  it("locks the exact eligible node until event commit before a second logical session can reclassify it", async () => {
    const harness = new TwoLogicalSessionLockHarness();
    const save = new DrizzleAtomicEventStore(harness.database).saveAtomically(stored);
    await harness.eligible;
    let nodeUpdateSettled = false;
    const nodeUpdate = harness.updateNodeSnapshot().then(() => {
      nodeUpdateSettled = true;
    });
    await Promise.resolve();

    expect(nodeUpdateSettled).toBe(false);
    const saveSql = render(harness.statements[0]!);
    expect(saveSql).toMatch(/\beligible as .* for update of node\b/u);
    const returnedProjection = saveSql.slice(saveSql.lastIndexOf(" select "));
    expect(returnedProjection).not.toMatch(
      /title_envelope|description_envelope|attendees_envelope|location_envelope|meeting_link_envelope/u,
    );

    harness.commitEvent();
    await expect(save).resolves.toEqual({ outcome: "applied", event: planning });
    await nodeUpdate;
    expect(harness.order).toEqual([
      "eligible-locked",
      "node-update-attempt",
      "event-commit",
      "node-update-commit",
    ]);
  });

  it("returns the typed no-write conflict when the locked eligibility snapshot does not match", async () => {
    const boundary = databaseWithRows([[], []]);

    await expect(
      new DrizzleAtomicEventStore(boundary.database).saveAtomically(stored),
    ).rejects.toBeInstanceOf(EventNodeSnapshotConflictError);
    expect(boundary.statements).toHaveLength(2);
  });
});

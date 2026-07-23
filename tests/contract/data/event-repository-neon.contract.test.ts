import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import {
  DrizzleAtomicEventStore,
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
});

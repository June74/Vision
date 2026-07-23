import { describe, expect, it } from "vitest";
import { encodeBase64Url } from "../../../src/crypto/envelope";
import { createTestKeyProvider } from "../../../src/crypto/test-key-provider";
import {
  EventContentAccessDeniedError,
  EventRepository,
  type AtomicEventStore,
  type PlaintextEvent,
  type StoredEventRow,
} from "../../../src/data/repositories/event-repository";

const SENTINEL = "VISION_PROTECTED_SENTINEL_7F9A";
const ownerId = "550e8400-e29b-41d4-a716-446655440000";

const event: PlaintextEvent = {
  nodeId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
  ownerId,
  identity: {
    sourceSystem: "google_calendar",
    sourceCalendarId: "calendar_1",
    sourceEventId: "event_1",
    sourceVersion: "0000000001",
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

class InMemoryAtomicEventStore implements AtomicEventStore {
  readonly #rows = new Map<string, StoredEventRow>();
  protectedReadCount = 0;

  async saveAtomically(row: StoredEventRow): Promise<StoredEventRow> {
    const existing = this.#rows.get(row.nodeId);
    if (!existing || existing.version <= row.version) {
      this.#rows.set(row.nodeId, structuredClone(row));
    }
    return structuredClone(this.#rows.get(row.nodeId)!);
  }

  async selectPlanningEvent(nodeId: string, requestedOwnerId: string) {
    const row = this.#rows.get(nodeId);
    if (!row || row.ownerId !== requestedOwnerId) {
      return undefined;
    }
    return {
      nodeId: row.nodeId,
      ownerId: row.ownerId,
      identity: row.identity,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      timeZone: row.timeZone,
      busy: row.busy,
      status: row.status,
      recurrenceId: row.recurrenceId,
      domain: row.domain,
      domainState: row.domainState,
      privacy: row.privacy,
      version: row.version,
    };
  }

  async selectProtectedEvent(nodeId: string, requestedOwnerId: string, expectedVersion: number) {
    this.protectedReadCount += 1;
    const row = this.#rows.get(nodeId);
    if (
      !row ||
      row.ownerId !== requestedOwnerId ||
      row.version !== expectedVersion
    ) {
      return undefined;
    }
    return structuredClone(row);
  }

  readRaw(nodeId: string): StoredEventRow | undefined {
    const row = this.#rows.get(nodeId);
    return row ? structuredClone(row) : undefined;
  }
}

async function createHarness() {
  const keyProvider = await createTestKeyProvider({
    rootKeyBase64Url: encodeBase64Url(crypto.getRandomValues(new Uint8Array(32))),
  });
  const store = new InMemoryAtomicEventStore();
  return { repository: new EventRepository(store, keyProvider), store };
}

describe("encrypted event repository", () => {
  it("encrypts every represented protected event field before the database adapter call", async () => {
    const { repository, store } = await createHarness();

    await repository.save(event);

    const raw = store.readRaw(event.nodeId);
    expect(raw).toBeDefined();
    expect(JSON.stringify(raw)).not.toContain(SENTINEL);
    for (const field of [
      "titleEnvelope",
      "descriptionEnvelope",
      "attendeesEnvelope",
      "locationEnvelope",
      "meetingLinkEnvelope",
    ] as const) {
      expect(raw![field]).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(raw![field]!)).not.toContain(SENTINEL);
    }
  });

  it("returns decrypted content only after owner and privacy authorization", async () => {
    const { repository, store } = await createHarness();
    await repository.save(event);

    await expect(
      repository.get(event.nodeId, {
        ownerId,
        allowedPrivacyLevels: ["private"],
      }),
    ).resolves.toEqual(event);
    expect(store.protectedReadCount).toBe(1);

    await expect(
      repository.get(event.nodeId, {
        ownerId: "c56a4180-65aa-42ec-a945-5fd21dec0538",
        allowedPrivacyLevels: ["private"],
      }),
    ).resolves.toBeUndefined();
    expect(store.protectedReadCount).toBe(1);

    await expect(
      repository.get(event.nodeId, {
        ownerId,
        allowedPrivacyLevels: ["planning"],
      }),
    ).rejects.toBeInstanceOf(EventContentAccessDeniedError);
    expect(store.protectedReadCount).toBe(1);
  });

  it("keeps planning-only reads from selecting or decrypting protected columns", async () => {
    const { repository, store } = await createHarness();
    await repository.save(event);

    const planningEvent = await repository.getPlanning(event.nodeId, ownerId);

    expect(planningEvent).toMatchObject({
      nodeId: event.nodeId,
      ownerId,
      privacy: "private",
      version: 1,
    });
    expect(JSON.stringify(planningEvent)).not.toContain(SENTINEL);
    expect(store.protectedReadCount).toBe(0);
  });

  it("keeps the newest event and its ciphertext under concurrent saves", async () => {
    const { repository, store } = await createHarness();
    const newer = {
      ...event,
      identity: { ...event.identity, sourceVersion: "0000000002" },
      version: 2,
      title: `new:${SENTINEL}`,
    };

    await Promise.all([repository.save(newer), repository.save(event)]);

    expect(store.readRaw(event.nodeId)?.version).toBe(2);
    await expect(
      repository.get(event.nodeId, {
        ownerId,
        allowedPrivacyLevels: ["private"],
      }),
    ).resolves.toEqual(newer);
  });
});

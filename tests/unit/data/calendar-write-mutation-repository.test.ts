import { describe, expect, it, vi } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import {
  encryptProtectedFields,
  type ProtectedObjectContext,
} from "../../../src/crypto/protected-fields";
import {
  serializeCipherEnvelope,
  type CipherEnvelope,
} from "../../../src/crypto/envelope";
import type { KeyProvider, VersionedDataKey } from "../../../src/crypto/key-provider";
import {
  createCalendarWriteMutationProposal,
  type CalendarWriteMutationProposal,
} from "../../../src/domain/calendar-write/event-mutation";
import { DrizzleCalendarWriteRepository } from "../../../src/data/repositories/calendar-write-repository";

const OWNER_ID = "usr_private_pilot";
const OPERATION_ID = "op-calendar-mutation-1";
const CALENDAR_ID = "vision-calendar";
const EVENT_ID = "event-vision-1";
const NOW = new Date("2026-08-20T23:00:00.000Z");
const FUTURE = new Date("2026-08-21T00:00:00.000Z");

type DatabaseRow = Record<string, unknown>;

class ScriptedDatabase {
  readonly execute = vi.fn<(query: unknown) => Promise<{ rows: DatabaseRow[] }>>();
  readonly queries: unknown[] = [];
  results: Array<{ rows: DatabaseRow[] }> = [];

  constructor() {
    this.execute.mockImplementation(async (query) => {
      this.queries.push(query);
      return this.results.shift() ?? { rows: [] };
    });
  }
}

class MemoryKeyProvider implements KeyProvider {
  constructor(private readonly key: CryptoKey) {}

  async getDataKey(
    _ownerId: string,
    _domain: "school" | "work" | "personal" | "unresolved",
    _keyVersion?: number,
  ): Promise<VersionedDataKey> {
    return { key: this.key, keyVersion: 1 };
  }
}

function mutationProposal(): CalendarWriteMutationProposal {
  return createCalendarWriteMutationProposal({
    operationId: OPERATION_ID,
    ownerId: OWNER_ID,
    action: "update",
    target: {
      calendarId: CALENDAR_ID,
      eventId: EVENT_ID,
      version: "etag-event-1",
      scope: "single",
    },
    requestedAt: "2026-08-20T23:00:00.000Z",
    before: {
      title: "Study session",
      description: "Review the next chapter.",
      startsAt: "2026-08-21T19:00:00-05:00",
      endsAt: "2026-08-21T20:00:00-05:00",
      timeZone: "America/Chicago",
      domain: "school",
      privacy: "private",
      status: "confirmed",
      attendees: [],
      recurrence: null,
      notifications: "none",
    },
    after: {
      title: "Updated study session",
      description: "Review the next chapter.",
      startsAt: "2026-08-21T19:00:00-05:00",
      endsAt: "2026-08-21T20:00:00-05:00",
      timeZone: "America/Chicago",
      domain: "school",
      privacy: "private",
      status: "confirmed",
      attendees: [],
      recurrence: null,
      notifications: "none",
    },
  });
}

async function createRepository(database: ScriptedDatabase) {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const keyProvider = new MemoryKeyProvider(key);
  return {
    keyProvider,
    repository: new DrizzleCalendarWriteRepository(
      database as unknown as VisionDatabase,
      keyProvider,
    ),
  };
}

async function encryptedMutationEnvelope(
  keyProvider: KeyProvider,
  value: CalendarWriteMutationProposal,
): Promise<Uint8Array> {
  const context: ProtectedObjectContext = {
    ownerId: value.ownerId,
    nodeId: value.operationId,
    domain: value.preview.after?.domain ?? value.preview.before.domain,
  };
  const encrypted = await encryptProtectedFields(keyProvider, context, {
    proposal: JSON.stringify(value),
  });
  const envelope = encrypted.proposal as CipherEnvelope;
  return new TextEncoder().encode(serializeCipherEnvelope(envelope));
}

function approvalRow(envelope: Uint8Array): DatabaseRow {
  return {
    operationId: OPERATION_ID,
    ownerId: OWNER_ID,
    provider: "google",
    calendarId: CALENDAR_ID,
    action: "update",
    providerEventId: EVENT_ID,
    providerEventVersion: "etag-event-1",
    mutationScope: "single",
    proposalDomain: "school",
    status: "proposed",
    requestedAt: NOW,
    expiresAt: FUTURE,
    proposalEnvelope: envelope,
  };
}

describe("Phase C mutation approval repository", () => {
  it("encrypts mutation proposals and persists only opaque mutation identity", async () => {
    const database = new ScriptedDatabase();
    const { repository } = await createRepository(database);
    const value = mutationProposal();
    database.results.push({ rows: [{ operationId: OPERATION_ID }] });

    await repository.createMutationApproval({
      proposal: value,
      requestedAt: NOW,
      expiresAt: FUTURE,
    });

    expect(database.queries).toHaveLength(1);
    expect(JSON.stringify(database.queries[0])).not.toContain("Updated study session");
    expect(JSON.stringify(database.queries[0])).not.toContain("Review the next chapter.");
  });

  it("loads and strictly revalidates an owner-scoped encrypted mutation proposal", async () => {
    const database = new ScriptedDatabase();
    const { keyProvider, repository } = await createRepository(database);
    const value = mutationProposal();
    database.results.push({ rows: [approvalRow(await encryptedMutationEnvelope(keyProvider, value))] });

    await expect(repository.loadMutationProposal(OWNER_ID, OPERATION_ID)).resolves.toEqual(value);
  });

  it("returns the action, provider identity, and scope without returning the encrypted envelope", async () => {
    const database = new ScriptedDatabase();
    const { repository } = await createRepository(database);
    database.results.push({ rows: [approvalRow(new Uint8Array([1, 2, 3]))] });

    await expect(repository.findApproval(OWNER_ID, OPERATION_ID)).resolves.toMatchObject({
      action: "update",
      eventId: EVENT_ID,
      eventVersion: "etag-event-1",
      scope: "single",
    });
  });
});

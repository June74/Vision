import { strict as assert } from "node:assert";
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
  createCalendarWriteProposal,
  transitionCalendarWrite,
  type CalendarWriteProposal,
} from "../../../src/domain/calendar-write/approval";
import { DrizzleCalendarWriteRepository } from "../../../src/data/repositories/calendar-write-repository";

const OWNER_ID = "usr_private_pilot";
const OTHER_OWNER_ID = "usr_other_owner";
const OPERATION_ID = "op-calendar-write-1";
const CALENDAR_ID = "vision-calendar";
const NOW = new Date("2026-08-20T23:00:00.000Z");
const FUTURE = new Date("2026-08-21T00:00:00.000Z");
const PAST = new Date("2026-08-20T22:00:00.000Z");

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

function proposal(): CalendarWriteProposal {
  const proposed = createCalendarWriteProposal({
    operationId: OPERATION_ID,
    ownerId: OWNER_ID,
    target: { calendarId: CALENDAR_ID, version: "etag-1" },
    requestedAt: "2026-08-20T23:00:00.000Z",
    event: {
      title: "Study session",
      description: "Review the next chapter.",
      startsAt: "2026-08-21T19:00:00-05:00",
      endsAt: "2026-08-21T20:00:00-05:00",
      timeZone: "America/Chicago",
      domain: "school",
      privacy: "private",
      attendees: [],
      recurrence: null,
      notifications: "none",
    },
  });
  return proposed;
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

async function encryptedProposalEnvelope(
  keyProvider: KeyProvider,
  value: CalendarWriteProposal,
): Promise<Uint8Array> {
  const context: ProtectedObjectContext = {
    ownerId: value.ownerId,
    nodeId: value.operationId,
    domain: value.preview.after.domain,
  };
  const encrypted = await encryptProtectedFields(keyProvider, context, {
    proposal: JSON.stringify(value),
  });
  const envelope = encrypted.proposal as CipherEnvelope;
  return new TextEncoder().encode(serializeCipherEnvelope(envelope));
}

function containsPlaintext(value: unknown, needle: string, seen = new Set<object>()): boolean {
  if (typeof value === "string") return value.includes(needle);
  if (typeof value !== "object" || value === null) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (value instanceof Uint8Array) return false;
  for (const child of Object.values(value)) {
    if (containsPlaintext(child, needle, seen)) return true;
  }
  return false;
}

function approvalRow(
  envelope: Uint8Array | string,
  overrides: Partial<DatabaseRow> = {},
): DatabaseRow {
  return {
    operationId: OPERATION_ID,
    ownerId: OWNER_ID,
    provider: "google",
    calendarId: CALENDAR_ID,
    proposalDomain: "school",
    status: "proposed",
    requestedAt: NOW,
    expiresAt: FUTURE,
    proposalEnvelope: envelope,
    ...overrides,
  };
}

function postgresBytea(bytes: Uint8Array): string {
  return (
    String.fromCharCode(92) +
    "x" +
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  );
}

describe("DrizzleCalendarWriteRepository", () => {
  it("round-trips an encrypted proposal without placing plaintext in the query", async () => {
    const database = new ScriptedDatabase();
    const { repository } = await createRepository(database);
    const value = proposal();
    database.results.push({ rows: [{ operationId: OPERATION_ID }] });

    await repository.createApproval({
      proposal: value,
      requestedAt: NOW,
      expiresAt: FUTURE,
    });

    expect(database.queries).toHaveLength(1);
    expect(containsPlaintext(database.queries[0], value.preview.after.title)).toBe(false);
    expect(containsPlaintext(database.queries[0], value.preview.after.description ?? "")).toBe(false);
  });

  it("loads and validates an encrypted owner-scoped proposal", async () => {
    const database = new ScriptedDatabase();
    const { keyProvider, repository } = await createRepository(database);
    const value = proposal();
    const envelope = await encryptedProposalEnvelope(keyProvider, value);
    database.results.push({ rows: [approvalRow(envelope)] });

    await expect(repository.loadProposal(OWNER_ID, OPERATION_ID)).resolves.toEqual(value);
  });

  it("accepts the canonical PostgreSQL bytea text returned by Neon", async () => {
    const database = new ScriptedDatabase();
    const { keyProvider, repository } = await createRepository(database);
    const value = proposal();
    const envelope = await encryptedProposalEnvelope(keyProvider, value);
    database.results.push({ rows: [approvalRow(postgresBytea(envelope))] });

    await expect(repository.loadProposal(OWNER_ID, OPERATION_ID)).resolves.toEqual(value);
  });

  it("returns owner-scoped confirmation outcomes without accepting a foreign owner", async () => {
    const database = new ScriptedDatabase();
    const { repository } = await createRepository(database);
    database.results.push(
      { rows: [{ status: "confirmed" }] },
      { rows: [] },
      { rows: [{ status: "confirmed" }] },
      { rows: [] },
      { rows: [{ status: "proposed", expiresAt: PAST }] },
      { rows: [{ status: "invalidated" }] },
      { rows: [] },
    );

    await expect(repository.confirmApproval(OWNER_ID, OPERATION_ID, NOW)).resolves.toBe("confirmed");
    await expect(repository.confirmApproval(OWNER_ID, OPERATION_ID, NOW)).resolves.toBe("already_confirmed");
    await expect(repository.confirmApproval(OWNER_ID, OPERATION_ID, NOW)).resolves.toBe("expired");
    await expect(repository.confirmApproval(OTHER_OWNER_ID, OPERATION_ID, NOW)).resolves.toBe("missing");
  });

  it("claims one durable execution row and reports an existing conflict", async () => {
    const database = new ScriptedDatabase();
    const { repository } = await createRepository(database);
    database.results.push(
      { rows: [{ operationId: OPERATION_ID }] },
      { rows: [] },
    );

    await expect(repository.claim(OWNER_ID, OPERATION_ID, CALENDAR_ID)).resolves.toBe("claimed");
    await expect(repository.claim(OWNER_ID, OPERATION_ID, CALENDAR_ID)).resolves.toBe("existing");
    expect(database.queries).toHaveLength(2);
  });

  it("rejects an unknown execution status instead of coercing database data", async () => {
    const database = new ScriptedDatabase();
    const { repository } = await createRepository(database);
    database.results.push({
      rows: [{
        operationId: OPERATION_ID,
        ownerId: OWNER_ID,
        provider: "google",
        calendarId: CALENDAR_ID,
        status: "unknown",
        providerEventId: null,
        providerEventVersion: null,
        requestedAt: NOW,
        completedAt: null,
      }],
    });

    await expect(repository.find(OWNER_ID, OPERATION_ID)).rejects.toThrow(
      "Calendar write persistence failed.",
    );
    assert.equal(database.queries.length, 1);
  });

  it("rejects a ledger row that crosses the requested owner boundary", async () => {
    const database = new ScriptedDatabase();
    const { repository } = await createRepository(database);
    database.results.push({
      rows: [{
        operationId: OPERATION_ID,
        ownerId: OTHER_OWNER_ID,
        provider: "google",
        calendarId: CALENDAR_ID,
        status: "writing",
        providerEventId: null,
        providerEventVersion: null,
        requestedAt: NOW,
        completedAt: null,
      }],
    });

    await expect(repository.find(OWNER_ID, OPERATION_ID)).rejects.toThrow(
      "Calendar write persistence failed.",
    );
  });

  it("rejects a ledger row with an invalid database timestamp", async () => {
    const database = new ScriptedDatabase();
    const { repository } = await createRepository(database);
    database.results.push({
      rows: [{
        operationId: OPERATION_ID,
        ownerId: OWNER_ID,
        provider: "google",
        calendarId: CALENDAR_ID,
        status: "writing",
        providerEventId: null,
        providerEventVersion: null,
        requestedAt: "not-a-timestamp",
        completedAt: null,
      }],
    });

    await expect(repository.find(OWNER_ID, OPERATION_ID)).rejects.toThrow(
      "Calendar write persistence failed.",
    );
  });

  it("rejects an unpaired provider event identity", async () => {
    const database = new ScriptedDatabase();
    const { repository } = await createRepository(database);
    database.results.push({
      rows: [{
        operationId: OPERATION_ID,
        ownerId: OWNER_ID,
        provider: "google",
        calendarId: CALENDAR_ID,
        status: "writing",
        eventId: "event-1",
        eventVersion: null,
        requestedAt: NOW,
        completedAt: null,
      }],
    });

    await expect(repository.find(OWNER_ID, OPERATION_ID)).rejects.toThrow(
      "Calendar write persistence failed.",
    );
  });

  it("persists pending, verified, failed, and undone transitions through the ledger port", async () => {
    const database = new ScriptedDatabase();
    const { repository } = await createRepository(database);
    database.results.push(
      { rows: [{ operationId: OPERATION_ID }] },
      { rows: [{ operationId: OPERATION_ID }] },
      { rows: [{ operationId: OPERATION_ID }] },
      { rows: [{ operationId: OPERATION_ID }] },
    );

    await repository.markPending(OWNER_ID, OPERATION_ID);
    await repository.markVerified(OWNER_ID, OPERATION_ID, CALENDAR_ID, "event-1", "etag-2");
    await repository.markFailed(OWNER_ID, OPERATION_ID);
    await repository.markUndone(OWNER_ID, OPERATION_ID);
    expect(database.queries).toHaveLength(4);
  });
});

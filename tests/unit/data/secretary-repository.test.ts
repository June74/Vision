import { describe, expect, it, vi } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import type { KeyProvider, VersionedDataKey } from "../../../src/crypto/key-provider";
import { createSecretaryNote } from "../../../src/domain/secretary/note";
import { createSecretaryTask } from "../../../src/domain/secretary/task";
import { DrizzleSecretaryRepository } from "../../../src/data/repositories/secretary-repository";

const OWNER_ID = "usr_private_pilot";
const NOW = new Date("2026-08-16T18:00:00.000Z");

class ScriptedDatabase {
  readonly execute = vi.fn<(query: unknown) => Promise<{ rows: Record<string, unknown>[] }>>();
  readonly queries: unknown[] = [];
  results: Array<{ rows: Record<string, unknown>[] }> = [];

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

function containsPlaintext(value: unknown, needle: string, seen = new Set<object>()): boolean {
  if (typeof value === "string") return value.includes(needle);
  if (typeof value !== "object" || value === null || seen.has(value)) return false;
  seen.add(value);
  if (value instanceof Uint8Array) return false;
  return Object.values(value).some((child) => containsPlaintext(child, needle, seen));
}

async function createRepository(database: ScriptedDatabase): Promise<DrizzleSecretaryRepository> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return new DrizzleSecretaryRepository(
    database as unknown as VisionDatabase,
    new MemoryKeyProvider(key),
  );
}

describe("DrizzleSecretaryRepository", () => {
  it("encrypts task and note content before SQL and binds every write to the owner", async () => {
    const database = new ScriptedDatabase();
    const repository = await createRepository(database);
    const task = createSecretaryTask({
      id: "task-1",
      title: "Keep this protected",
      dueAt: null,
      timeZone: "UTC",
      createdAt: NOW,
    });
    const note = createSecretaryNote({
      id: "note-1",
      title: "Private title",
      body: "Private body",
      createdAt: NOW,
    });
    database.results.push({ rows: [{ id: task.id }] }, { rows: [{ id: note.id }] });

    await repository.createTask(OWNER_ID, task);
    await repository.createNote(OWNER_ID, note);

    expect(database.queries).toHaveLength(2);
    expect(containsPlaintext(database.queries[0], task.title)).toBe(false);
    expect(containsPlaintext(database.queries[1], note.body)).toBe(false);
    expect(containsPlaintext(database.queries[0], OWNER_ID)).toBe(true);
    expect(containsPlaintext(database.queries[1], OWNER_ID)).toBe(true);
  });

  it("does not return another owner's task when the owner-scoped transition finds no row", async () => {
    const database = new ScriptedDatabase();
    const repository = await createRepository(database);
    database.results.push({ rows: [] });
    await expect(repository.transitionTask(OWNER_ID, "task-other", "complete", NOW)).resolves.toBeUndefined();
    expect(database.queries).toHaveLength(1);
  });
});

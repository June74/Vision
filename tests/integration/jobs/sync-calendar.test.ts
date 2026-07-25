import { describe, expect, it, vi } from "vitest";
import type { ProviderEventChange } from "../../../src/domain/sync/change";
import type { SyncCheckpoint } from "../../../src/domain/sync/checkpoint";
import type {
  EventSyncClient,
  EventSyncPage,
} from "../../../src/integrations/google-calendar/event-sync-client";
import {
  SyncCalendarError,
  syncCalendar,
  type SyncApplyRequest,
  type SyncFailureRecord,
  type SyncRepository,
} from "../../../src/jobs/sync-calendar";

const ownerId = "owner-1";
const calendarId = "calendar-1";
const fixedNow = new Date("2026-07-24T15:00:00.000Z");

function upsert(
  id: string,
  version: string,
): Extract<ProviderEventChange, { type: "upsert" }> {
  return {
    type: "upsert",
    identity: {
      sourceSystem: "google-calendar",
      sourceCalendarId: calendarId,
      sourceEventId: id,
      sourceVersion: version as never,
    },
    startsAt: "2026-07-24T15:00:00.000Z",
    endsAt: "2026-07-24T16:00:00.000Z",
    timeZone: "America/Chicago",
    busy: true,
    status: "confirmed",
    recurrence: { kind: "single" },
    protected: {
      title: `title:${id}`,
      description: null,
      attendees: [],
      location: null,
      meetingLinks: [],
      attachmentReferences: [],
    },
  };
}

function deletion(id: string): ProviderEventChange {
  return {
    type: "delete",
    target: {
      sourceSystem: "google-calendar",
      sourceCalendarId: calendarId,
      sourceEventId: id,
    },
    recurrence: { kind: "single" },
  };
}

class MemorySyncRepository implements SyncRepository {
  checkpoint: SyncCheckpoint | undefined;
  projection = new Map<string, ProviderEventChange>();
  failures: SyncFailureRecord[] = [];
  failApply = false;
  failLoad = false;
  applyCalls = 0;

  async loadCheckpoint(): Promise<SyncCheckpoint | undefined> {
    if (this.failLoad) throw new Error("database unavailable");
    return this.checkpoint ? structuredClone(this.checkpoint) : undefined;
  }

  async applyChanges(request: SyncApplyRequest) {
    this.applyCalls += 1;
    const projection = new Map(this.projection);
    for (const change of request.changes) {
      const id =
        change.type === "upsert"
          ? change.identity.sourceEventId
          : change.target.sourceEventId;
      if (change.type === "delete") projection.delete(id);
      else projection.set(id, structuredClone(change));
    }
    if (this.failApply) throw new Error("database unavailable");
    if ((this.checkpoint?.version ?? 0) !== request.expectedCheckpointVersion) {
      return { outcome: "conflict" as const };
    }
    this.projection = projection;
    this.checkpoint = structuredClone(request.nextCheckpoint);
    return {
      outcome: "committed" as const,
      upserted: request.changes.filter((change) => change.type === "upsert").length,
      deleted: request.changes.filter((change) => change.type === "delete").length,
      unchanged: 0,
    };
  }

  async recordFailure(record: SyncFailureRecord): Promise<void> {
    this.failures.push(structuredClone(record));
  }
}

function pageClient(pages: EventSyncPage[]): EventSyncClient & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    calls,
    async listChanges(request) {
      calls.push([structuredClone(request)]);
      const page = pages.shift();
      if (!page) throw new Error("unexpected page");
      return structuredClone(page);
    },
  };
}

function run(
  client: EventSyncClient,
  repository: SyncRepository,
  overrides: Partial<Parameters<typeof syncCalendar>[0]> = {},
) {
  return syncCalendar(
    {
      ownerId,
      calendarId,
      reason: "repair",
      jobId: "job-1",
      ...overrides,
    },
    { client, repository, now: () => new Date(fixedNow), random: () => 0 },
  );
}

describe("transactional incremental calendar synchronization", () => {
  it("refuses a checkpoint generation newer than the queue claim without recording failure", async () => {
    const repository = new MemorySyncRepository();
    repository.checkpoint = {
      calendarId,
      syncToken: "sync-newer",
      committedAt: fixedNow.toISOString(),
      version: 2,
    };
    const client = pageClient([]);

    await expect(
      run(client, repository, { expectedCheckpointVersion: 1 }),
    ).rejects.toMatchObject({
      category: "concurrency",
      state: "retry_scheduled",
      retry: true,
    });
    expect(client.calls).toHaveLength(0);
    expect(repository.failures).toEqual([]);
  });

  it("performs an initial full sync and commits only the terminal token", async () => {
    const repository = new MemorySyncRepository();
    const client = pageClient([
      {
        changes: [upsert("a", "00000000000000000001")],
        calendarTimeZone: "America/Chicago",
        nextPageToken: "page-2",
      },
      {
        changes: [upsert("b", "00000000000000000001")],
        calendarTimeZone: "America/Chicago",
        nextSyncToken: "sync-1",
      },
    ]);

    await expect(run(client, repository)).resolves.toEqual({
      status: "succeeded",
      reason: "repair",
      jobId: "job-1",
      pages: 2,
      staged: 2,
      upserted: 2,
      deleted: 0,
      unchanged: 0,
      checkpointVersion: 1,
      durationMs: 0,
    });
    expect(repository.checkpoint).toEqual({
      calendarId,
      syncToken: "sync-1",
      committedAt: fixedNow.toISOString(),
      version: 1,
    });
    expect(client.calls).toEqual([
      [{ calendarId, syncToken: undefined, pageToken: undefined }],
      [{ calendarId, syncToken: undefined, pageToken: "page-2" }],
    ]);
  });

  it("uses the old token on every incremental page and applies a deletion atomically", async () => {
    const repository = new MemorySyncRepository();
    repository.checkpoint = {
      calendarId,
      syncToken: "sync-1",
      committedAt: "2026-07-24T14:00:00.000Z",
      version: 1,
    };
    repository.projection.set("a", upsert("a", "00000000000000000001"));
    const client = pageClient([
      {
        changes: [upsert("b", "00000000000000000002")],
        calendarTimeZone: "America/Chicago",
        nextPageToken: "p2",
      },
      {
        changes: [deletion("a")],
        calendarTimeZone: "America/Chicago",
        nextSyncToken: "sync-2",
      },
    ]);

    const result = await run(client, repository);

    expect(result).toMatchObject({ pages: 2, upserted: 1, deleted: 1 });
    expect([...repository.projection.keys()]).toEqual(["b"]);
    expect(client.calls).toEqual([
      [{ calendarId, syncToken: "sync-1", pageToken: undefined }],
      [{ calendarId, syncToken: "sync-1", pageToken: "p2" }],
    ]);
  });

  it("collapses identical duplicate content and rejects conflicting duplicate identities", async () => {
    const duplicate = upsert("a", "00000000000000000001");
    if (duplicate.type !== "upsert") throw new Error("invalid test fixture");
    const repository = new MemorySyncRepository();
    await expect(
      run(
        pageClient([
          {
            changes: [duplicate, structuredClone(duplicate)],
            calendarTimeZone: "America/Chicago",
            nextSyncToken: "sync-1",
          },
        ]),
        repository,
      ),
    ).resolves.toMatchObject({ staged: 1 });

    const conflictRepository = new MemorySyncRepository();
    await expect(
      run(
        pageClient([
          {
            changes: [
              duplicate,
              {
                ...duplicate,
                protected: { ...duplicate.protected, title: "different" },
              },
            ],
            calendarTimeZone: "America/Chicago",
            nextSyncToken: "sync-1",
          },
        ]),
        conflictRepository,
      ),
    ).rejects.toMatchObject({
      category: "schema",
      state: "action_required",
      retry: false,
    });
    expect(conflictRepository.applyCalls).toBe(0);
  });

  it("leaves the checkpoint and projection unchanged when page two fails", async () => {
    const repository = new MemorySyncRepository();
    repository.checkpoint = {
      calendarId,
      syncToken: "old",
      committedAt: "2026-07-24T14:00:00.000Z",
      version: 2,
    };
    repository.projection.set("a", upsert("a", "00000000000000000001"));
    const client: EventSyncClient = {
      async listChanges(request) {
        if (!request.pageToken) {
          return {
            changes: [upsert("b", "00000000000000000002")],
            calendarTimeZone: "America/Chicago",
            nextPageToken: "p2",
          };
        }
        throw new SyncCalendarError("transient", "retry_scheduled", true, 5);
      },
    };

    await expect(run(client, repository)).rejects.toMatchObject({
      category: "transient",
      retry: true,
    });
    expect(repository.applyCalls).toBe(0);
    expect(repository.checkpoint.syncToken).toBe("old");
    expect([...repository.projection.keys()]).toEqual(["a"]);
  });

  it("rolls back a database failure and succeeds unchanged on queue redelivery", async () => {
    const repository = new MemorySyncRepository();
    repository.checkpoint = {
      calendarId,
      syncToken: "old",
      committedAt: "2026-07-24T14:00:00.000Z",
      version: 1,
    };
    repository.projection.set("a", upsert("a", "00000000000000000001"));
    repository.failApply = true;

    await expect(
      run(
        pageClient([
          {
            changes: [upsert("b", "00000000000000000002")],
            calendarTimeZone: "America/Chicago",
            nextSyncToken: "new",
          },
        ]),
        repository,
      ),
    ).rejects.toMatchObject({ category: "database", retry: true });
    expect(repository.checkpoint.syncToken).toBe("old");
    expect([...repository.projection.keys()]).toEqual(["a"]);

    repository.failApply = false;
    await expect(
      run(
        pageClient([
          {
            changes: [upsert("b", "00000000000000000002")],
            calendarTimeZone: "America/Chicago",
            nextSyncToken: "new",
          },
        ]),
        repository,
        { deliveryAttempt: 2 },
      ),
    ).resolves.toMatchObject({ checkpointVersion: 2 });
    expect([...repository.projection.keys()].sort()).toEqual(["a", "b"]);
  });

  it("advances an unchanged incremental response without mutating projection", async () => {
    const repository = new MemorySyncRepository();
    repository.checkpoint = {
      calendarId,
      syncToken: "old",
      committedAt: "2026-07-24T14:00:00.000Z",
      version: 4,
    };
    repository.projection.set("a", upsert("a", "00000000000000000001"));

    await expect(
      run(
        pageClient([
          {
            changes: [],
            calendarTimeZone: "America/Chicago",
            nextSyncToken: "new",
          },
        ]),
        repository,
      ),
    ).resolves.toMatchObject({
      staged: 0,
      upserted: 0,
      deleted: 0,
      checkpointVersion: 5,
    });
    expect([...repository.projection.keys()]).toEqual(["a"]);
  });

  it("marks authorization and schema failures and returns bounded queue retry metadata", async () => {
    for (const [category, state, retry] of [
      ["authorization", "disconnected", false],
      ["schema", "action_required", false],
      ["sync_token_invalid", "rebuild_required", false],
      ["transient", "retry_scheduled", true],
    ] as const) {
      const repository = new MemorySyncRepository();
      const client: EventSyncClient = {
        async listChanges() {
          throw new SyncCalendarError(category, state, retry, retry ? 5 : undefined);
        },
      };
      const error = await run(client, repository, { deliveryAttempt: 99 }).catch(
        (failure: unknown) => failure,
      );
      expect(error).toMatchObject({
        category,
        state: category === "transient" ? "action_required" : state,
      });
      if (category === "transient") {
        expect((error as SyncCalendarError).retry).toBe(false);
        expect((error as SyncCalendarError).state).toBe("action_required");
      }
      expect(repository.failures.at(-1)).toMatchObject({
        ownerId,
        calendarId,
        category,
      });
    }
  });

  it("defers failure persistence when a claim-bound queue transition owns it", async () => {
    const repository = new MemorySyncRepository();
    const client: EventSyncClient = {
      async listChanges() {
        throw new SyncCalendarError("authorization", "disconnected", false);
      },
    };

    await expect(
      syncCalendar(
        {
          ownerId,
          calendarId,
          reason: "repair",
          jobId: "job-claim-bound",
          expectedCheckpointVersion: 0,
        },
        {
          client,
          repository,
          persistFailure: false,
          now: () => new Date(fixedNow),
          random: () => 0,
        },
      ),
    ).rejects.toMatchObject({
      category: "authorization",
      state: "disconnected",
      retry: false,
    });
    expect(repository.failures).toEqual([]);
  });

  it("turns checkpoint CAS conflicts into queue-redelivery signaling", async () => {
    const repository = new MemorySyncRepository();
    repository.checkpoint = {
      calendarId,
      syncToken: "old",
      committedAt: "2026-07-24T14:00:00.000Z",
      version: 1,
    };
    const originalApply = repository.applyChanges.bind(repository);
    repository.applyChanges = async (request) => {
      repository.checkpoint = { ...repository.checkpoint!, version: 2 };
      return originalApply(request);
    };

    await expect(
      run(
        pageClient([
          {
            changes: [],
            calendarTimeZone: "America/Chicago",
            nextSyncToken: "new",
          },
        ]),
        repository,
      ),
    ).rejects.toMatchObject({
      category: "concurrency",
      state: "retry_scheduled",
      retry: true,
    });
    expect(repository.failures.at(-1)?.expectedCheckpointVersion).toBe(1);
  });

  it("classifies checkpoint read failures as database without mutating an unobserved generation", async () => {
    const repository = new MemorySyncRepository();
    repository.failLoad = true;

    await expect(
      run(pageClient([]), repository),
    ).rejects.toMatchObject({
      category: "database",
      state: "retry_scheduled",
      retry: true,
    });
    expect(repository.applyCalls).toBe(0);
    expect(repository.checkpoint).toBeUndefined();
    expect(repository.failures).toEqual([
      expect.objectContaining({
        category: "database",
        expectedCheckpointVersion: undefined,
      }),
    ]);
  });

  it("rejects oversized protected fields and complete payloads without apply or retry", async () => {
    const cases: ProviderEventChange[] = [
      {
        ...upsert("oversized-attendees", "00000000000000000001"),
        protected: {
          ...upsert("oversized-attendees", "00000000000000000001").protected,
          attendees: [
            `a:${"x".repeat(22_000)}`,
            `b:${"x".repeat(22_000)}`,
            `c:${"x".repeat(22_000)}`,
          ],
        },
      } as ProviderEventChange,
      {
        ...upsert("oversized-payload", "00000000000000000001"),
        protected: {
          title: "x".repeat(20_000),
          description: "y".repeat(20_000),
          attendees: [],
          location: null,
          meetingLinks: [],
          attachmentReferences: Array.from({ length: 20 }, (_, index) => ({
            id: `${index}:${"z".repeat(2_000)}`,
            mimeType: "text/plain",
            url: null,
          })),
        },
      } as ProviderEventChange,
    ];

    for (const change of cases) {
      const repository = new MemorySyncRepository();
      const error = await run(
        pageClient([
          {
            changes: [change],
            calendarTimeZone: "America/Chicago",
            nextSyncToken: "new",
          },
        ]),
        repository,
      ).catch((failure: unknown) => failure);
      expect(error).toMatchObject({
        category: "payload_too_large",
        state: "action_required",
        retry: false,
      });
      expect(repository.applyCalls).toBe(0);
      expect(repository.checkpoint).toBeUndefined();
      expect(JSON.stringify(repository.failures)).not.toContain("x".repeat(100));
      expect(repository.failures.at(-1)?.expectedCheckpointVersion).toBe(0);
    }
  });

  it("bounds aggregate multi-page staging memory with headroom below the Worker limit", async () => {
    const repository = new MemorySyncRepository();
    const changes = Array.from({ length: 800 }, (_, index) => ({
      ...upsert(`large-${index}`, "00000000000000000001"),
      protected: {
        ...upsert(`large-${index}`, "00000000000000000001").protected,
        description: `sentinel-${index}:${"x".repeat(6_000)}`,
      },
    })) as ProviderEventChange[];

    const error = await run(
      pageClient([
        {
          changes: changes.slice(0, 400),
          calendarTimeZone: "America/Chicago",
          nextPageToken: "p2",
        },
        {
          changes: changes.slice(400),
          calendarTimeZone: "America/Chicago",
          nextSyncToken: "new",
        },
      ]),
      repository,
    ).catch((failure: unknown) => failure);

    expect(error).toMatchObject({
      category: "payload_too_large",
      state: "action_required",
      retry: false,
    });
    expect(repository.applyCalls).toBe(0);
    expect(repository.checkpoint).toBeUndefined();
    expect(JSON.stringify(repository.failures)).not.toContain("sentinel-");
  });
});

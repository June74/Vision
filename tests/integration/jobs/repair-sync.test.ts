import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { VisionDatabase } from "../../../src/data/db";
import { createChannelMaintenanceRepository } from "../../../src/data/repositories/channel-maintenance-repository";
import {
  repairCalendarSync,
  type RepairCalendar,
  type RepairDependencies,
} from "../../../src/jobs/repair-calendar-sync";
import { runScheduledCalendarMaintenance } from "../../../src/jobs/scheduled";
import { SyncCalendarError } from "../../../src/jobs/sync-calendar";

const NOW = new Date("2026-07-24T16:15:00.000Z");
const STALE: RepairCalendar = {
  ownerId: "owner-1",
  calendarId: "calendar-1",
  checkpointVersion: 3,
};

function dependencies(): RepairDependencies {
  return {
    repository: {
      bootstrapConnectedCalendars: vi.fn(async () => []),
      listRepairCandidates: vi.fn(async () => [STALE]),
      reserveRepairJob: vi.fn(async (message) => ({
        message,
        shouldEnqueue: true,
      })),
      markEnqueued: vi.fn(async () => undefined),
    },
    queue: {
      send: vi.fn(async () => undefined),
    },
  };
}

describe("scheduled calendar repair", () => {
  it("repairs a missed notification on the first eligible 15-minute run", async () => {
    const deps = dependencies();

    const result = await repairCalendarSync(NOW, deps);

    expect(result).toBe("reserved");
    expect(deps.queue.send).toHaveBeenCalledWith({
      jobId: expect.stringMatching(/^repair_[A-Za-z0-9_-]{43}$/u),
      ownerId: STALE.ownerId,
      calendarId: STALE.calendarId,
      reason: "repair",
    });
    expect(deps.repository.markEnqueued).toHaveBeenCalledOnce();
  });

  it("does not enqueue duplicate work on repeated scheduled invocation", async () => {
    const deps = dependencies();
    vi.mocked(deps.repository.reserveRepairJob)
      .mockResolvedValueOnce({
        message: {
          jobId: "repair_duplicate",
          ownerId: STALE.ownerId,
          calendarId: STALE.calendarId,
          reason: "repair",
        },
        shouldEnqueue: true,
      })
      .mockResolvedValueOnce({
        message: {
          jobId: "repair_duplicate",
          ownerId: STALE.ownerId,
          calendarId: STALE.calendarId,
          reason: "repair",
        },
        shouldEnqueue: false,
      });

    const first = await repairCalendarSync(NOW, deps);
    const second = await repairCalendarSync(NOW, deps);

    expect(first).toBe("reserved");
    expect(second).toBe("no_work");
    expect(deps.queue.send).toHaveBeenCalledOnce();
  });

  it("reports no work when no bootstrap or stale candidate is selected", async () => {
    const deps = dependencies();
    vi.mocked(deps.repository.listRepairCandidates).mockResolvedValue([]);

    await expect(repairCalendarSync(NOW, deps)).resolves.toBe("no_work");

    expect(deps.queue.send).not.toHaveBeenCalled();
    expect(deps.repository.markEnqueued).not.toHaveBeenCalled();
  });

  it("runs renewal and repair without fetching calendar events in the scheduler", async () => {
    const order: string[] = [];
    const renew = vi.fn(async () => "no_work" as const);
    const repair = vi.fn(async () => "no_work" as const);
    renew.mockImplementation(async () => {
      order.push("renew");
      return "no_work";
    });
    repair.mockImplementation(async () => {
      order.push("repair");
      return "no_work";
    });

    await runScheduledCalendarMaintenance(NOW, { renew, repair });

    expect(renew).toHaveBeenCalledWith(NOW);
    expect(repair).toHaveBeenCalledWith(NOW);
    expect(order).toEqual(["repair", "renew"]);
  });

  it("does not let credential or renewal failure suppress durable repair", async () => {
    const repair = vi.fn(async () => "no_work" as const);

    await expect(
      runScheduledCalendarMaintenance(NOW, {
        repair,
        renew: vi.fn(async () => {
          throw new Error("safe synthetic credential failure");
        }),
      }),
    ).rejects.toThrow("safe synthetic credential failure");

    expect(repair).toHaveBeenCalledOnce();
  });

  it("still attempts renewal but preserves a durable repair failure", async () => {
    const renew = vi.fn(async () => "no_work" as const);
    const failure = new Error("safe synthetic queue failure");

    await expect(
      runScheduledCalendarMaintenance(NOW, {
        repair: vi.fn(async () => {
          throw failure;
        }),
        renew,
      }),
    ).rejects.toBe(failure);

    expect(renew).toHaveBeenCalledOnce();
  });

  it.each([
    new SyncCalendarError("authorization", "disconnected", false),
    new SyncCalendarError("transient", "retry_scheduled", true, 5),
    new SyncCalendarError("database", "retry_scheduled", true, 5),
    new SyncCalendarError("provider", "action_required", false),
  ])(
    "persists typed renewal credential disposition before reporting %s",
    async (failure) => {
      const recordCredentialFailure = vi.fn(async () => true);
      const schedulerDependencies = {
        repair: vi.fn(async () => "no_work" as const),
        renew: vi.fn(async () => {
          throw failure;
        }),
        recordCredentialFailure,
      };

      await expect(
        runScheduledCalendarMaintenance(NOW, schedulerDependencies),
      ).rejects.toBe(failure);

      expect(recordCredentialFailure).toHaveBeenCalledWith(failure, NOW);
    },
  );

  it("clears only a scheduler-owned credential retry marker after renewal succeeds", async () => {
    const clearCredentialRetry = vi.fn(async () => true);
    const schedulerDependencies = {
      repair: vi.fn(async () => "no_work" as const),
      renew: vi.fn(async () => "no_work" as const),
      clearCredentialRetry,
    };

    await runScheduledCalendarMaintenance(NOW, schedulerDependencies);

    expect(clearCredentialRetry).toHaveBeenCalledWith(NOW);
  });

  it("selects a missed sync and durably deduplicates its scheduled repair", async () => {
    const postgres = new PGlite();
    try {
      for (const migration of [
        "0001_phase_b_foundation.sql",
        "0002_google_auth_sessions.sql",
        "0003_calendar_setup.sql",
        "0004_incremental_event_sync.sql",
        "0005_google_notification_jobs.sql",
        "0006_google_channel_lifecycle.sql",
        "0007_calendar_maintenance_state.sql",
      ]) {
        await postgres.exec(
          await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
        );
      }
      await postgres.query(
        `insert into calendar_setup_states (
           owner_id, google_subject, setup_version, status, action_required, updated_at
         ) values
           ($1, 'subject-1', 4, 'connected', false, $2),
           ('owner-other', 'subject-other', 2, 'connected', false, $2)`,
        [STALE.ownerId, NOW.toISOString()],
      );
      await postgres.query(
        `insert into vision_calendar_connections (
           owner_id, google_subject, provider_calendar_id, summary,
           ownership_access_role, time_zone, provider_etag, verified_at,
           connection_kind
         ) values
           ($1, 'subject-1', $2, 'Vision', 'owner', 'America/Chicago',
            '"etag-1"', $3, 'existing'),
           ('owner-other', 'subject-other', 'calendar-other', 'Vision', 'owner',
            'America/Chicago', '"etag-2"', $3, 'existing')`,
        [STALE.ownerId, STALE.calendarId, NOW.toISOString()],
      );
      await postgres.query(
        `insert into sync_checkpoints (
           id, owner_id, provider, provider_calendar_id, sync_token_envelope,
           key_version, committed_at, version, status, updated_at
         ) values ('checkpoint-repair', $1, 'google-calendar', $2, $3, 1, $4, 3,
           'connected', $4)`,
        [
          STALE.ownerId,
          STALE.calendarId,
          new Uint8Array([1]),
          new Date(NOW.getTime() - 16 * 60_000).toISOString(),
        ],
      );
      await postgres.query(
        `insert into sync_checkpoints (
           id, owner_id, provider, provider_calendar_id, sync_token_envelope,
           key_version, committed_at, version, status, updated_at
         ) values ('checkpoint-other-owner', 'owner-other', 'google-calendar',
           'calendar-other', $1, 1, $2, 2, 'connected', $2)`,
        [
          new Uint8Array([2]),
          new Date(NOW.getTime() - 16 * 60_000).toISOString(),
        ],
      );
      const repository = createChannelMaintenanceRepository(
        drizzle(postgres) as unknown as VisionDatabase,
        STALE.ownerId,
      );
      const send = vi.fn(async () => undefined);

      await repairCalendarSync(NOW, {
        repository,
        queue: { send },
      });
      await repairCalendarSync(NOW, {
        repository,
        queue: { send },
      });

      expect(send).toHaveBeenCalledOnce();
      expect(
        (
          await postgres.query(
            `select reason, status, owner_id, provider_calendar_id
             from calendar_sync_jobs`,
          )
        ).rows,
      ).toEqual([
        {
          reason: "repair",
          status: "enqueued",
          owner_id: STALE.ownerId,
          provider_calendar_id: STALE.calendarId,
        },
      ]);
    } finally {
      await postgres.close();
    }
  }, 30_000);
});

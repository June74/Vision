import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import { createChannelMaintenanceRepository } from "../../../src/data/repositories/channel-maintenance-repository";
import { renewExpiringChannels } from "../../../src/jobs/renew-google-channels";
import type { ChannelLifecycleDependencies } from "../../../src/jobs/renew-google-channels";
import { repairCalendarSync } from "../../../src/jobs/repair-calendar-sync";

const NOW = new Date("2026-07-24T16:15:00.000Z");
const OWNER = "owner-1";
const CALENDAR = "calendar-1";
let postgres: PGlite;
let database: VisionDatabase;

beforeAll(async () => {
  postgres = new PGlite();
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
  database = drizzle(postgres) as unknown as VisionDatabase;
});

beforeEach(async () => {
  await postgres.exec(`
    truncate table
      calendar_sync_maintenance,
      sync_channels,
      calendar_sync_jobs,
      sync_runs,
      sync_checkpoints,
      vision_calendar_connections,
      calendar_setup_states
    cascade
  `);
});

afterAll(async () => {
  await postgres.close();
});

async function seedCanonicalConnection(): Promise<void> {
  await postgres.query(
    `insert into calendar_setup_states (
       owner_id, google_subject, setup_version, status, action_required, updated_at
     ) values ($1, 'subject-1', 4, 'connected', false, $2)`,
    [OWNER, NOW.toISOString()],
  );
  await postgres.query(
    `insert into vision_calendar_connections (
       owner_id, google_subject, provider_calendar_id, summary,
       ownership_access_role, time_zone, provider_etag, verified_at,
       connection_kind
     ) values (
       $1, 'subject-1', $2, 'Vision', 'owner', 'America/Chicago',
       '"etag"', $3, 'existing'
     )`,
    [OWNER, CALENDAR, NOW.toISOString()],
  );
}

async function seedCheckpoint(): Promise<void> {
  await postgres.query(
    `insert into sync_checkpoints (
       id, owner_id, provider, provider_calendar_id, sync_token_envelope,
       key_version, committed_at, version, status, updated_at
     ) values (
       'checkpoint-1', $1, 'google-calendar', $2, $3, 1, $4, 1,
       'connected', $4
     )`,
    [OWNER, CALENDAR, new Uint8Array([1]), NOW.toISOString()],
  );
}

function renewalDependencies(
  repository: ReturnType<typeof createChannelMaintenanceRepository>,
  watch: ChannelLifecycleDependencies["provider"]["watch"],
  suffix: string,
) {
  return {
    repository,
    provider: {
      watch,
      stop: vi.fn(async () => undefined),
    },
    createChannelId: () => `channel-${suffix}-opaque-id`,
    createChannelToken: () => `token-${suffix}-with-at-least-thirty-two-random-bytes`,
    hashToken: vi.fn(async () => `${suffix}`.padEnd(43, "A").slice(0, 43)),
    encryptToken: vi.fn(async () => new Uint8Array([1, 2, 3])),
    createLeaseId: () => `lease-${suffix}-opaque-id`,
  };
}

describe("adversarial calendar maintenance", () => {
  it("migrates legacy provisional rows without blocking the pending-row election", async () => {
    const legacy = new PGlite();
    try {
      for (const migration of [
        "0001_phase_b_foundation.sql",
        "0002_google_auth_sessions.sql",
        "0003_calendar_setup.sql",
        "0004_incremental_event_sync.sql",
        "0005_google_notification_jobs.sql",
        "0006_google_channel_lifecycle.sql",
      ]) {
        await legacy.exec(
          await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
        );
      }
      await legacy.query(
        `insert into sync_channels (
           id, owner_id, provider, provider_calendar_id, provider_channel_id,
           provider_resource_id, verification_token_envelope,
           verification_token_hash, expires_at, lifecycle, created_at,
           activated_at, failure_count
         ) values
           ('legacy-pending', $1, 'google-calendar', $2, 'pending-channel',
            null, $3, $4, $5, 'pending', $6, null, 0),
           ('legacy-failed', $1, 'google-calendar', $2, 'failed-channel',
            null, $3, $7, $5, 'failed', $6, null, 1)`,
        [
          OWNER,
          CALENDAR,
          new Uint8Array([1]),
          "P".repeat(43),
          new Date(NOW.getTime() + 10 * 60_000).toISOString(),
          NOW.toISOString(),
          "F".repeat(43),
        ],
      );

      await legacy.exec(
        await readFile(
          resolve(process.cwd(), "migrations", "0007_calendar_maintenance_state.sql"),
          "utf8",
        ),
      );

      expect(
        (
          await legacy.query(
            `select lifecycle, renewal_generation,
                    renewal_lease_id like 'legacy_%' as has_lease
             from sync_channels order by id`,
          )
        ).rows,
      ).toEqual([
        { lifecycle: "failed", renewal_generation: 1, has_lease: true },
        { lifecycle: "failed", renewal_generation: 1, has_lease: true },
      ]);
    } finally {
      await legacy.close();
    }
  }, 30_000);

  it("elects one replacement across overlapping production repository schedulers", async () => {
    await seedCanonicalConnection();
    await seedCheckpoint();
    await postgres.query(
      `insert into sync_channels (
         id, owner_id, provider, provider_calendar_id, provider_channel_id,
         provider_resource_id, verification_token_envelope,
         verification_token_hash, expires_at, lifecycle, created_at,
         activated_at, failure_count
       ) values (
         'old-row', $1, 'google-calendar', $2, 'old-channel-opaque-id',
         'old-resource', $3, $4, $5, 'active', $6, $6, 0
       )`,
      [
        OWNER,
        CALENDAR,
        new Uint8Array([1]),
        "O".repeat(43),
        new Date(NOW.getTime() + 30 * 60_000).toISOString(),
        NOW.toISOString(),
      ],
    );
    const first = createChannelMaintenanceRepository(database, OWNER);
    const second = createChannelMaintenanceRepository(database, OWNER);
    await first.bootstrapConnectedCalendars(NOW);
    let selected = 0;
    let release!: () => void;
    const bothSelected = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gate = (repository: typeof first) =>
      new Proxy(repository, {
        get(target, property, receiver) {
          if (property !== "listRenewalCandidates") {
            return Reflect.get(target, property, receiver);
          }
          return async (now: Date) => {
            const candidates = await target.listRenewalCandidates(now);
            selected += 1;
            if (selected === 2) release();
            await bothSelected;
            return candidates;
          };
        },
      });
    const watch = vi.fn(async ({ channelId }: { channelId: string }) => ({
      resourceId: `resource-${channelId}`,
      expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60_000),
    }));

    await Promise.all([
      renewExpiringChannels(
        NOW,
        renewalDependencies(gate(first), watch, "one"),
      ),
      renewExpiringChannels(
        NOW,
        renewalDependencies(gate(second), watch, "two"),
      ),
    ]);

    expect(watch).toHaveBeenCalledOnce();
    expect(
      (
        await postgres.query(
          `select count(*)::integer as count
           from sync_channels where lifecycle = 'active'`,
        )
      ).rows,
    ).toEqual([{ count: 1 }]);
  }, 30_000);

  it.each(["expiring", "missing"] as const)(
    "reaches Action required after six durable %s-channel watch failures",
    async (mode) => {
      await seedCanonicalConnection();
      await seedCheckpoint();
      if (mode === "expiring") {
        await postgres.query(
          `insert into sync_channels (
             id, owner_id, provider, provider_calendar_id, provider_channel_id,
             provider_resource_id, verification_token_envelope,
             verification_token_hash, expires_at, lifecycle, created_at,
             activated_at, failure_count
           ) values (
             'old-row', $1, 'google-calendar', $2, 'old-channel-opaque-id',
             'old-resource', $3, $4, $5, 'active', $6, $6, 0
           )`,
          [
            OWNER,
            CALENDAR,
            new Uint8Array([1]),
            "O".repeat(43),
            new Date(NOW.getTime() + 30 * 60_000).toISOString(),
            NOW.toISOString(),
          ],
        );
      }
      const repository = createChannelMaintenanceRepository(database, OWNER);
      await repository.bootstrapConnectedCalendars(NOW);
      let attempt = 0;
      for (; attempt < 6; attempt += 1) {
        const deps = renewalDependencies(
          repository,
          vi.fn(async () => {
            throw new Error("synthetic safe watch failure");
          }),
          `failure${attempt}`,
        );
        await renewExpiringChannels(
          new Date(NOW.getTime() + attempt * 60_000),
          deps,
        );
      }

      expect(
        (
          await postgres.query(
            `select status, last_error_category from sync_checkpoints`,
          )
        ).rows,
      ).toEqual([
        { status: "action_required", last_error_category: "provider" },
      ]);
      expect(
        (
          await postgres.query(
            `select renewal_failures from calendar_sync_maintenance`,
          )
        ).rows,
      ).toEqual([{ renewal_failures: 6 }]);
    },
    30_000,
  );

  it("stops a newly watched resource when the connection disconnects before activation", async () => {
    await seedCanonicalConnection();
    await seedCheckpoint();
    const repository = createChannelMaintenanceRepository(database, OWNER);
    await repository.bootstrapConnectedCalendars(NOW);
    const stop = vi.fn(async () => undefined);
    const dependencies = renewalDependencies(
      repository,
      vi.fn(async () => {
        await postgres.query(
          `update calendar_setup_states
           set status = 'failed', action_required = true
           where owner_id = $1`,
          [OWNER],
        );
        return {
          resourceId: "orphan-resource",
          expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60_000),
        };
      }),
      "disconnect",
    );
    dependencies.provider.stop = stop;

    await renewExpiringChannels(NOW, dependencies);

    expect(stop).toHaveBeenCalledWith({
      channelId: "channel-disconnect-opaque-id",
      resourceId: "orphan-resource",
    });
    expect(
      (
        await postgres.query(
          `select lifecycle, provider_resource_id from sync_channels`,
        )
      ).rows,
    ).toEqual([{ lifecycle: "failed", provider_resource_id: null }]);
  }, 30_000);

  it("retries exact cleanup for a pre-existing non-current active channel", async () => {
    await seedCanonicalConnection();
    await seedCheckpoint();
    await postgres.query(
      `insert into sync_channels (
         id, owner_id, provider, provider_calendar_id, provider_channel_id,
         provider_resource_id, verification_token_envelope,
         verification_token_hash, expires_at, lifecycle, created_at,
         activated_at, failure_count
       ) values
         ('older-row', $1, 'google-calendar', $2, 'older-channel',
          'older-resource', $3, $4, $5, 'active', $6, $6, 0),
         ('current-row', $1, 'google-calendar', $2, 'current-channel',
          'current-resource', $3, $7, $5, 'active', $8, $8, 0)`,
      [
        OWNER,
        CALENDAR,
        new Uint8Array([1]),
        "O".repeat(43),
        new Date(NOW.getTime() + 7 * 24 * 60 * 60_000).toISOString(),
        NOW.toISOString(),
        "C".repeat(43),
        new Date(NOW.getTime() + 1_000).toISOString(),
      ],
    );
    const repository = createChannelMaintenanceRepository(database, OWNER);
    await repository.bootstrapConnectedCalendars(NOW);
    const stop = vi.fn(async () => undefined);
    const dependencies = renewalDependencies(
      repository,
      vi.fn(async () => {
        throw new Error("watch must not run for a healthy current channel");
      }),
      "cleanup",
    );
    dependencies.provider.stop = stop;

    await renewExpiringChannels(NOW, dependencies);

    expect(stop).toHaveBeenCalledWith({
      channelId: "older-channel",
      resourceId: "older-resource",
    });
    expect(
      (
        await postgres.query(
          `select id, lifecycle from sync_channels order by id`,
        )
      ).rows,
    ).toEqual([
      { id: "current-row", lifecycle: "active" },
      { id: "older-row", lifecycle: "retired" },
    ]);
  }, 30_000);

  it("bootstraps setup-only connection into one initial job, checkpoint, and channel", async () => {
    await seedCanonicalConnection();
    const repository = createChannelMaintenanceRepository(database, OWNER);
    const send = vi.fn(async () => undefined);

    await repairCalendarSync(NOW, {
      repository,
      queue: { send },
    });
    await repairCalendarSync(NOW, {
      repository,
      queue: { send },
    });
    await renewExpiringChannels(
      NOW,
      renewalDependencies(
        repository,
        vi.fn(async () => ({
          resourceId: "initial-resource",
          expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60_000),
        })),
        "initial",
      ),
    );

    expect(
      (
        await postgres.query(
          `select version, status from sync_checkpoints`,
        )
      ).rows,
    ).toEqual([{ version: 0, status: "connected" }]);
    expect(
      (
        await postgres.query(
          `select reason, status, count(*)::integer as count
           from calendar_sync_jobs group by reason, status`,
        )
      ).rows,
    ).toEqual([{ reason: "initial", status: "enqueued", count: 1 }]);
    expect(
      (
        await postgres.query(
          `select lifecycle, count(*)::integer as count
           from sync_channels group by lifecycle`,
        )
      ).rows,
    ).toEqual([{ lifecycle: "active", count: 1 }]);
    expect(send).toHaveBeenCalledOnce();
  }, 30_000);
});

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import { createChannelMaintenanceRepository } from "../../../src/data/repositories/channel-maintenance-repository";
import type {
  RetainedGoogleTokens,
  TokenRepositoryPort,
} from "../../../src/data/repositories/token-repository";
import { GoogleOAuthError } from "../../../src/integrations/google/oauth-client";
import { renewExpiringChannels } from "../../../src/jobs/renew-google-channels";
import type { ChannelLifecycleDependencies } from "../../../src/jobs/renew-google-channels";
import { repairCalendarSync } from "../../../src/jobs/repair-calendar-sync";
import {
  resolveScheduledGoogleAccessToken,
  runScheduledCalendarMaintenance,
} from "../../../src/jobs/scheduled";
import { SyncCalendarError } from "../../../src/jobs/sync-calendar";

const NOW = new Date("2026-07-24T16:15:00.000Z");
const OWNER = "owner-1";
const CALENDAR = "calendar-1";
const AUTHORIZATION_FAILURE_AT = new Date(NOW.getTime() + 1_000);
const RECONNECT_TOKEN_AT = new Date(NOW.getTime() + 4_000);
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
      calendar_setup_states,
      google_oauth_tokens
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

async function seedGoogleToken(input: {
  ownerId?: string;
  googleSubject?: string;
  tokenVersion?: number;
  updatedAt?: Date;
} = {}): Promise<void> {
  await postgres.query(
    `insert into google_oauth_tokens (
       owner_id, google_subject, refresh_token_envelope,
       refresh_token_digest, access_token_envelope, access_expires_at,
       granted_scopes, token_version, updated_at
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.ownerId ?? OWNER,
      input.googleSubject ?? "subject-1",
      new Uint8Array([7]),
      "D".repeat(43),
      new Uint8Array([8]),
      new Date(RECONNECT_TOKEN_AT.getTime() + 3_600_000).toISOString(),
      "https://www.googleapis.com/auth/calendar.readonly",
      input.tokenVersion ?? 2,
      (input.updatedAt ?? RECONNECT_TOKEN_AT).toISOString(),
    ],
  );
}

async function seedSchedulerAuthorizationDisconnect(): Promise<
  ReturnType<typeof createChannelMaintenanceRepository>
> {
  await seedCanonicalConnection();
  await seedCheckpoint();
  const repository = createChannelMaintenanceRepository(database, OWNER);
  await repository.bootstrapConnectedCalendars(NOW);
  expect(
    await repository.recordCredentialFailure(
      new SyncCalendarError("authorization", "disconnected", false),
      AUTHORIZATION_FAILURE_AT,
    ),
  ).toBe(true);
  await seedGoogleToken();
  return repository;
}

async function readRecoveryFacts(): Promise<readonly Record<string, unknown>[]> {
  return (
    await postgres.query<Record<string, unknown>>(
      `select
         checkpoint.id,
         checkpoint.sync_token_envelope,
         checkpoint.key_version,
         checkpoint.committed_at,
         checkpoint.version,
         checkpoint.status,
         checkpoint.last_error_category,
         checkpoint.updated_at as checkpoint_updated_at,
         maintenance.connection_version,
         maintenance.checkpoint_version,
         maintenance.renewal_generation,
         maintenance.renewal_failures,
         maintenance.renewal_lease_id,
         maintenance.renewal_lease_expires_at,
         maintenance.current_channel_row_id,
         maintenance.credential_failure_checkpoint_version,
         maintenance.credential_failure_category,
         maintenance.credential_failure_recorded_at,
         maintenance.updated_at as maintenance_updated_at
       from sync_checkpoints as checkpoint
       inner join calendar_sync_maintenance as maintenance
         on maintenance.owner_id = checkpoint.owner_id
        and maintenance.provider = checkpoint.provider
        and maintenance.provider_calendar_id = checkpoint.provider_calendar_id
       where checkpoint.owner_id = $1`,
      [OWNER],
    )
  ).rows;
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
  it("runs projection cleanup before credential-dependent maintenance and does not suppress it on renewal failure", async () => {
    const order: string[] = [];
    const renewalFailure = new SyncCalendarError(
      "authorization",
      "disconnected",
      false,
    );

    await expect(
      runScheduledCalendarMaintenance(NOW, {
        cleanupProjectionRebuilds: async () => {
          order.push("cleanup");
          return 2;
        },
        repair: async () => {
          order.push("repair");
          return "no_work";
        },
        renew: async () => {
          order.push("renew");
          throw renewalFailure;
        },
      }),
    ).rejects.toBe(renewalFailure);
    expect(order).toEqual(["cleanup", "repair", "renew"]);
  });

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

  it("bootstraps setup-only connection in one first cron into one initial job, checkpoint, maintenance row, and channel", async () => {
    await seedCanonicalConnection();
    const repository = createChannelMaintenanceRepository(database, OWNER);
    const send = vi.fn(async () => undefined);

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
          `select connection_version, checkpoint_version
           from calendar_sync_maintenance`,
        )
      ).rows,
    ).toEqual([{ connection_version: 4, checkpoint_version: 0 }]);
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

  it("converges overlapping first-cron bootstrap into one usable foundation", async () => {
    await seedCanonicalConnection();
    const first = createChannelMaintenanceRepository(database, OWNER);
    const second = createChannelMaintenanceRepository(database, OWNER);

    const results = await Promise.all([
      first.bootstrapConnectedCalendars(NOW),
      second.bootstrapConnectedCalendars(NOW),
    ]);

    expect(results.flat()).toHaveLength(2);
    expect(results.flat().some((result) => result.shouldEnqueue)).toBe(true);
    expect(
      (
        await postgres.query(
          `select
             (select count(*)::integer from sync_checkpoints) as checkpoints,
             (select count(*)::integer from calendar_sync_maintenance) as maintenance,
             (select count(*)::integer from calendar_sync_jobs) as jobs`,
        )
      ).rows,
    ).toEqual([{ checkpoints: 1, maintenance: 1, jobs: 1 }]);
  }, 30_000);

  it.each([false, true])(
    "atomically takes over an expired crashed renewal and preserves exact cleanup identity (resource bound: %s)",
    async (resourceBound) => {
      await seedCanonicalConnection();
      await seedCheckpoint();
      const repository = createChannelMaintenanceRepository(database, OWNER);
      await repository.bootstrapConnectedCalendars(NOW);
      expect(
        await repository.preRegister({
          rowId: "stale-pending-row",
          ownerId: OWNER,
          calendarId: CALENDAR,
          channelId: "stale-channel-opaque-id",
          tokenHash: "S".repeat(43),
          tokenEnvelope: new Uint8Array([1]),
          leaseId: "stale-lease-opaque-id",
          expectedConnectionVersion: 4,
          expectedCheckpointVersion: 1,
          createdAt: NOW,
        }),
      ).toBe(true);
      if (resourceBound) {
        expect(
          await repository.bindWatchedResource({
            rowId: "stale-pending-row",
            ownerId: OWNER,
            calendarId: CALENDAR,
            leaseId: "stale-lease-opaque-id",
            resourceId: "stale-resource",
          }),
        ).toBe(true);
      }
      const takeoverAt = new Date(NOW.getTime() + 3 * 60_000);
      const first = createChannelMaintenanceRepository(database, OWNER);
      const second = createChannelMaintenanceRepository(database, OWNER);
      const takeover = (candidate: typeof first, suffix: string) =>
        candidate.preRegister({
          rowId: `replacement-${suffix}`,
          ownerId: OWNER,
          calendarId: CALENDAR,
          channelId: `replacement-${suffix}-channel`,
          tokenHash: suffix.toUpperCase().padEnd(43, "A").slice(0, 43),
          tokenEnvelope: new Uint8Array([2]),
          leaseId: `replacement-${suffix}-lease`,
          expectedConnectionVersion: 4,
          expectedCheckpointVersion: 1,
          createdAt: takeoverAt,
        });

      const elected = await Promise.all([
        takeover(first, "one"),
        takeover(second, "two"),
      ]);

      expect(elected.filter(Boolean)).toHaveLength(1);
      expect(
        (
          await postgres.query(
            `select id, lifecycle, provider_resource_id, cleanup_required
             from sync_channels order by created_at, id`,
          )
        ).rows,
      ).toEqual([
        {
          id: "stale-pending-row",
          lifecycle: "failed",
          provider_resource_id: resourceBound ? "stale-resource" : null,
          cleanup_required: resourceBound,
        },
        {
          id: elected[0] ? "replacement-one" : "replacement-two",
          lifecycle: "pending",
          provider_resource_id: null,
          cleanup_required: false,
        },
      ]);

      const stop = vi.fn(async () => undefined);
      const dependencies = renewalDependencies(
        repository,
        vi.fn(async () => {
          throw new Error("watch must not run while the takeover lease is live");
        }),
        "takeover-cleanup",
      );
      dependencies.provider.stop = stop;
      await renewExpiringChannels(takeoverAt, dependencies);
      if (resourceBound) {
        expect(stop).toHaveBeenCalledWith({
          channelId: "stale-channel-opaque-id",
          resourceId: "stale-resource",
        });
      } else {
        expect(stop).not.toHaveBeenCalled();
      }
      expect(
        (
          await postgres.query(
            `select lifecycle, provider_resource_id, cleanup_required
             from sync_channels where id = 'stale-pending-row'`,
          )
        ).rows,
      ).toEqual([
        {
          lifecycle: "failed",
          provider_resource_id: null,
          cleanup_required: false,
        },
      ]);
    },
    30_000,
  );

  it.each([
    ["missing", "authorization", "disconnected"],
    ["revoked", "authorization", "disconnected"],
    ["transient", "transient", "retry_scheduled"],
    ["persistence", "database", "retry_scheduled"],
  ] as const)(
    "runs the production %s credential path and persists its generation-bound disposition",
    async (scenario, category, state) => {
      await seedCanonicalConnection();
      await seedCheckpoint();
      const repository = createChannelMaintenanceRepository(database, OWNER);
      await repository.bootstrapConnectedCalendars(NOW);
      const retained: RetainedGoogleTokens = {
        refreshToken: "opaque-refresh-token",
        accessToken: null,
        accessExpiresAt: new Date(NOW.getTime() - 1),
        grantedScopes: ["https://www.googleapis.com/auth/calendar"],
        tokenVersion: 1,
        updatedAt: new Date(NOW.getTime() - 1_000),
      };
      const tokens: Pick<
        TokenRepositoryPort,
        "getGoogleTokens" | "saveRefreshedAccessToken"
      > = {
        getGoogleTokens: vi.fn(async () =>
          scenario === "missing" ? undefined : retained,
        ),
        saveRefreshedAccessToken: vi.fn(async () => {
          if (scenario === "persistence") {
            throw new Error("safe synthetic token persistence failure");
          }
          return {
            ...retained,
            accessToken: "refreshed-access-token",
            accessExpiresAt: new Date(NOW.getTime() + 3_600_000),
          };
        }),
      };
      const refreshAccessToken = vi.fn(async () => {
        if (scenario === "revoked") {
          throw new GoogleOAuthError("authorization");
        }
        if (scenario === "transient") {
          throw new GoogleOAuthError("transient");
        }
        return {
          accessToken: "refreshed-access-token",
          expiresInSeconds: 3_600,
          scopes: ["https://www.googleapis.com/auth/calendar"],
        };
      });

      await expect(
        runScheduledCalendarMaintenance(NOW, {
          repair: vi.fn(async () => "no_work" as const),
          renew: () =>
            resolveScheduledGoogleAccessToken({
              googleSubject: "subject-1",
              tokens,
              refreshAccessToken,
              now: () => NOW,
            }).then(() => "no_work" as const),
          recordCredentialFailure: (error, now) =>
            repository.recordCredentialFailure(error, now),
        }),
      ).rejects.toMatchObject({ category, state });
      expect(
        (
          await postgres.query(
            `select status, last_error_category from sync_checkpoints`,
          )
        ).rows,
      ).toEqual([
        { status: state, last_error_category: category },
      ]);

      const cleared = await repository.clearCredentialRetry(
        new Date(NOW.getTime() + 1_000),
      );
      if (state === "retry_scheduled") {
        expect(cleared).toBe(true);
        expect(
          (
            await postgres.query(
              `select status, last_error_category from sync_checkpoints`,
            )
          ).rows,
        ).toEqual([{ status: "connected", last_error_category: null }]);
      } else {
        expect(cleared).toBe(false);
      }
    },
    30_000,
  );

  it("retains exact watched identity when activation and immediate provider cleanup fail", async () => {
    await seedCanonicalConnection();
    await seedCheckpoint();
    const repository = createChannelMaintenanceRepository(database, OWNER);
    await repository.bootstrapConnectedCalendars(NOW);
    const activationLoser = new Proxy(repository, {
      get(target, property, receiver) {
        if (property === "activate") {
          return async () => false;
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const dependencies = renewalDependencies(
      activationLoser,
      vi.fn(async () => ({
        resourceId: "unreleased-resource",
        expiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60_000),
      })),
      "unreleased",
    );
    dependencies.provider.stop = vi.fn(async () => {
      throw new Error("safe synthetic stop failure");
    });

    await renewExpiringChannels(NOW, dependencies);

    expect(
      (
        await postgres.query(
          `select lifecycle, provider_resource_id, cleanup_required
           from sync_channels`,
        )
      ).rows,
    ).toEqual([
      {
        lifecycle: "failed",
        provider_resource_id: "unreleased-resource",
        cleanup_required: true,
      },
    ]);
    expect(await repository.listSupersededChannels()).toEqual([
      expect.objectContaining({
        channelId: "channel-unreleased-opaque-id",
        resourceId: "unreleased-resource",
      }),
    ]);
  }, 30_000);

  it("recovers the exact scheduler authorization marker once and preserves sync state", async () => {
    const repository = await seedSchedulerAuthorizationDisconnect();
    await postgres.query(
      `insert into sync_channels (
         id, owner_id, provider, provider_calendar_id, provider_channel_id,
         provider_resource_id, verification_token_envelope,
         verification_token_hash, expires_at, lifecycle, created_at,
         activated_at, failure_count
       ) values (
         'channel-preserved', $1, 'google-calendar', $2, 'channel-opaque',
         'resource-opaque', $3, $4, $5, 'active', $6, $6, 3
       )`,
      [
        OWNER,
        CALENDAR,
        new Uint8Array([9]),
        "H".repeat(43),
        new Date(NOW.getTime() + 86_400_000).toISOString(),
        NOW.toISOString(),
      ],
    );
    await postgres.query(
      `update calendar_sync_maintenance
       set current_channel_row_id = 'channel-preserved',
           renewal_generation = 6,
           renewal_failures = 3,
           renewal_lease_id = 'lease-preserved',
           renewal_lease_expires_at = $1
       where owner_id = $2`,
      [new Date(RECONNECT_TOKEN_AT.getTime() + 60_000).toISOString(), OWNER],
    );
    await postgres.query(
      `insert into calendar_sync_jobs (
         job_id, owner_id, provider, provider_calendar_id, reason, status,
         attempts, action_required, created_at, updated_at
       ) values (
         'job-preserved', $1, 'google-calendar', $2, 'repair',
         'enqueued', 2, false, $3, $3
       )`,
      [OWNER, CALENDAR, NOW.toISOString()],
    );
    const channelBefore = (await postgres.query(`select * from sync_channels`)).rows;
    const jobBefore = (await postgres.query(`select * from calendar_sync_jobs`)).rows;
    const topologyBefore = (
      await postgres.query(
        `select setup.*, connection.*
         from calendar_setup_states as setup
         inner join vision_calendar_connections as connection
           on connection.owner_id = setup.owner_id
         where setup.owner_id = $1`,
        [OWNER],
      )
    ).rows;

    await expect(
      repository.recoverAuthorizationAfterReconnect({
        googleSubject: "subject-1",
        tokenVersion: 2,
        tokenUpdatedAt: RECONNECT_TOKEN_AT,
      }),
    ).resolves.toBe("recovered");

    expect(await readRecoveryFacts()).toEqual([
      expect.objectContaining({
        id: "checkpoint-1",
        sync_token_envelope: new Uint8Array([1]),
        key_version: 1,
        committed_at: NOW,
        version: 1,
        status: "connected",
        last_error_category: null,
        checkpoint_updated_at: RECONNECT_TOKEN_AT,
        connection_version: 4,
        checkpoint_version: 1,
        renewal_generation: 6,
        renewal_failures: 3,
        renewal_lease_id: "lease-preserved",
        renewal_lease_expires_at: new Date(RECONNECT_TOKEN_AT.getTime() + 60_000),
        current_channel_row_id: "channel-preserved",
        credential_failure_checkpoint_version: null,
        credential_failure_category: null,
        credential_failure_recorded_at: null,
        maintenance_updated_at: RECONNECT_TOKEN_AT,
      }),
    ]);
    expect((await postgres.query(`select * from sync_channels`)).rows).toEqual(
      channelBefore,
    );
    expect((await postgres.query(`select * from calendar_sync_jobs`)).rows).toEqual(
      jobBefore,
    );
    expect(
      (
        await postgres.query(
          `select setup.*, connection.*
           from calendar_setup_states as setup
           inner join vision_calendar_connections as connection
             on connection.owner_id = setup.owner_id
           where setup.owner_id = $1`,
          [OWNER],
        )
      ).rows,
    ).toEqual(topologyBefore);

    await expect(
      repository.recoverAuthorizationAfterReconnect({
        googleSubject: "subject-1",
        tokenVersion: 2,
        tokenUpdatedAt: RECONNECT_TOKEN_AT,
      }),
    ).resolves.toBe("not_needed");
  });

  it("never moves a newer maintenance timestamp backward", async () => {
    const repository = await seedSchedulerAuthorizationDisconnect();
    const newerMaintenanceAt = new Date(RECONNECT_TOKEN_AT.getTime() + 1_000);
    await postgres.query(
      `update calendar_sync_maintenance set updated_at = $1 where owner_id = $2`,
      [newerMaintenanceAt.toISOString(), OWNER],
    );
    await expect(
      repository.recoverAuthorizationAfterReconnect({
        googleSubject: "subject-1",
        tokenVersion: 2,
        tokenUpdatedAt: RECONNECT_TOKEN_AT,
      }),
    ).resolves.toBe("recovered");
    expect(
      (
        await postgres.query(
          `select updated_at from calendar_sync_maintenance where owner_id = $1`,
          [OWNER],
        )
      ).rows,
    ).toEqual([{ updated_at: newerMaintenanceAt }]);
  });

  it.each([
    ["no setup", async () => { await seedGoogleToken(); }],
    ["non-connected setup", async () => {
      await postgres.query(
        `insert into calendar_setup_states (
           owner_id, google_subject, setup_version, status, action_required, updated_at
         ) values ($1, 'subject-1', 1, 'authenticated', false, $2)`,
        [OWNER, NOW.toISOString()],
      );
      await seedGoogleToken();
    }],
  ] as const)("returns not_needed for %s", async (_name, arrange) => {
    await arrange();
    const repository = createChannelMaintenanceRepository(database, OWNER);
    await expect(
      repository.recoverAuthorizationAfterReconnect({
        googleSubject: "subject-1",
        tokenVersion: 2,
        tokenUpdatedAt: RECONNECT_TOKEN_AT,
      }),
    ).resolves.toBe("not_needed");
  });

  it.each([
    ["connected and unmarked", async (): Promise<void> => undefined],
    ["unrelated retry", async () => {
      await postgres.query(
        `update sync_checkpoints
         set status = 'retry_scheduled', last_error_category = 'transient', updated_at = $1
         where owner_id = $2`,
        [AUTHORIZATION_FAILURE_AT.toISOString(), OWNER],
      );
      await postgres.query(
        `update calendar_sync_maintenance
         set credential_failure_category = 'transient'
         where owner_id = $1`,
        [OWNER],
      );
    }],
    ["unrelated provider state", async () => {
      await postgres.query(
        `update sync_checkpoints
         set status = 'action_required', last_error_category = 'provider', updated_at = $1
         where owner_id = $2`,
        [AUTHORIZATION_FAILURE_AT.toISOString(), OWNER],
      );
    }],
  ] as const)("leaves %s as not_needed", async (name, mutate) => {
    const repository = await seedSchedulerAuthorizationDisconnect();
    if (name === "connected and unmarked") {
      await postgres.query(
        `update sync_checkpoints
         set status = 'connected', last_error_category = null, updated_at = $1
         where owner_id = $2`,
        [RECONNECT_TOKEN_AT.toISOString(), OWNER],
      );
      await postgres.query(
        `update calendar_sync_maintenance
         set credential_failure_checkpoint_version = null,
             credential_failure_category = null,
             credential_failure_recorded_at = null
         where owner_id = $1`,
        [OWNER],
      );
    } else {
      await mutate();
    }
    const before = await readRecoveryFacts();
    await expect(
      repository.recoverAuthorizationAfterReconnect({
        googleSubject: "subject-1",
        tokenVersion: 2,
        tokenUpdatedAt: RECONNECT_TOKEN_AT,
      }),
    ).resolves.toBe("not_needed");
    expect(await readRecoveryFacts()).toEqual(before);
  });

  it.each([
    ["missing connection", `delete from vision_calendar_connections where owner_id = $1`, [OWNER]],
    ["connection version mismatch", `update calendar_sync_maintenance set connection_version = 5 where owner_id = $1`, [OWNER]],
    ["checkpoint version mismatch", `update calendar_sync_maintenance set checkpoint_version = 0 where owner_id = $1`, [OWNER]],
    ["unmarked target", `update calendar_sync_maintenance set credential_failure_checkpoint_version = null, credential_failure_category = null, credential_failure_recorded_at = null where owner_id = $1`, [OWNER]],
    ["marker version mismatch", `update calendar_sync_maintenance set credential_failure_checkpoint_version = 0 where owner_id = $1`, [OWNER]],
    ["marker category mismatch", `update calendar_sync_maintenance set credential_failure_category = 'transient' where owner_id = $1`, [OWNER]],
    ["marker time mismatch", `update calendar_sync_maintenance set credential_failure_recorded_at = $1 where owner_id = $2`, [new Date(AUTHORIZATION_FAILURE_AT.getTime() - 1).toISOString(), OWNER]],
    ["connected checkpoint with marker", `update sync_checkpoints set status = 'connected', last_error_category = null where owner_id = $1`, [OWNER]],
  ] as const)("returns conflict without mutation for %s", async (_name, statement, parameters) => {
    const repository = await seedSchedulerAuthorizationDisconnect();
    await postgres.query(statement, [...parameters]);
    const before = await readRecoveryFacts();
    await expect(
      repository.recoverAuthorizationAfterReconnect({
        googleSubject: "subject-1",
        tokenVersion: 2,
        tokenUpdatedAt: RECONNECT_TOKEN_AT,
      }),
    ).resolves.toBe("conflict");
    expect(await readRecoveryFacts()).toEqual(before);
  });

  it.each(["checkpoint", "maintenance"] as const)(
    "returns conflict and preserves the surviving row when %s is missing",
    async (missing) => {
      const repository = await seedSchedulerAuthorizationDisconnect();
      if (missing === "checkpoint") {
        await postgres.query(`delete from sync_checkpoints where owner_id = $1`, [OWNER]);
      } else {
        await postgres.query(
          `delete from calendar_sync_maintenance where owner_id = $1`,
          [OWNER],
        );
      }
      const survivingTable =
        missing === "checkpoint" ? "calendar_sync_maintenance" : "sync_checkpoints";
      const before = (
        await postgres.query(`select * from ${survivingTable} where owner_id = $1`, [OWNER])
      ).rows;
      await expect(
        repository.recoverAuthorizationAfterReconnect({
          googleSubject: "subject-1",
          tokenVersion: 2,
          tokenUpdatedAt: RECONNECT_TOKEN_AT,
        }),
      ).resolves.toBe("conflict");
      expect(
        (
          await postgres.query(
            `select * from ${survivingTable} where owner_id = $1`,
            [OWNER],
          )
        ).rows,
      ).toEqual(before);
    },
  );

  it("fails closed when connected setup no longer matches the token subject", async () => {
    const repository = await seedSchedulerAuthorizationDisconnect();
    await postgres.query(
      `update calendar_setup_states set google_subject = 'subject-mismatch'
       where owner_id = $1`,
      [OWNER],
    );
    await postgres.query(
      `update vision_calendar_connections set google_subject = 'subject-mismatch'
       where owner_id = $1`,
      [OWNER],
    );
    const before = await readRecoveryFacts();
    await expect(
      repository.recoverAuthorizationAfterReconnect({
        googleSubject: "subject-1",
        tokenVersion: 2,
        tokenUpdatedAt: RECONNECT_TOKEN_AT,
      }),
    ).resolves.toBe("conflict");
    expect(await readRecoveryFacts()).toEqual(before);
  });

  it.each([0, 1] as const)(
    "rejects a marker that is simultaneous with or newer than the token",
    async (offsetMilliseconds) => {
      const repository = await seedSchedulerAuthorizationDisconnect();
      const markerAt = new Date(RECONNECT_TOKEN_AT.getTime() + offsetMilliseconds);
      await postgres.query(
        `update sync_checkpoints set updated_at = $1 where owner_id = $2`,
        [markerAt.toISOString(), OWNER],
      );
      await postgres.query(
        `update calendar_sync_maintenance
         set credential_failure_recorded_at = $1 where owner_id = $2`,
        [markerAt.toISOString(), OWNER],
      );
      const before = await readRecoveryFacts();
      await expect(
        repository.recoverAuthorizationAfterReconnect({
          googleSubject: "subject-1",
          tokenVersion: 2,
          tokenUpdatedAt: RECONNECT_TOKEN_AT,
        }),
      ).resolves.toBe("conflict");
      expect(await readRecoveryFacts()).toEqual(before);
    },
  );

  it.each([
    ["other-subject", 2, RECONNECT_TOKEN_AT],
    ["subject-1", 1, RECONNECT_TOKEN_AT],
    ["subject-1", 2, new Date(RECONNECT_TOKEN_AT.getTime() - 1)],
  ] as const)(
    "fails closed when authoritative token metadata no longer matches",
    async (googleSubject, tokenVersion, tokenUpdatedAt) => {
      const repository = await seedSchedulerAuthorizationDisconnect();
      const before = await readRecoveryFacts();
      await expect(
        repository.recoverAuthorizationAfterReconnect({
          googleSubject,
          tokenVersion,
          tokenUpdatedAt,
        }),
      ).resolves.toBe("conflict");
      expect(await readRecoveryFacts()).toEqual(before);
    },
  );

  it("cannot observe or change another owner's recovery topology", async () => {
    const repository = await seedSchedulerAuthorizationDisconnect();
    const otherOwner = "owner-2";
    const otherSubject = "subject-2";
    const otherCalendar = "calendar-2";
    await postgres.query(
      `insert into calendar_setup_states (
         owner_id, google_subject, setup_version, status, action_required, updated_at
       ) values ($1, $2, 9, 'connected', false, $3)`,
      [otherOwner, otherSubject, NOW.toISOString()],
    );
    await postgres.query(
      `insert into vision_calendar_connections (
         owner_id, google_subject, provider_calendar_id, summary,
         ownership_access_role, time_zone, provider_etag, verified_at,
         connection_kind
       ) values ($1, $2, $3, 'Vision', 'owner', 'America/Chicago',
         'etag-other', $4, 'existing')`,
      [otherOwner, otherSubject, otherCalendar, NOW.toISOString()],
    );
    await postgres.query(
      `insert into sync_checkpoints (
         id, owner_id, provider, provider_calendar_id, sync_token_envelope,
         key_version, committed_at, version, status, last_error_category, updated_at
       ) values ('checkpoint-2', $1, 'google-calendar', $2, $3, 1, $4, 1,
         'disconnected', 'authorization', $4)`,
      [otherOwner, otherCalendar, new Uint8Array([4]), AUTHORIZATION_FAILURE_AT.toISOString()],
    );
    await postgres.query(
      `insert into calendar_sync_maintenance (
         owner_id, provider, provider_calendar_id, connection_version,
         checkpoint_version, renewal_generation, renewal_failures,
         credential_failure_checkpoint_version, credential_failure_category,
         credential_failure_recorded_at, created_at, updated_at
       ) values ($1, 'google-calendar', $2, 9, 1, 8, 5, 1,
         'authorization', $3, $4, $4)`,
      [otherOwner, otherCalendar, AUTHORIZATION_FAILURE_AT.toISOString(), NOW.toISOString()],
    );
    await postgres.query(
      `insert into google_oauth_tokens (
         owner_id, google_subject, refresh_token_envelope,
         refresh_token_digest, access_token_envelope, access_expires_at,
         granted_scopes, token_version, updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, 4, $8)`,
      [
        otherOwner,
        otherSubject,
        new Uint8Array([5]),
        "X".repeat(43),
        new Uint8Array([6]),
        new Date(RECONNECT_TOKEN_AT.getTime() + 3_600_000).toISOString(),
        "https://www.googleapis.com/auth/calendar.readonly",
        RECONNECT_TOKEN_AT.toISOString(),
      ],
    );
    const before = (
      await postgres.query(
        `select checkpoint.*, maintenance.*
         from sync_checkpoints as checkpoint
         inner join calendar_sync_maintenance as maintenance
           on maintenance.owner_id = checkpoint.owner_id
          and maintenance.provider = checkpoint.provider
          and maintenance.provider_calendar_id = checkpoint.provider_calendar_id
         where checkpoint.owner_id = $1`,
        [otherOwner],
      )
    ).rows;

    await expect(
      repository.recoverAuthorizationAfterReconnect({
        googleSubject: "subject-1",
        tokenVersion: 2,
        tokenUpdatedAt: RECONNECT_TOKEN_AT,
      }),
    ).resolves.toBe("recovered");
    expect(
      (
        await postgres.query(
          `select checkpoint.*, maintenance.*
           from sync_checkpoints as checkpoint
           inner join calendar_sync_maintenance as maintenance
             on maintenance.owner_id = checkpoint.owner_id
            and maintenance.provider = checkpoint.provider
            and maintenance.provider_calendar_id = checkpoint.provider_calendar_id
           where checkpoint.owner_id = $1`,
          [otherOwner],
        )
      ).rows,
    ).toEqual(before);
  });

  it("does not persist a stale credential disposition after checkpoint advancement", async () => {
    await seedCanonicalConnection();
    await seedCheckpoint();
    const repository = createChannelMaintenanceRepository(database, OWNER);
    await repository.bootstrapConnectedCalendars(NOW);
    await postgres.query(
      `update sync_checkpoints
       set version = 2, updated_at = $1
       where owner_id = $2 and provider_calendar_id = $3`,
      [new Date(NOW.getTime() + 1_000).toISOString(), OWNER, CALENDAR],
    );

    expect(
      await repository.recordCredentialFailure(
        new SyncCalendarError("authorization", "disconnected", false),
        new Date(NOW.getTime() + 2_000),
      ),
    ).toBe(false);
    expect(
      (
        await postgres.query(
          `select version, status, last_error_category from sync_checkpoints`,
        )
      ).rows,
    ).toEqual([
      { version: 2, status: "connected", last_error_category: null },
    ]);
  }, 30_000);

  it("does not clear a later same-category checkpoint failure as scheduler-owned", async () => {
    await seedCanonicalConnection();
    await seedCheckpoint();
    const repository = createChannelMaintenanceRepository(database, OWNER);
    await repository.bootstrapConnectedCalendars(NOW);
    const schedulerFailureAt = new Date(NOW.getTime() + 1_000);
    expect(
      await repository.recordCredentialFailure(
        new SyncCalendarError("transient", "retry_scheduled", true, 5),
        schedulerFailureAt,
      ),
    ).toBe(true);
    const laterConsumerFailureAt = new Date(NOW.getTime() + 2_000);
    await postgres.query(
      `update sync_checkpoints
       set status = 'retry_scheduled',
           last_error_category = 'transient',
           updated_at = $1
       where owner_id = $2 and provider_calendar_id = $3`,
      [laterConsumerFailureAt.toISOString(), OWNER, CALENDAR],
    );

    expect(
      await repository.clearCredentialRetry(
        new Date(NOW.getTime() + 3_000),
      ),
    ).toBe(false);
    expect(
      (
        await postgres.query(
          `select status, last_error_category, updated_at
           from sync_checkpoints`,
        )
      ).rows,
    ).toEqual([
      {
        status: "retry_scheduled",
        last_error_category: "transient",
        updated_at: laterConsumerFailureAt,
      },
    ]);
  }, 30_000);

  it.each(["transient", "database"] as const)(
    "does not adopt a pre-existing unmarked %s consumer retry",
    async (consumerCategory) => {
      await seedCanonicalConnection();
      await seedCheckpoint();
      const repository = createChannelMaintenanceRepository(database, OWNER);
      await repository.bootstrapConnectedCalendars(NOW);
      const consumerFailureAt = new Date(NOW.getTime() + 1_000);
      await postgres.query(
        `update sync_checkpoints
         set status = 'retry_scheduled',
             last_error_category = $1,
             updated_at = $2
         where owner_id = $3 and provider_calendar_id = $4`,
        [consumerCategory, consumerFailureAt.toISOString(), OWNER, CALENDAR],
      );
      const before = (
        await postgres.query(
          `select version, status, last_error_category, updated_at
           from sync_checkpoints`,
        )
      ).rows;

      expect(
        await repository.recordCredentialFailure(
          new SyncCalendarError("transient", "retry_scheduled", true, 5),
          new Date(NOW.getTime() + 2_000),
        ),
      ).toBe(false);
      expect(
        (
          await postgres.query(
            `select version, status, last_error_category, updated_at
             from sync_checkpoints`,
          )
        ).rows,
      ).toEqual(before);
      expect(
        (
          await postgres.query(
            `select
               credential_failure_checkpoint_version,
               credential_failure_category,
               credential_failure_recorded_at
             from calendar_sync_maintenance`,
          )
        ).rows,
      ).toEqual([
        {
          credential_failure_checkpoint_version: null,
          credential_failure_category: null,
          credential_failure_recorded_at: null,
        },
      ]);
      expect(
        await repository.clearCredentialRetry(
          new Date(NOW.getTime() + 3_000),
        ),
      ).toBe(false);
    },
    30_000,
  );

  it("refreshes only its own exact retry marker", async () => {
    await seedCanonicalConnection();
    await seedCheckpoint();
    const repository = createChannelMaintenanceRepository(database, OWNER);
    await repository.bootstrapConnectedCalendars(NOW);
    const firstSchedulerFailureAt = new Date(NOW.getTime() + 1_000);
    expect(
      await repository.recordCredentialFailure(
        new SyncCalendarError("transient", "retry_scheduled", true, 5),
        firstSchedulerFailureAt,
      ),
    ).toBe(true);
    const refreshedSchedulerFailureAt = new Date(NOW.getTime() + 2_000);

    expect(
      await repository.recordCredentialFailure(
        new SyncCalendarError("database", "retry_scheduled", true, 5),
        refreshedSchedulerFailureAt,
      ),
    ).toBe(true);
    expect(
      (
        await postgres.query(
          `select
             checkpoint.status,
             checkpoint.last_error_category,
             checkpoint.updated_at,
             maintenance.credential_failure_checkpoint_version,
             maintenance.credential_failure_category,
             maintenance.credential_failure_recorded_at
           from sync_checkpoints as checkpoint
           inner join calendar_sync_maintenance as maintenance
             on maintenance.owner_id = checkpoint.owner_id
            and maintenance.provider_calendar_id =
                checkpoint.provider_calendar_id`,
        )
      ).rows,
    ).toEqual([
      {
        status: "retry_scheduled",
        last_error_category: "database",
        updated_at: refreshedSchedulerFailureAt,
        credential_failure_checkpoint_version: 1,
        credential_failure_category: "database",
        credential_failure_recorded_at: refreshedSchedulerFailureAt,
      },
    ]);
    expect(
      await repository.clearCredentialRetry(
        new Date(NOW.getTime() + 3_000),
      ),
    ).toBe(true);
  }, 30_000);

  it.each(["transient", "database"] as const)(
    "preserves a concurrently written %s consumer retry",
    async (consumerCategory) => {
      await seedCanonicalConnection();
      await seedCheckpoint();
      const repository = createChannelMaintenanceRepository(database, OWNER);
      await repository.bootstrapConnectedCalendars(NOW);
      const schedulerFailureAt = new Date(NOW.getTime() + 1_000);
      const consumerFailureAt = new Date(NOW.getTime() + 2_000);

      await Promise.all([
        repository.recordCredentialFailure(
          new SyncCalendarError("transient", "retry_scheduled", true, 5),
          schedulerFailureAt,
        ),
        postgres.query(
          `update sync_checkpoints
           set status = 'retry_scheduled',
               last_error_category = $1,
               updated_at = $2
           where owner_id = $3 and provider_calendar_id = $4`,
          [consumerCategory, consumerFailureAt.toISOString(), OWNER, CALENDAR],
        ),
      ]);

      expect(
        (
          await postgres.query(
            `select status, last_error_category, updated_at
             from sync_checkpoints`,
          )
        ).rows,
      ).toEqual([
        {
          status: "retry_scheduled",
          last_error_category: consumerCategory,
          updated_at: consumerFailureAt,
        },
      ]);
      expect(
        await repository.clearCredentialRetry(
          new Date(NOW.getTime() + 3_000),
        ),
      ).toBe(false);
    },
    30_000,
  );
});

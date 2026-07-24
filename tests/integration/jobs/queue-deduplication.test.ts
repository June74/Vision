import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VisionDatabase } from "../../../src/data/db";
import {
  createCalendarJobRepository,
  type CalendarJobRepository,
} from "../../../src/data/repositories/job-repository";
import {
  consumeCalendarSyncBatch,
  type CalendarSyncBatch,
  type CalendarSyncQueueMessage,
} from "../../../src/jobs/queue-consumer";
import type { CalendarSyncMessage } from "../../../src/jobs/queue-message";
import {
  SyncCalendarError,
  type SyncResult,
} from "../../../src/jobs/sync-calendar";
import type { Env } from "../../../src/server/env";
import { createApp } from "../../../src/worker";

const NOW = new Date("2026-07-24T16:00:00.000Z");
const MESSAGE: CalendarSyncMessage = {
  jobId: "job_1111111111111111111111111111111111111111111",
  ownerId: "owner-1",
  calendarId: "calendar-1",
  reason: "push",
};
let pglite: PGlite;
let repository: CalendarJobRepository;

beforeEach(async () => {
  pglite = new PGlite();
  for (const migration of [
    "0001_phase_b_foundation.sql",
    "0002_google_auth_sessions.sql",
    "0003_calendar_setup.sql",
    "0004_incremental_event_sync.sql",
    "0005_google_notification_jobs.sql",
  ]) {
    await pglite.exec(
      await readFile(resolve(process.cwd(), "migrations", migration), "utf8"),
    );
  }
  repository = createCalendarJobRepository(
    drizzle(pglite) as unknown as VisionDatabase,
  );
  await repository.reserveWebhookJob(MESSAGE, NOW);
  await repository.markEnqueued(MESSAGE.jobId, NOW);
});

afterEach(async () => {
  await pglite.close();
});

function result(): SyncResult {
  return {
    status: "succeeded",
    reason: "push",
    jobId: MESSAGE.jobId,
    pages: 1,
    staged: 0,
    upserted: 0,
    deleted: 0,
    unchanged: 0,
    checkpointVersion: 2,
    durationMs: 3,
  };
}

function queueMessage(
  attempts = 1,
  body: unknown = MESSAGE,
): CalendarSyncQueueMessage {
  return {
    id: `delivery-${attempts}`,
    timestamp: NOW,
    body,
    attempts,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

function batch(...messages: CalendarSyncQueueMessage[]): CalendarSyncBatch {
  return {
    queue: "vision-calendar-sync",
    messages,
  };
}

describe("calendar queue deduplication", () => {
  it("does not enqueue a valid channel notification after its checkpoint disconnects", async () => {
    await pglite.query(`delete from calendar_sync_jobs`);
    const token = "valid-channel-token";
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    );
    let binary = "";
    for (const byte of digest) binary += String.fromCharCode(byte);
    const tokenHash = btoa(binary)
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/u, "");
    await pglite.query(
      `insert into sync_checkpoints (
         id, owner_id, provider, provider_calendar_id, sync_token_envelope,
         key_version, committed_at, version, status, updated_at
       ) values ('checkpoint-1', $1, 'google-calendar', $2, $3, 1, $4, 1, 'disconnected', $4)`,
      [MESSAGE.ownerId, MESSAGE.calendarId, new Uint8Array([1]), NOW.toISOString()],
    );
    await pglite.query(
      `insert into sync_channels (
         id, owner_id, provider, provider_calendar_id, provider_channel_id,
         provider_resource_id, verification_token_envelope,
         verification_token_hash, expires_at
       ) values ('channel-row-1', $1, 'google-calendar', $2, 'channel-1',
         'resource-1', $3, $4, $5)`,
      [
        MESSAGE.ownerId,
        MESSAGE.calendarId,
        new Uint8Array([1]),
        tokenHash,
        new Date(NOW.getTime() + 60_000).toISOString(),
      ],
    );
    const send = vi.fn(async () => undefined);
    const app = createApp({
      googleCalendarWebhook: {
        repository,
        queue: { send },
        now: () => NOW,
      },
      createRequestId: () => "req_disconnected_channel",
      logger: vi.fn(),
    });

    const response = await app.fetch(
      new Request("https://vision.example.test/webhooks/google/calendar", {
        method: "POST",
        headers: {
          "x-goog-channel-id": "channel-1",
          "x-goog-channel-token": token,
          "x-goog-resource-id": "resource-1",
          "x-goog-resource-state": "exists",
          "x-goog-message-number": "1",
        },
      }),
      {} as Env,
    );

    expect(response.status).toBe(204);
    expect(send).not.toHaveBeenCalled();
    expect(
      (await pglite.query(`select count(*)::integer as count from calendar_sync_jobs`))
        .rows,
    ).toEqual([{ count: 0 }]);
  });

  it("executes a duplicate queue delivery only once", async () => {
    const sync = vi.fn(async () => result());
    const first = queueMessage();
    const duplicate = queueMessage();

    await consumeCalendarSyncBatch(batch(first, duplicate), {
      repository,
      sync,
      now: () => NOW,
      createClaimId: () => crypto.randomUUID(),
    });

    expect(sync).toHaveBeenCalledTimes(1);
    expect(first.ack).toHaveBeenCalledOnce();
    expect(duplicate.ack).toHaveBeenCalledOnce();
    expect((await pglite.query(`select status from calendar_sync_jobs`)).rows)
      .toEqual([{ status: "succeeded" }]);
  });

  it("reconciles a committed sync after a consumer crash without running it again", async () => {
    const firstClaim = await repository.claimJob(
      MESSAGE,
      1,
      "claim-before-retry",
      NOW,
    );
    expect(firstClaim.outcome).toBe("claimed");
    await repository.scheduleRetry(
      MESSAGE.jobId,
      "claim-before-retry",
      "transient",
      NOW,
    );
    const crashClaim = await repository.claimJob(
      MESSAGE,
      2,
      "claim-before-crash",
      NOW,
    );
    expect(crashClaim.outcome).toBe("claimed");
    await pglite.query(
      `insert into sync_runs (
         job_id, owner_id, provider, provider_calendar_id, reason,
         page_count, staged_count, upserted_count, deleted_count,
         unchanged_count, started_at, completed_at, checkpoint_version
       ) values (
         $1, $2, 'google-calendar', $3, 'push',
         1, 0, 0, 0, 0, $4, $4, 3
       )`,
      [MESSAGE.jobId, MESSAGE.ownerId, MESSAGE.calendarId, NOW.toISOString()],
    );
    const sync = vi.fn(async () => result());
    const redelivery = queueMessage(3);

    await consumeCalendarSyncBatch(batch(redelivery), {
      repository,
      sync,
      now: () => NOW,
      createClaimId: () => "claim-after-crash",
    });

    expect(sync).not.toHaveBeenCalled();
    expect(redelivery.ack).toHaveBeenCalledOnce();
    expect(
      (
        await pglite.query(
          `select status, checkpoint_version, last_error_category, action_required
           from calendar_sync_jobs`,
        )
      ).rows,
    ).toEqual([
      {
        status: "succeeded",
        checkpoint_version: 3,
        last_error_category: null,
        action_required: false,
      },
    ]);
  });

  it("persists a retryable failure before retrying with its bounded delay", async () => {
    const failure = new SyncCalendarError(
      "transient",
      "retry_scheduled",
      true,
      17,
    );
    const sync = vi.fn(async () => {
      throw failure;
    });
    const message = queueMessage(1);

    await consumeCalendarSyncBatch(batch(message), {
      repository,
      sync,
      now: () => NOW,
      createClaimId: () => "claim-1",
    });

    expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 17 });
    expect(message.ack).not.toHaveBeenCalled();
    expect(
      (
        await pglite.query(
          `select status, attempts, last_error_category, action_required
           from calendar_sync_jobs`,
        )
      ).rows,
    ).toEqual([
      {
        status: "retry_scheduled",
        attempts: 1,
        last_error_category: "transient",
        action_required: false,
      },
    ]);
  });

  it("acks a permanent failure and retains its safe terminal classification", async () => {
    const sync = vi.fn(async () => {
      throw new SyncCalendarError("schema", "action_required", false);
    });
    const message = queueMessage(1);

    await consumeCalendarSyncBatch(batch(message), {
      repository,
      sync,
      now: () => NOW,
      createClaimId: () => "claim-1",
    });

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(
      (
        await pglite.query(
          `select status, last_error_category, action_required
           from calendar_sync_jobs`,
        )
      ).rows,
    ).toEqual([
      {
        status: "failed",
        last_error_category: "schema",
        action_required: true,
      },
    ]);
  });

  it.each(["missing retained credentials", "rejected refresh credentials"])(
    "persists a disconnected checkpoint and failed job for %s",
    async () => {
      await pglite.query(
        `insert into sync_checkpoints (
           id, owner_id, provider, provider_calendar_id, sync_token_envelope,
           key_version, committed_at, version, status, updated_at
         ) values ('checkpoint-auth', $1, 'google-calendar', $2, $3, 1, $4, 1, 'connected', $4)`,
        [
          MESSAGE.ownerId,
          MESSAGE.calendarId,
          new Uint8Array([1]),
          NOW.toISOString(),
        ],
      );
      const sync = vi.fn(async () => {
        throw new SyncCalendarError("authorization", "disconnected", false);
      });
      const message = queueMessage(1);

      await consumeCalendarSyncBatch(batch(message), {
        repository,
        sync,
        recordFailure: async (request, error) => {
          await pglite.query(
            `update sync_checkpoints
             set status = $1, last_error_category = $2, updated_at = $3
             where owner_id = $4 and provider = 'google-calendar'
               and provider_calendar_id = $5 and version = 1`,
            [
              error.state,
              error.category,
              NOW.toISOString(),
              request.ownerId,
              request.calendarId,
            ],
          );
        },
        now: () => NOW,
        createClaimId: () => "claim-auth",
      });

      expect(message.ack).toHaveBeenCalledOnce();
      expect(message.retry).not.toHaveBeenCalled();
      expect(
        (
          await pglite.query(
            `select status, last_error_category from sync_checkpoints`,
          )
        ).rows,
      ).toEqual([
        { status: "disconnected", last_error_category: "authorization" },
      ]);
      expect(
        (
          await pglite.query(
            `select status, last_error_category, action_required
             from calendar_sync_jobs`,
          )
        ).rows,
      ).toEqual([
        {
          status: "failed",
          last_error_category: "authorization",
          action_required: false,
        },
      ]);
    },
  );

  it("turns an unknown retryable failure into Action required at the sixth attempt", async () => {
    const sync = vi.fn(async () => {
      throw new Error("synthetic unknown failure");
    });
    const message = queueMessage(6);

    await consumeCalendarSyncBatch(batch(message), {
      repository,
      sync,
      now: () => NOW,
      createClaimId: () => "claim-6",
    });

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
    expect(
      (
        await pglite.query(
          `select status, attempts, last_error_category, action_required
           from calendar_sync_jobs`,
        )
      ).rows,
    ).toEqual([
      {
        status: "failed",
        attempts: 6,
        last_error_category: "transient",
        action_required: true,
      },
    ]);
  });

  it.each(["transient", "database"] as const)(
    "turns a typed retryable %s failure into Action required at the sixth attempt",
    async (category) => {
      const sync = vi.fn(async () => {
        throw new SyncCalendarError(category, "retry_scheduled", true, 17);
      });
      const message = queueMessage(6);

      await consumeCalendarSyncBatch(batch(message), {
        repository,
        sync,
        now: () => NOW,
        createClaimId: () => `claim-${category}`,
      });

      expect(message.ack).toHaveBeenCalledOnce();
      expect(message.retry).not.toHaveBeenCalled();
      expect(
        (
          await pglite.query(
            `select status, attempts, last_error_category, action_required
             from calendar_sync_jobs`,
          )
        ).rows,
      ).toEqual([
        {
          status: "failed",
          attempts: 6,
          last_error_category: category,
          action_required: true,
        },
      ]);
    },
  );

  it("acks malformed opaque messages without creating or changing jobs", async () => {
    const sync = vi.fn(async () => result());
    const message = queueMessage(1, {
      ...MESSAGE,
      token: "must-not-cross-queue-boundary",
    });

    await consumeCalendarSyncBatch(batch(message), {
      repository,
      sync,
      now: () => NOW,
      createClaimId: () => "claim-invalid",
    });

    expect(sync).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalledOnce();
    expect(
      (await pglite.query(`select status from calendar_sync_jobs`)).rows,
    ).toEqual([{ status: "enqueued" }]);
  });
});

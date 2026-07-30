import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/server/env";
import type {
  CalendarJobRepository,
  GoogleWebhookChannel,
  ReserveWebhookJobResult,
} from "../../src/data/repositories/job-repository";
import type { CalendarSyncMessage } from "../../src/jobs/queue-message";
import { createApp } from "../../src/worker";

const NOW = new Date("2026-07-24T16:00:00.000Z");
const CHANNEL_ID = "channel-1";
const RESOURCE_ID = "resource-1";
const TOKEN = "opaque-webhook-token";

class MemoryWebhookRepository implements CalendarJobRepository {
  readonly jobs = new Map<string, CalendarSyncMessage>();
  readonly channel: GoogleWebhookChannel = {
    ownerId: "owner-1",
    calendarId: "calendar-1",
    providerChannelId: CHANNEL_ID,
    providerResourceId: RESOURCE_ID,
    verificationTokenHash: "",
    expiresAt: new Date(NOW.getTime() + 60_000),
    lifecycle: "active",
  };
  lookup = vi.fn<
    (
      channelId: string,
      tokenHash: string,
    ) => Promise<GoogleWebhookChannel | undefined>
  >(async (_channelId: string, tokenHash: string) => ({
    ...this.channel,
    verificationTokenHash: tokenHash,
  }));

  findGoogleChannel = this.lookup;

  async bindPendingGoogleChannelResource(
    _channelId: string,
    _tokenHash: string,
    resourceId: string,
  ): Promise<GoogleWebhookChannel | undefined> {
    return {
      ...this.channel,
      providerResourceId: resourceId,
      lifecycle: "pending",
    };
  }

  inspect = vi.fn<
    (message: CalendarSyncMessage) => Promise<"new" | "replay">
  >(async (message) => (this.jobs.has(message.jobId) ? "replay" : "new"));

  inspectWebhookReplay = this.inspect;

  reserveWebhookJob = vi.fn<
    (message: CalendarSyncMessage) => Promise<ReserveWebhookJobResult>
  >(async (message) => {
    const existing = this.jobs.get(message.jobId);
    if (existing) return { message: existing, shouldEnqueue: false };
    this.jobs.set(message.jobId, message);
    return { message, shouldEnqueue: true };
  });

  markEnqueued = vi.fn(async () => undefined);

  async claimJob(): Promise<{ outcome: "missing" }> {
    return { outcome: "missing" };
  }

  async completeJob(): Promise<boolean> {
    return false;
  }

  async scheduleRetry(): Promise<boolean> {
    return false;
  }

  async failJob(): Promise<boolean> {
    return false;
  }

  async finishClaimedFailure(): Promise<boolean> {
    return false;
  }
}

function headers(overrides: Record<string, string | undefined> = {}): Headers {
  const values: Record<string, string> = {
    "x-goog-channel-id": CHANNEL_ID,
    "x-goog-channel-token": TOKEN,
    "x-goog-resource-id": RESOURCE_ID,
    "x-goog-resource-state": "exists",
    "x-goog-message-number": "42",
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete values[key];
    else values[key] = value;
  }
  return new Headers(values);
}

function harness(options: {
  channel?: Partial<GoogleWebhookChannel>;
  lookupMissing?: boolean;
  environment?: Partial<Env>;
  now?: () => Date;
} = {}) {
  const repository = new MemoryWebhookRepository();
  Object.assign(repository.channel, options.channel);
  if (options.lookupMissing) repository.lookup.mockResolvedValue(undefined);
  const send = vi.fn(async (_message: CalendarSyncMessage) => undefined);
  const app = createApp({
    googleCalendarWebhook: {
      repository,
      queue: { send },
      now: options.now ?? (() => NOW),
    },
    createRequestId: () => "req_webhook",
    logger: vi.fn(),
  });
  return {
    app,
    repository,
    send,
    environment: (options.environment ?? {}) as Env,
  };
}

async function post(
  app: ReturnType<typeof createApp>,
  webhookHeaders: Headers,
  environment: Env = {} as Env,
): Promise<Response> {
  return app.fetch(
    new Request("https://vision.example.test/webhooks/google/calendar", {
      method: "POST",
      headers: webhookHeaders,
      body: "ignored-provider-body",
    }),
    environment,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Google Calendar notification webhook", () => {
  it.each([
    ["channel", { "x-goog-channel-id": undefined }],
    ["token", { "x-goog-channel-token": undefined }],
    ["resource", { "x-goog-resource-id": undefined }],
    ["state", { "x-goog-resource-state": undefined }],
    ["number", { "x-goog-message-number": undefined }],
  ])("rejects a missing %s header without enqueueing", async (_name, override) => {
    const { app, send } = harness();
    const response = await post(app, headers(override));
    expect(response.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong channel", { lookupMissing: true }],
    ["wrong token", { lookupMissing: true }],
    ["wrong resource", { channel: { providerResourceId: "other-resource" } }],
    [
      "expired channel",
      { channel: { expiresAt: new Date(NOW.getTime() - 1) } },
    ],
  ])("discards a %s signal without enqueueing", async (_name, options) => {
    const { app, send } = harness(options);
    const response = await post(app, headers());
    expect(response.status).toBe(204);
    expect(send).not.toHaveBeenCalled();
  });

  it.each(["sync", "exists"])(
    "durably reserves and enqueues a valid %s signal without fetching events inline",
    async (state) => {
      const { app, repository, send } = harness();
      const response = await post(
        app,
        headers({ "x-goog-resource-state": state }),
      );

      expect(response.status).toBe(204);
      expect(repository.jobs.size).toBe(1);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: "owner-1",
          calendarId: "calendar-1",
          reason: "push",
        }),
      );
      expect(send.mock.calls[0]![0]).toEqual({
        jobId: expect.stringMatching(/^job_[A-Za-z0-9_-]{43}$/u),
        ownerId: "owner-1",
        calendarId: "calendar-1",
        reason: "push",
      });
    },
  );

  it("accepts Google's early sync signal by atomically binding a pending resource", async () => {
    const { app, repository, send } = harness({
      channel: {
        providerResourceId: null,
        lifecycle: "pending",
      },
    });
    const bind = vi.spyOn(repository, "bindPendingGoogleChannelResource");

    const response = await post(
      app,
      headers({ "x-goog-resource-state": "sync" }),
    );

    expect(response.status).toBe(204);
    expect(bind).toHaveBeenCalledWith(
      CHANNEL_ID,
      expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
      RESOURCE_ID,
    );
    expect(send).toHaveBeenCalledOnce();
  });

  it("does not bind non-sync traffic to a pending channel", async () => {
    const { app, repository, send } = harness({
      channel: {
        providerResourceId: null,
        lifecycle: "pending",
      },
    });
    const bind = vi.spyOn(repository, "bindPendingGoogleChannelResource");

    const response = await post(app, headers());

    expect(response.status).toBe(204);
    expect(bind).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("accepts an early sync when activation wins the pending-resource bind race", async () => {
    const { app, repository, send } = harness({
      channel: {
        providerResourceId: null,
        lifecycle: "pending",
      },
    });
    vi.spyOn(repository, "bindPendingGoogleChannelResource").mockImplementation(
      async () => {
        Object.assign(repository.channel, {
          providerResourceId: RESOURCE_ID,
          lifecycle: "active",
        });
        return undefined;
      },
    );

    const response = await post(
      app,
      headers({ "x-goog-resource-state": "sync" }),
    );

    expect(response.status).toBe(204);
    expect(repository.lookup).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledOnce();
  });

  it("authenticates and acknowledges not_exists without enqueueing work", async () => {
    const { app, repository, send } = harness();
    const response = await post(
      app,
      headers({ "x-goog-resource-state": "not_exists" }),
    );

    expect(response.status).toBe(204);
    expect(repository.lookup).toHaveBeenCalledOnce();
    expect(repository.jobs.size).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("deduplicates a repeated HTTP signal by channel, resource, and message number", async () => {
    const { app, repository, send } = harness();
    const first = await post(app, headers());
    const duplicate = await post(app, headers());

    expect(first.status).toBe(204);
    expect(duplicate.status).toBe(204);
    expect(repository.jobs.size).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each(["-1", "01", "1e3", "18446744073709551616", "x"])(
    "rejects malformed or out-of-range message number %s",
    async (messageNumber) => {
      const { app, send } = harness();
      const response = await post(
        app,
        headers({ "x-goog-message-number": messageNumber }),
      );
      expect(response.status).toBe(400);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("does not expose tokens or provider headers in an opaque queue message", async () => {
    const { app, send } = harness();
    await post(app, headers());
    const serialized = JSON.stringify(send.mock.calls[0]![0]);
    expect(serialized).not.toContain(TOKEN);
    expect(serialized).not.toContain(CHANNEL_ID);
    expect(serialized).not.toContain(RESOURCE_ID);
    expect(serialized).not.toContain("x-goog");
  });

  it("suppresses one fully verified new exists signal without durable or Queue mutation", async () => {
    const { app, repository, send, environment } = harness({
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-24T16:00:30.000Z",
      },
    });
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await post(app, headers(), environment);

    expect(response.status).toBe(204);
    expect(repository.inspect).toHaveBeenCalledOnce();
    expect(repository.reserveWebhookJob).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(repository.markEnqueued).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledOnce();
    const entry = write.mock.calls[0]![0];
    expect(entry).toEqual({
      action: "acceptance.sync-suppression",
      evidence: {
        evidenceType: "vision.sync-suppression/v1",
        outcome: "suppressed",
      },
    });
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.evidence)).toBe(true);
    const serialized = JSON.stringify(entry);
    for (const prohibited of [
      TOKEN,
      CHANNEL_ID,
      RESOURCE_ID,
      "42",
      "ignored-provider-body",
      "owner-1",
      "calendar-1",
      "x-goog",
    ]) {
      expect(serialized).not.toContain(prohibited);
    }
  });

  it.each([
    ["sync", { "x-goog-resource-state": "sync" }],
    ["not_exists", { "x-goog-resource-state": "not_exists" }],
  ])("never suppresses a verified %s notification", async (_name, override) => {
    const { app, repository, environment } = harness({
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-24T16:00:30.000Z",
      },
    });
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await post(app, headers(override), environment);

    expect(response.status).toBe(204);
    expect(write).not.toHaveBeenCalled();
    if (_name === "sync") {
      expect(repository.reserveWebhookJob).toHaveBeenCalledOnce();
    } else {
      expect(repository.inspect).not.toHaveBeenCalled();
      expect(repository.reserveWebhookJob).not.toHaveBeenCalled();
    }
  });

  it("never suppresses pending non-sync traffic", async () => {
    const { app, repository, send, environment } = harness({
      channel: { providerResourceId: null, lifecycle: "pending" },
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-24T16:00:30.000Z",
      },
    });
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await post(app, headers(), environment);

    expect(response.status).toBe(204);
    expect(write).not.toHaveBeenCalled();
    expect(repository.inspect).not.toHaveBeenCalled();
    expect(repository.reserveWebhookJob).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("never suppresses malformed or unverified traffic", async () => {
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const activeEnvironment = {
      VISION_ENV: "preview",
      PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
      PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-24T16:00:30.000Z",
    } as Env;
    const malformed = harness({ environment: activeEnvironment });
    const unverified = harness({
      lookupMissing: true,
      environment: activeEnvironment,
    });

    const malformedResponse = await post(
      malformed.app,
      headers({ "x-goog-channel-token": undefined }),
      malformed.environment,
    );
    const unverifiedResponse = await post(
      unverified.app,
      headers(),
      unverified.environment,
    );

    expect(malformedResponse.status).toBe(400);
    expect(unverifiedResponse.status).toBe(204);
    expect(write).not.toHaveBeenCalled();
    expect(malformed.repository.inspect).not.toHaveBeenCalled();
    expect(unverified.repository.inspect).not.toHaveBeenCalled();
  });

  it("does not suppress a durable replay", async () => {
    const { app, repository, send, environment } = harness({
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-24T16:00:30.000Z",
      },
    });
    repository.inspect.mockResolvedValue("replay");
    repository.reserveWebhookJob.mockImplementation(async (message) => ({
      message,
      shouldEnqueue: false,
    }));
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await post(app, headers(), environment);

    expect(response.status).toBe(204);
    expect(repository.inspect).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
    expect(repository.reserveWebhookJob).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    expect(repository.markEnqueued).not.toHaveBeenCalled();
  });

  it("uses an expired valid selector only on the normal durable path", async () => {
    const { app, repository, send, environment } = harness({
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: NOW.toISOString(),
      },
    });
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await post(app, headers(), environment);

    expect(response.status).toBe(204);
    expect(write).not.toHaveBeenCalled();
    expect(repository.reserveWebhookJob).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
    expect(repository.markEnqueued).toHaveBeenCalledOnce();
  });

  it("fails closed on a malformed temporary selector pair", async () => {
    const { app, repository, send, environment } = harness({
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
      },
    });
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await post(app, headers(), environment);

    expect(response.status).toBe(500);
    expect(repository.inspect).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
    expect(repository.reserveWebhookJob).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(repository.markEnqueued).not.toHaveBeenCalled();
  });

  it("uses a fresh post-replay clock only for suppression and preserves reservation timestamps", async () => {
    const freshNow = new Date(NOW.getTime() + 20_000);
    const now = vi
      .fn<() => Date>()
      .mockReturnValueOnce(NOW)
      .mockReturnValueOnce(freshNow);
    const { app, repository, environment } = harness({
      now,
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: new Date(
          NOW.getTime() + 10_000,
        ).toISOString(),
      },
    });
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await post(app, headers(), environment);

    expect(response.status).toBe(204);
    expect(now).toHaveBeenCalledTimes(2);
    expect(repository.inspect).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
    expect(repository.reserveWebhookJob).toHaveBeenCalledWith(
      expect.any(Object),
      NOW,
    );
    expect(repository.markEnqueued).toHaveBeenCalledWith(
      expect.any(String),
      NOW,
    );
  });

  it("treats concurrent new inspections as inconclusive because duplicate terminals may be emitted", async () => {
    const { app, repository, send, environment } = harness({
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-24T16:00:30.000Z",
      },
    });
    repository.inspect.mockResolvedValue("new");
    const write = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const responses = await Promise.all([
      post(app, headers(), environment),
      post(app, headers(), environment),
    ]);

    expect(responses.map((response) => response.status)).toEqual([204, 204]);
    expect(repository.inspect).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledTimes(2);
    expect(repository.reserveWebhookJob).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(repository.markEnqueued).not.toHaveBeenCalled();
  });
});

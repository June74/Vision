import { describe, expect, it, vi } from "vitest";
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

  async reserveWebhookJob(
    message: CalendarSyncMessage,
  ): Promise<ReserveWebhookJobResult> {
    const existing = this.jobs.get(message.jobId);
    if (existing) return { message: existing, shouldEnqueue: false };
    this.jobs.set(message.jobId, message);
    return { message, shouldEnqueue: true };
  }

  async markEnqueued(): Promise<void> {}

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
} = {}) {
  const repository = new MemoryWebhookRepository();
  Object.assign(repository.channel, options.channel);
  if (options.lookupMissing) repository.lookup.mockResolvedValue(undefined);
  const send = vi.fn(async (_message: CalendarSyncMessage) => undefined);
  const app = createApp({
    googleCalendarWebhook: {
      repository,
      queue: { send },
      now: () => NOW,
    },
    createRequestId: () => "req_webhook",
    logger: vi.fn(),
  });
  return { app, repository, send };
}

async function post(
  app: ReturnType<typeof createApp>,
  webhookHeaders: Headers,
): Promise<Response> {
  return app.fetch(
    new Request("https://vision.example.test/webhooks/google/calendar", {
      method: "POST",
      headers: webhookHeaders,
      body: "ignored-provider-body",
    }),
    {} as Env,
  );
}

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
});

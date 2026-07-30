/** Verifies Google Calendar channel signals and enqueues only opaque durable work. */
import type { Hono } from "hono";
import type { AuthRequestVariables } from "../auth/session";
import type { Env } from "../env";
import { createDb } from "../../data/db";
import {
  createCalendarJobRepository,
  type CalendarJobRepository,
} from "../../data/repositories/job-repository";
import type { CalendarSyncMessage } from "../../jobs/queue-message";
import {
  emitTemporarySyncSuppressionEvidence,
  resolveTemporarySyncSuppressionState,
} from "./temporary-preview-sync-suppression";

const MAX_MESSAGE_NUMBER = 18_446_744_073_709_551_615n;
const textEncoder = new TextEncoder();

/** Narrow queue producer surface used by the notification route. */
export interface CalendarSyncQueueProducer {
  send(message: CalendarSyncMessage): Promise<unknown>;
}

/** Runtime dependencies for one verified Google notification request. */
export interface GoogleCalendarWebhookDependencies {
  readonly repository: CalendarJobRepository;
  readonly queue: CalendarSyncQueueProducer;
  readonly now?: () => Date;
}

/** Creates request-local webhook dependencies from Worker bindings. */
export type GoogleCalendarWebhookDependencyFactory = (
  environment: Env,
) =>
  | GoogleCalendarWebhookDependencies
  | Promise<GoogleCalendarWebhookDependencies>;

/** Registers the unauthenticated provider callback behind channel-token verification. */
export function registerGoogleCalendarWebhook(
  app: Hono<{ Bindings: Env; Variables: AuthRequestVariables }>,
  dependencies:
    | GoogleCalendarWebhookDependencies
    | GoogleCalendarWebhookDependencyFactory,
): void {
  app.post("/webhooks/google/calendar", async (context) => {
    const parsed = parseGoogleNotificationHeaders(context.req.raw.headers);
    if (!parsed) return context.body(null, 400);
    const resolved =
      typeof dependencies === "function"
        ? await dependencies(context.env)
        : dependencies;
    const now = resolved.now?.() ?? new Date();
    const tokenHash = await sha256Base64Url(parsed.channelToken);
    let channel = await resolved.repository.findGoogleChannel(
      parsed.channelId,
      tokenHash,
    );
    const storedHash = channel?.verificationTokenHash ?? "A".repeat(43);
    const tokenMatches = constantTimeEqual(tokenHash, storedHash);
    if (
      !channel ||
      !tokenMatches ||
      channel.providerChannelId !== parsed.channelId ||
      channel.expiresAt.getTime() <= now.getTime()
    ) {
      return context.body(null, 204);
    }
    if (channel.lifecycle === "pending") {
      if (
        parsed.resourceState !== "sync" ||
        (channel.providerResourceId !== null &&
          channel.providerResourceId !== parsed.resourceId)
      ) {
        return context.body(null, 204);
      }
      channel =
        channel.providerResourceId === null
          ? (await resolved.repository.bindPendingGoogleChannelResource(
                parsed.channelId,
                tokenHash,
                parsed.resourceId,
              )) ??
            (await resolved.repository.findGoogleChannel(
              parsed.channelId,
              tokenHash,
            ))
          : channel;
      if (!channel) return context.body(null, 204);
    }
    if (channel.providerResourceId !== parsed.resourceId) {
      return context.body(null, 204);
    }
    if (parsed.resourceState === "not_exists") {
      return context.body(null, 204);
    }

    const message = Object.freeze({
      jobId: await stableNotificationJobId(
        parsed.channelId,
        parsed.resourceId,
        parsed.messageNumber,
      ),
      ownerId: channel.ownerId,
      calendarId: channel.calendarId,
      reason: "push" as const,
    });
    const replay = await resolved.repository.inspectWebhookReplay(message);
    const suppressionState = resolveTemporarySyncSuppressionState(
      resolved.now?.() ?? new Date(),
      context.env,
    );
    if (
      parsed.resourceState === "exists" &&
      replay === "new" &&
      suppressionState === "active"
    ) {
      emitTemporarySyncSuppressionEvidence();
      return context.body(null, 204);
    }
    const reserved = await resolved.repository.reserveWebhookJob(message, now);
    if (reserved.shouldEnqueue) {
      await resolved.queue.send(reserved.message);
      await resolved.repository.markEnqueued(reserved.message.jobId, now);
    }
    return context.body(null, 204);
  });
}

/** Builds the production database and queue boundaries lazily for the webhook route. */
export function createProductionGoogleCalendarWebhookDependencies(
  environment: Env,
): GoogleCalendarWebhookDependencies {
  if (!environment.CALENDAR_SYNC_QUEUE) {
    throw new Error("Calendar synchronization queue is unavailable.");
  }
  return {
    repository: createCalendarJobRepository(createDb(environment.DATABASE_URL)),
    queue: environment.CALENDAR_SYNC_QUEUE,
    /** Reads current time at the channel-expiry decision. */
    now: () => new Date(),
  };
}

/** Parses the exact bounded Google header set used as a change signal. */
function parseGoogleNotificationHeaders(headers: Headers):
  | {
      channelId: string;
      channelToken: string;
      resourceId: string;
      resourceState: "sync" | "exists" | "not_exists";
      messageNumber: string;
    }
  | undefined {
  const channelId = headers.get("x-goog-channel-id");
  const channelToken = headers.get("x-goog-channel-token");
  const resourceId = headers.get("x-goog-resource-id");
  const resourceState = headers.get("x-goog-resource-state");
  const messageNumber = headers.get("x-goog-message-number");
  if (
    !boundedText(channelId, 256) ||
    !boundedText(channelToken, 256) ||
    !boundedText(resourceId, 1_024) ||
    (resourceState !== "sync" &&
      resourceState !== "exists" &&
      resourceState !== "not_exists") ||
    !isBoundedMessageNumber(messageNumber)
  ) {
    return undefined;
  }
  return {
    channelId,
    channelToken,
    resourceId,
    resourceState,
    messageNumber,
  };
}

/** Accepts Google's unsigned decimal message counter without lossy number conversion. */
function isBoundedMessageNumber(value: unknown): value is string {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,19})$/u.test(value)) {
    return false;
  }
  try {
    return BigInt(value) <= MAX_MESSAGE_NUMBER;
  } catch {
    return false;
  }
}

/** Hashes a high-entropy channel token before any database lookup. */
async function sha256Base64Url(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", textEncoder.encode(value)),
  );
  return encodeBase64Url(digest);
}

/** Derives a stable opaque idempotency key from non-content provider signal identity. */
async function stableNotificationJobId(
  channelId: string,
  resourceId: string,
  messageNumber: string,
): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      textEncoder.encode(
        JSON.stringify([
          "vision-google-calendar-notification",
          1,
          channelId,
          resourceId,
          messageNumber,
        ]),
      ),
    ),
  );
  return `job_${encodeBase64Url(digest)}`;
}

/** Compares fixed-length digests without data-dependent early exit. */
function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  let difference = leftBytes.byteLength ^ rightBytes.byteLength;
  const length = Math.max(leftBytes.byteLength, rightBytes.byteLength);
  for (let index = 0; index < length; index += 1) {
    difference |=
      (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

/** Encodes bytes as unpadded canonical base64url without exposing intermediate text. */
function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

/** Recognizes one bounded non-empty header value. */
function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

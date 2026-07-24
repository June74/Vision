/** Reads Google Calendar event changes through the read-only paginated `events.list` boundary. */
import { z } from "zod";
import type { ProviderEventChange } from "../../domain/sync/change";
import {
  GoogleEventMappingError,
  mapGoogleEvent,
} from "./event-mapper";

const MAX_TOKEN_CHARS = 16 * 1024;
const MAX_CALENDAR_ID_CHARS = 2 * 1024;
const MAX_ERROR_BODY_BYTES = 8 * 1024;
const MAX_PROVIDER_PAGE_BYTES = 8 * 1024 * 1024;
const googleErrorReasonSchema = z
  .object({
    error: z.object({
      errors: z.array(z.object({ reason: z.string().min(1).max(128) })).max(16),
    }),
  });
const googleEventsPageSchema = z
  .object({
    items: z.array(z.unknown()).max(2_500).default([]),
    nextPageToken: z.string().min(1).max(MAX_TOKEN_CHARS).optional(),
    nextSyncToken: z.string().min(1).max(MAX_TOKEN_CHARS).optional(),
    timeZone: z.string().min(1).max(255),
  })
  .passthrough()
  .superRefine((page, context) => {
    if ((page.nextPageToken === undefined) === (page.nextSyncToken === undefined)) {
      context.addIssue({
        code: "custom",
        message: "A Google events page must contain exactly one continuation token.",
      });
    }
  });

/** Bounded request accepted by the provider-neutral event synchronization client. */
export interface EventSyncListRequest {
  readonly calendarId: string;
  readonly pageToken?: string;
  readonly syncToken?: string;
}

/** One validated page whose events have already crossed the Google mapper boundary. */
export interface EventSyncPage {
  readonly changes: readonly ProviderEventChange[];
  readonly calendarTimeZone: string;
  readonly nextPageToken?: string;
  readonly nextSyncToken?: string;
}

/** Read-only provider surface consumed by the synchronization job. */
export interface EventSyncClient {
  listChanges(request: EventSyncListRequest): Promise<EventSyncPage>;
}

/** Safe provider failure classes used to select queue and connection behavior. */
export type EventSyncClientErrorCategory =
  | "authorization"
  | "provider"
  | "payload_too_large"
  | "quota"
  | "schema"
  | "sync_token_invalid"
  | "transient";

/** Reports a Google boundary failure without retaining the response, credential, URL, or token. */
export class EventSyncClientError extends Error {
  /** Builds one constant-text provider failure with safe status metadata. */
  constructor(
    readonly category: EventSyncClientErrorCategory,
    readonly status?: number,
  ) {
    super("Google Calendar event synchronization failed.");
    this.name = "EventSyncClientError";
  }
}

/** Injectable dependencies for the production Google `events.list` adapter. */
export interface GoogleEventSyncClientOptions {
  readonly accessToken: string;
  readonly fetcher?: typeof fetch;
  readonly maxResults?: number;
}

/** Creates a Google event client that never exposes event-write methods. */
export function createGoogleEventSyncClient(
  options: GoogleEventSyncClientOptions,
): EventSyncClient {
  const accessToken = validateSecretToken(options.accessToken);
  const fetcher = options.fetcher ?? fetch;
  const maxResults = options.maxResults ?? 2_500;
  if (!Number.isSafeInteger(maxResults) || maxResults <= 0 || maxResults > 2_500) {
    throw new EventSyncClientError("schema");
  }

  return {
    /** Lists exactly one page while retaining the original sync query across page requests. */
    async listChanges(request: EventSyncListRequest): Promise<EventSyncPage> {
      const validated = validateRequest(request);
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(validated.calendarId)}/events`,
      );
      url.searchParams.set("showDeleted", "true");
      url.searchParams.set("singleEvents", "false");
      url.searchParams.set("maxResults", String(maxResults));
      if (validated.syncToken !== undefined) {
        url.searchParams.set("syncToken", validated.syncToken);
      }
      if (validated.pageToken !== undefined) {
        url.searchParams.set("pageToken", validated.pageToken);
      }

      let response: Response;
      try {
        response = await fetcher(url, {
          method: "GET",
          headers: { authorization: `Bearer ${accessToken}` },
        });
      } catch {
        throw new EventSyncClientError("transient");
      }

      if (!response.ok) {
        throw await classifyResponse(response);
      }

      let raw: unknown;
      try {
        raw = await readBoundedJson(response, MAX_PROVIDER_PAGE_BYTES);
      } catch (error) {
        if (error instanceof EventSyncClientError) throw error;
        throw new EventSyncClientError("schema", response.status);
      }
      const page = googleEventsPageSchema.safeParse(raw);
      if (!page.success) {
        throw new EventSyncClientError("schema", response.status);
      }

      try {
        const changes = page.data.items.map((item) =>
          mapGoogleEvent(
            addCalendarIdentity(item, validated.calendarId),
            { calendarTimeZone: page.data.timeZone },
          ),
        );
        return {
          changes,
          calendarTimeZone: page.data.timeZone,
          ...(page.data.nextPageToken === undefined
            ? {}
            : { nextPageToken: page.data.nextPageToken }),
          ...(page.data.nextSyncToken === undefined
            ? {}
            : { nextSyncToken: page.data.nextSyncToken }),
        };
      } catch (error) {
        if (error instanceof GoogleEventMappingError) {
          throw new EventSyncClientError("schema", response.status);
        }
        throw error;
      }
    },
  };
}

/** Validates opaque request identifiers without returning their values in an error. */
function validateRequest(request: EventSyncListRequest): EventSyncListRequest {
  if (
    typeof request !== "object" ||
    request === null ||
    typeof request.calendarId !== "string" ||
    request.calendarId.length === 0 ||
    request.calendarId.length > MAX_CALENDAR_ID_CHARS ||
    (request.pageToken !== undefined &&
      (typeof request.pageToken !== "string" ||
        request.pageToken.length === 0 ||
        request.pageToken.length > MAX_TOKEN_CHARS)) ||
    (request.syncToken !== undefined &&
      (typeof request.syncToken !== "string" ||
        request.syncToken.length === 0 ||
        request.syncToken.length > MAX_TOKEN_CHARS))
  ) {
    throw new EventSyncClientError("schema");
  }
  return request;
}

/** Adds the trusted requested calendar identity without accepting a provider override. */
function addCalendarIdentity(item: unknown, calendarId: string): unknown {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    throw new EventSyncClientError("schema");
  }
  return { ...item, calendarId };
}

/** Maps HTTP status and a bounded closed 403 reason set without reflecting provider text. */
async function classifyResponse(response: Response): Promise<EventSyncClientError> {
  const { status } = response;
  if (status === 403) {
    return classifyForbiddenReason(await readBoundedForbiddenReasons(response));
  }
  if (status === 401) {
    return new EventSyncClientError("authorization", status);
  }
  if (status === 410) {
    return new EventSyncClientError("sync_token_invalid", status);
  }
  if (status === 429 || (status >= 500 && status <= 599)) {
    return new EventSyncClientError("transient", status);
  }
  return new EventSyncClientError("provider", status);
}

/** Reads only a small closed reason projection from a 403 body and discards all provider text. */
async function readBoundedForbiddenReasons(
  response: Response,
): Promise<readonly string[] | undefined> {
  try {
    const bytes = await readBoundedBytes(response, MAX_ERROR_BODY_BYTES);
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed = googleErrorReasonSchema.safeParse(JSON.parse(decoded) as unknown);
    return parsed.success
      ? parsed.data.error.errors.map(({ reason }) => reason)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Reads and parses one successful provider page while enforcing a strict raw response cap. */
async function readBoundedJson(response: Response, maximumBytes: number): Promise<unknown> {
  let bytes: Uint8Array;
  try {
    bytes = await readBoundedBytes(response, maximumBytes);
  } catch (error) {
    if (error instanceof EventSyncClientError) throw error;
    throw new EventSyncClientError("schema", response.status);
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new EventSyncClientError("schema", response.status);
  }
}

/** Materializes a response only while it remains beneath the supplied Worker-safe byte cap. */
async function readBoundedBytes(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new EventSyncClientError("payload_too_large", response.status);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    reader.releaseLock();
  }
}

/** Applies the explicit safe retry, quota, and permission policy to closed 403 reason values. */
function classifyForbiddenReason(
  reasons: readonly string[] | undefined,
): EventSyncClientError {
  if (
    reasons?.some((reason) =>
      reason === "rateLimitExceeded" || reason === "userRateLimitExceeded")
  ) {
    return new EventSyncClientError("transient", 403);
  }
  if (reasons?.includes("quotaExceeded")) {
    return new EventSyncClientError("quota", 403);
  }
  if (
    reasons?.some((reason) =>
      reason === "insufficientPermissions" ||
      reason === "forbidden" ||
      reason === "permissionDenied")
  ) {
    return new EventSyncClientError("authorization", 403);
  }
  return new EventSyncClientError("provider", 403);
}

/** Snapshots a bounded bearer credential at construction without logging it. */
function validateSecretToken(token: string): string {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_CHARS) {
    throw new EventSyncClientError("schema");
  }
  return token;
}

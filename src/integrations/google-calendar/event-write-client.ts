/** Provides the bounded Google event-write surface consumed by the Phase C executor. */
import { z } from "zod";
import {
  CalendarWriteProviderError,
  type CalendarWriteMutationProvider,
  type CalendarWriteMutationProviderInput,
  type CalendarWriteProvider,
  type CalendarWriteProviderEvent,
} from "../../domain/calendar-write/create-execution";

const GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";
const MAX_TOKEN_CHARS = 16 * 1024;
const MAX_BODY_BYTES = 1_048_576;
const MAX_DEADLINE_MS = 30_000;
const DEFAULT_DEADLINE_MS = 10_000;
const MAX_BODY_CHUNKS = 4_096;
const MAX_LIST_RESULTS = 2_500;
const NOT_FOUND = Symbol("google-event-not-found");

const text = z.string().min(1).max(8_192);
const eventResponseSchema = z
  .object({
    id: z.string().min(1).max(1_024),
    etag: z.string().min(1).max(1_024),
    status: z.enum(["confirmed", "tentative", "cancelled"]),
    summary: z.string().min(1).max(1_024),
    description: z.string().max(8_192).optional(),
    start: z
      .object({
        dateTime: z.string().datetime({ offset: true }),
        timeZone: z.string().min(1).max(255),
      })
      .strict(),
    end: z
      .object({
        dateTime: z.string().datetime({ offset: true }),
        timeZone: z.string().min(1).max(255),
      })
      .strict(),
    attendees: z.array(z.unknown()).max(50).optional(),
    recurrence: z.array(z.string().max(1_024)).max(20).optional(),
    extendedProperties: z
      .object({
        private: z.record(z.string().max(128), z.string().max(1_024)),
      })
      .passthrough(),
  })
  .passthrough();
const eventListSchema = z
  .object({ items: z.array(z.unknown()).max(MAX_LIST_RESULTS).optional() })
  .passthrough();
const calendarResponseSchema = z
  .object({ id: z.string().min(1).max(1_024), etag: z.string().min(1).max(1_024) })
  .passthrough();

/** Options for bounded testable Google Calendar event requests. */
export interface GoogleEventWriteClientOptions {
  readonly accessToken: string;
  readonly fetcher?: typeof fetch;
  readonly deadlineMs?: number;
  readonly maxBodyBytes?: number;
}

/** Creates the only Google event-write adapter exposed to the Phase C executor. */
export function createGoogleEventWriteClient(
  options: GoogleEventWriteClientOptions,
): CalendarWriteMutationProvider {
  if (!isBoundedText(options.accessToken, MAX_TOKEN_CHARS)) {
    throw new CalendarWriteProviderError("definite_failure");
  }
  const accessToken = options.accessToken;
  const fetcher = options.fetcher ?? fetch;
  const deadlineMs = readPositiveBound(
    options.deadlineMs ?? DEFAULT_DEADLINE_MS,
    MAX_DEADLINE_MS,
  );
  const maxBodyBytes = readPositiveBound(
    options.maxBodyBytes ?? MAX_BODY_BYTES,
    MAX_BODY_BYTES,
  );

  return {
    /** Reads the selected calendar's current provider ETag before mutation. */
    async readCalendarVersion(calendarId) {
      assertProviderText(calendarId, 2_048);
      const payload = await requestJson(
        `${GOOGLE_CALENDAR_BASE_URL}/calendars/${encodeURIComponent(calendarId)}`,
        { method: "GET" },
        false,
        false,
        fetcher,
        deadlineMs,
        maxBodyBytes,
        accessToken,
      );
      const parsed = calendarResponseSchema.safeParse(payload);
      if (!parsed.success || parsed.data.id !== calendarId) {
        throw new CalendarWriteProviderError("definite_failure");
      }
      return Object.freeze({ calendarId, version: parsed.data.etag });
    },

    /** Inserts one timed event with no attendee or provider notification effects. */
    async createOneOffEvent(input) {
      validateCreateInput(input);
      const payload = await requestJson(
        buildEventsUrl(input.calendarId, { sendUpdates: "none" }),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            summary: input.title,
            ...(input.description === null ? {} : { description: input.description }),
            start: { dateTime: input.startsAt, timeZone: input.timeZone },
            end: { dateTime: input.endsAt, timeZone: input.timeZone },
            extendedProperties: {
              private: {
                "vision.operationId": input.operationId,
                "vision.domain": input.domain,
                "vision.privacy": input.privacy,
              },
            },
          }),
        },
        true,
        false,
        fetcher,
        deadlineMs,
        maxBodyBytes,
        accessToken,
      );
      return normalizeEvent(payload, input.operationId);
    },

    /** Patches the explicitly previewed event fields with provider notifications disabled. */
    async updateEvent(input) {
      validateMutationInput(input);
      const payload = await requestJson(
        buildEventsUrl(input.calendarId, {
          eventId: input.eventId,
          sendUpdates: "none",
        }),
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "if-match": input.expectedVersion,
          },
          body: JSON.stringify({
            summary: input.title,
            description: input.description ?? "",
            start: { dateTime: input.startsAt, timeZone: input.timeZone },
            end: { dateTime: input.endsAt, timeZone: input.timeZone },
            extendedProperties: {
              private: {
                "vision.operationId": input.operationId,
                "vision.domain": input.domain,
                "vision.privacy": input.privacy,
              },
            },
          }),
        },
        true,
        false,
        fetcher,
        deadlineMs,
        maxBodyBytes,
        accessToken,
      );
      return normalizeEvent(payload, input.operationId);
    },

    /** Patches only the disclosed time fields for an explicitly previewed move. */
    async moveEvent(input) {
      validateMutationInput(input);
      const payload = await requestJson(
        buildEventsUrl(input.calendarId, {
          eventId: input.eventId,
          sendUpdates: "none",
        }),
        {
          method: "PATCH",
          headers: { "content-type": "application/json", "if-match": input.expectedVersion },
          body: JSON.stringify({
            start: { dateTime: input.startsAt, timeZone: input.timeZone },
            end: { dateTime: input.endsAt, timeZone: input.timeZone },
          }),
        },
        true,
        false,
        fetcher,
        deadlineMs,
        maxBodyBytes,
        accessToken,
      );
      return normalizeEvent(payload, input.operationId);
    },

    /** Patches provider status to cancelled; cancellation remains distinct from deletion. */
    async cancelEvent(input) {
      validateMutationInput(input);
      if (input.status !== "cancelled") {
        throw new CalendarWriteProviderError("definite_failure");
      }
      const payload = await requestJson(
        buildEventsUrl(input.calendarId, {
          eventId: input.eventId,
          sendUpdates: "none",
        }),
        {
          method: "PATCH",
          headers: { "content-type": "application/json", "if-match": input.expectedVersion },
          body: JSON.stringify({ status: "cancelled" }),
        },
        true,
        false,
        fetcher,
        deadlineMs,
        maxBodyBytes,
        accessToken,
      );
      return normalizeEvent(payload, input.operationId);
    },

    /** Finds candidate events through the private operation marker for reconciliation. */
    async findByOperationId(input) {
      assertProviderText(input.calendarId, 2_048);
      assertOpaqueId(input.operationId);
      const payload = await requestJson(
        buildEventsUrl(input.calendarId, {
          showDeleted: "false",
          singleEvents: "false",
          maxResults: String(MAX_LIST_RESULTS),
          privateExtendedProperty: `vision.operationId=${input.operationId}`,
        }),
        { method: "GET" },
        false,
        false,
        fetcher,
        deadlineMs,
        maxBodyBytes,
        accessToken,
      );
      const parsed = eventListSchema.safeParse(payload);
      if (!parsed.success) throw new CalendarWriteProviderError("uncertain");
      const events = (parsed.data.items ?? []).map((item) =>
        normalizeEvent(item, input.operationId),
      );
      return Object.freeze(events);
    },

    /** Reads one event and returns undefined only when the provider confirms absence. */
    async readEvent(input) {
      assertProviderText(input.calendarId, 2_048);
      assertOpaqueId(input.eventId);
      const payload = await requestJson(
        `${GOOGLE_CALENDAR_BASE_URL}/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
        { method: "GET" },
        false,
        true,
        fetcher,
        deadlineMs,
        maxBodyBytes,
        accessToken,
      );
      if (payload === NOT_FOUND) return undefined;
      return normalizeEvent(payload);
    },

    /** Deletes one event with an expected provider version and no notifications. */
    async deleteEvent(input) {
      assertProviderText(input.calendarId, 2_048);
      assertOpaqueId(input.eventId);
      if (!isProviderText(input.expectedVersion, 1_024)) {
        throw new CalendarWriteProviderError("definite_failure");
      }
      const payload = await requestJson(
        buildEventsUrl(input.calendarId, {
          eventId: input.eventId,
          sendUpdates: "none",
        }),
        {
          method: "DELETE",
          headers: { "if-match": input.expectedVersion },
        },
        true,
        true,
        fetcher,
        deadlineMs,
        maxBodyBytes,
        accessToken,
      );
      return payload === NOT_FOUND ? "not_found" : "deleted";
    },
  };
}

/** Builds a fixed-origin Google events URL with bounded encoded parameters. */
function buildEventsUrl(
  calendarId: string,
  parameters: Record<string, string>,
): string {
  const eventId = parameters.eventId;
  const url = new URL(
    `${GOOGLE_CALENDAR_BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events${eventId ? `/${encodeURIComponent(eventId)}` : ""}`,
  );
  for (const [key, value] of Object.entries(parameters)) {
    if (key !== "eventId") url.searchParams.set(key, value);
  }
  return url.toString();
}

/** Validates the closed one-off event shape before it reaches the provider. */
function validateCreateInput(input: Parameters<CalendarWriteProvider["createOneOffEvent"]>[0]): void {
  assertProviderText(input.calendarId, 2_048);
  assertOpaqueId(input.operationId);
  if (
    !isBoundedText(input.title, 1_024) ||
    (input.description !== null && !isBoundedText(input.description, 8_192)) ||
    !isBoundedText(input.timeZone, 255) ||
    !isBoundedText(input.domain, 32) ||
    !isBoundedText(input.privacy, 32) ||
    input.attendees.length !== 0 ||
    input.recurrence !== null ||
    input.notifications !== "none" ||
    Date.parse(input.endsAt) <= Date.parse(input.startsAt)
  ) {
    throw new CalendarWriteProviderError("definite_failure");
  }
}

/** Validates the closed one-off mutation payload before a PATCH reaches Google. */
function validateMutationInput(input: CalendarWriteMutationProviderInput): void {
  assertProviderText(input.calendarId, 2_048);
  assertOpaqueId(input.eventId);
  assertOpaqueId(input.operationId);
  if (
    !isProviderText(input.expectedVersion, 1_024) ||
    !isBoundedText(input.title, 1_024) ||
    (input.description !== null && !isBoundedText(input.description, 8_192)) ||
    !isBoundedText(input.timeZone, 255) ||
    !isBoundedText(input.domain, 32) ||
    !isBoundedText(input.privacy, 32) ||
    (input.status !== "confirmed" &&
      input.status !== "tentative" &&
      input.status !== "cancelled") ||
    input.attendees.length !== 0 ||
    input.recurrence !== null ||
    input.notifications !== "none" ||
    Date.parse(input.endsAt) <= Date.parse(input.startsAt)
  ) {
    throw new CalendarWriteProviderError("definite_failure");
  }
}

/** Converts a validated Google event into the provider-neutral read-back shape. */
function normalizeEvent(
  value: unknown,
  expectedOperationId?: string,
): CalendarWriteProviderEvent {
  const parsed = eventResponseSchema.safeParse(value);
  if (!parsed.success) throw new CalendarWriteProviderError("uncertain");
  const privateValues = parsed.data.extendedProperties.private;
  const operationId = privateValues["vision.operationId"];
  const domain = privateValues["vision.domain"];
  const privacy = privateValues["vision.privacy"];
  if (
    !operationId ||
    !domain ||
    !privacy ||
    (expectedOperationId !== undefined && operationId !== expectedOperationId) ||
    (domain !== "school" && domain !== "work" && domain !== "personal") ||
    (privacy !== "planning" && privacy !== "private" && privacy !== "restricted") ||
    (parsed.data.attendees?.length ?? 0) !== 0 ||
    (parsed.data.recurrence?.length ?? 0) !== 0 ||
    parsed.data.start.timeZone !== parsed.data.end.timeZone ||
    Date.parse(parsed.data.end.dateTime) <= Date.parse(parsed.data.start.dateTime)
  ) {
    throw new CalendarWriteProviderError("uncertain");
  }
  return Object.freeze({
    eventId: parsed.data.id,
    version: parsed.data.etag,
    title: parsed.data.summary,
    description:
      parsed.data.description === undefined || parsed.data.description === ""
        ? null
        : parsed.data.description,
    startsAt: parsed.data.start.dateTime,
    endsAt: parsed.data.end.dateTime,
    timeZone: parsed.data.start.timeZone,
    operationId,
    domain,
    privacy,
    status: parsed.data.status,
    attendees: [] as const,
    recurrence: null,
    notifications: "none",
  });
}

/** Performs one fixed-origin request with constant error classification and bounds. */
async function requestJson(
  url: string,
  init: RequestInit,
  mutationMayHaveSucceeded: boolean,
  notFoundAllowed: boolean,
  fetcher: typeof fetch,
  deadlineMs: number,
  maxBodyBytes: number,
  accessToken: string,
): Promise<unknown | typeof NOT_FOUND | undefined> {
  const controller = new AbortController();
  let rejectDeadline!: (reason: Error) => void;
  const deadline = new Promise<never>((_resolve, reject) => {
    rejectDeadline = reject;
  });
  const timer = setTimeout(() => {
    controller.abort();
    rejectDeadline(new Error("deadline"));
  }, deadlineMs);
  try {
    const response = await Promise.race([
      fetcher(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...(init.headers ?? {}),
          accept: "application/json",
          authorization: `Bearer ${accessToken}`,
        },
      }),
      deadline,
    ]);
    if (response.status === 404 && notFoundAllowed) return NOT_FOUND;
    if (!response.ok) {
      throw new CalendarWriteProviderError(
        mutationMayHaveSucceeded && isUncertainStatus(response.status)
          ? "uncertain"
          : "definite_failure",
      );
    }
    if (response.status === 204) return undefined;
    return await readBoundedJson(response, controller, deadline, maxBodyBytes);
  } catch (error) {
    if (error instanceof CalendarWriteProviderError) throw error;
    throw new CalendarWriteProviderError(
      mutationMayHaveSucceeded ? "uncertain" : "definite_failure",
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Reads and parses a JSON response without exceeding the configured byte budget. */
async function readBoundedJson(
  response: Response,
  controller: AbortController,
  deadline: Promise<never>,
  maxBodyBytes: number,
): Promise<unknown> {
  if (!/^application\/json(?:;|$)/iu.test(response.headers.get("content-type") ?? "")) {
    throw new Error("content type");
  }
  if (!response.body) throw new Error("body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let count = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      count += 1;
      if (!value || count > MAX_BODY_CHUNKS || value.byteLength > maxBodyBytes - bytes) {
        throw new Error("body limit");
      }
      chunks.push(value);
      bytes += value.byteLength;
    }
  } catch (error) {
    controller.abort();
    try {
      await reader.cancel();
    } catch {
      // Cleanup must not replace the constant provider classification.
    }
    throw error;
  }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(merged)) as unknown;
  } catch {
    throw new Error("json");
  }
}

/** Classifies statuses whose mutation outcome may be unknown after transport failure. */
function isUncertainStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/** Rejects non-provider opaque IDs before they reach a URL or query marker. */
function assertOpaqueId(value: unknown): asserts value is string {
  if (!isBoundedText(value, 1_024) || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)) {
    throw new CalendarWriteProviderError("definite_failure");
  }
}

/** Rejects provider identifiers or versions containing unsafe control characters. */
function assertProviderText(
  value: unknown,
  maximum: number,
): asserts value is string {
  if (!isProviderText(value, maximum)) {
    throw new CalendarWriteProviderError("definite_failure");
  }
}

/** Checks a bounded provider value without exposing rejected content. */
function isProviderText(value: unknown, maximum: number): value is string {
  return (
    isBoundedText(value, maximum) &&
    !/[\u0000-\u001F\u007F]/u.test(value)
  );
}

/** Checks a nonempty bounded string used by the adapter's closed fields. */
function isBoundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

/** Validates a positive request bound without exceeding the reviewed ceiling. */
function readPositiveBound(value: unknown, maximum: number): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > maximum
  ) {
    throw new CalendarWriteProviderError("definite_failure");
  }
  return value;
}

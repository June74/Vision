/** Provides the only Google Calendar endpoints allowed during Vision calendar setup. */
import { z } from "zod";

const GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";
const MAX_PROVIDER_BODY_BYTES = 1_048_576;
const MAX_PROVIDER_DEADLINE_MS = 30_000;
const DEFAULT_PROVIDER_DEADLINE_MS = 10_000;
const MAX_PROVIDER_BODY_CHUNKS = 4_096;
const MAX_LIST_PAGES = 10;
const MAX_CALENDAR_ENTRIES = 1_000;
const protocolText = z.string().min(1).max(1_024);
const timeZoneText = z.string().min(1).max(255);
const etagText = z.string().min(1).max(1_024);
const calendarListEntrySchema = z
  .object({
    id: protocolText,
    summary: z.string().max(1_024),
    accessRole: z.enum(["none", "freeBusyReader", "reader", "writer", "owner"]),
    primary: z.boolean().optional(),
    deleted: z.boolean().optional(),
    timeZone: timeZoneText,
    etag: etagText,
  })
  .passthrough();
const calendarListSchema = z
  .object({
    items: z.array(calendarListEntrySchema).max(250).optional(),
    nextPageToken: protocolText.optional(),
  })
  .passthrough();
const insertedCalendarSchema = z
  .object({
    id: protocolText,
    summary: z.literal("Vision"),
    timeZone: timeZoneText,
    etag: etagText,
  })
  .passthrough();

/** Provider outcome categories used to decide whether creation may safely be reconciled. */
export type CalendarProviderOutcome = "definite_failure" | "uncertain";

/** A safe adapter failure that deliberately retains no provider body, URL, token, or cause. */
export class CalendarProviderError extends Error {
  /** Creates one constant provider error carrying only the retry-safety classification. */
  constructor(public readonly outcome: CalendarProviderOutcome) {
    super("Google Calendar request failed.");
    this.name = "CalendarProviderError";
  }
}

/** Account-bound proof that one stable CalendarList entry is an owned secondary Vision calendar. */
export interface OwnedSecondaryCalendar {
  readonly id: string;
  readonly summary: "Vision";
  readonly accessRole: "owner";
  readonly timeZone: string;
  readonly providerEtag: string;
  readonly ownerGoogleSubject: string;
}

/** Minimal Calendars.insert result; ownership is not trusted until CalendarList verification. */
export interface CreatedSecondaryCalendar {
  readonly id: string;
  readonly summary: "Vision";
  readonly timeZone: string;
  readonly providerEtag: string;
}

/** Testable resource bounds whose production values cannot exceed reviewed ceilings. */
export interface CalendarClientOptions {
  readonly deadlineMs?: number;
  readonly maxBodyBytes?: number;
}

/** Internal marker used only to race fetch and stream reads against one deadline. */
class CalendarDeadlineExceeded extends Error {}

/** Internal marker for malformed or over-limit provider response bodies. */
class CalendarResponseRejected extends Error {}

/** Narrow Google adapter that can list, create, and verify calendars but has no event methods. */
export class CalendarClient {
  private readonly deadlineMs: number;
  private readonly maxBodyBytes: number;

  /** Binds a short-lived token and all ownership evidence to one server-verified Google subject. */
  constructor(
    private readonly accessToken: string,
    private readonly verifiedGoogleSubject: string,
    private readonly fetcher: typeof fetch = fetch,
    options: CalendarClientOptions = {},
  ) {
    if (
      !isBoundedText(accessToken, 16 * 1024) ||
      !isBoundedText(verifiedGoogleSubject, 255)
    ) {
      throw new CalendarProviderError("definite_failure");
    }
    this.deadlineMs = readPositiveBound(
      options.deadlineMs ?? DEFAULT_PROVIDER_DEADLINE_MS,
      MAX_PROVIDER_DEADLINE_MS,
    );
    this.maxBodyBytes = readPositiveBound(
      options.maxBodyBytes ?? MAX_PROVIDER_BODY_BYTES,
      MAX_PROVIDER_BODY_BYTES,
    );
  }

  /** Lists exact-name owned secondary calendars through bounded CalendarList pagination. */
  async listOwnedSecondaryCalendars(): Promise<readonly OwnedSecondaryCalendar[]> {
    const calendars: OwnedSecondaryCalendar[] = [];
    const visitedTokens = new Set<string>();
    let pageToken: string | undefined;

    for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
      const url = new URL(`${GOOGLE_CALENDAR_BASE_URL}/users/me/calendarList`);
      url.searchParams.set("maxResults", "250");
      url.searchParams.set("minAccessRole", "owner");
      url.searchParams.set("showDeleted", "false");
      url.searchParams.set("showHidden", "false");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const payload = calendarListSchema.safeParse(
        await this.request(url.toString(), { method: "GET" }, false),
      );
      if (!payload.success) throw new CalendarProviderError("definite_failure");
      const items = payload.data.items ?? [];
      if (calendars.length + items.length > MAX_CALENDAR_ENTRIES) {
        throw new CalendarProviderError("definite_failure");
      }
      for (const entry of items) {
        if (isOwnedVisionEntry(entry)) {
          calendars.push(bindOwnership(entry, this.verifiedGoogleSubject));
        }
      }
      const next = payload.data.nextPageToken;
      if (!next) return Object.freeze(calendars);
      if (visitedTokens.has(next)) {
        throw new CalendarProviderError("definite_failure");
      }
      visitedTokens.add(next);
      pageToken = next;
    }
    throw new CalendarProviderError("definite_failure");
  }

  /** Creates exactly one secondary `Vision` calendar with the caller's validated user time zone. */
  async createSecondaryCalendar(
    userTimeZone: string,
  ): Promise<CreatedSecondaryCalendar> {
    if (!isBoundedText(userTimeZone, 255)) {
      throw new CalendarProviderError("definite_failure");
    }
    const payload = insertedCalendarSchema.safeParse(await this.request(
      `${GOOGLE_CALENDAR_BASE_URL}/calendars`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summary: "Vision", timeZone: userTimeZone }),
      },
      true,
    ));
    if (!payload.success) throw new CalendarProviderError("uncertain");
    return Object.freeze({
      id: payload.data.id,
      summary: "Vision",
      timeZone: payload.data.timeZone,
      providerEtag: payload.data.etag,
    });
  }

  /** Verifies one encoded stable ID as an owned secondary Vision CalendarList entry. */
  async getCalendar(calendarId: string): Promise<OwnedSecondaryCalendar> {
    if (!isBoundedText(calendarId, 1_024)) {
      throw new CalendarProviderError("definite_failure");
    }
    const payload = calendarListEntrySchema.safeParse(await this.request(
      `${GOOGLE_CALENDAR_BASE_URL}/users/me/calendarList/${encodeURIComponent(calendarId)}`,
      { method: "GET" },
      false,
    ));
    if (!payload.success || !isOwnedVisionEntry(payload.data)) {
      throw new CalendarProviderError("definite_failure");
    }
    return bindOwnership(payload.data, this.verifiedGoogleSubject);
  }

  /** Executes one fixed-origin bearer request and removes all raw failures at the boundary. */
  private async request(
    url: string,
    init: RequestInit,
    mutationMayHaveSucceeded: boolean,
  ): Promise<unknown> {
    const controller = new AbortController();
    let rejectDeadline!: (reason: CalendarDeadlineExceeded) => void;
    const deadline = new Promise<never>((_resolve, reject) => {
      rejectDeadline = reject;
    });
    const timer = setTimeout(() => {
      controller.abort();
      rejectDeadline(new CalendarDeadlineExceeded());
    }, this.deadlineMs);
    try {
      const response = await Promise.race([
        this.fetcher(url, {
          ...init,
          signal: controller.signal,
          headers: {
            accept: "application/json",
            authorization: `Bearer ${this.accessToken}`,
            ...(init.headers ?? {}),
          },
        }),
        deadline,
      ]);
      if (!response.ok) {
        throw new CalendarProviderError(
          mutationMayHaveSucceeded && response.status >= 500
            ? "uncertain"
            : "definite_failure",
        );
      }
      return await readBoundedJson(
        response,
        deadline,
        controller,
        this.maxBodyBytes,
      );
    } catch (error) {
      if (error instanceof CalendarProviderError) throw error;
      throw new CalendarProviderError(
        mutationMayHaveSucceeded ? "uncertain" : "definite_failure",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Reads a provider JSON body only after media type and byte bounds are enforced. */
async function readBoundedJson(
  response: Response,
  deadline: Promise<never>,
  controller: AbortController,
  maximumBytes: number,
): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/json(?:;|$)/iu.test(contentType)) {
    throw new CalendarResponseRejected();
  }
  if (!response.body) throw new CalendarResponseRejected();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  let chunkCount = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      chunkCount += 1;
      if (
        !value ||
        chunkCount > MAX_PROVIDER_BODY_CHUNKS ||
        value.byteLength > maximumBytes - byteLength
      ) {
        throw new CalendarResponseRejected();
      }
      chunks.push(value);
      byteLength += value.byteLength;
    }
  } catch (error) {
    controller.abort();
    cancelReaderSafely(reader);
    throw error;
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    throw new CalendarResponseRejected();
  }
}

/** Starts best-effort stream cleanup without letting a hostile cancel promise delay the request. */
function cancelReaderSafely(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): void {
  try {
    void reader.cancel().catch(() => undefined);
  } catch {
    // A non-conforming stream cannot make cleanup part of the request deadline.
  }
}

/** Returns whether a CalendarList entry meets every setup ownership and identity rule. */
function isOwnedVisionEntry(
  entry: z.infer<typeof calendarListEntrySchema>,
): boolean {
  return (
    entry.summary === "Vision" &&
    entry.accessRole === "owner" &&
    entry.primary !== true &&
    entry.deleted !== true &&
    entry.id.trim().length > 0
  );
}

/** Adds the verified token subject that makes an `owner` role meaningful to Vision. */
function bindOwnership(
  entry: z.infer<typeof calendarListEntrySchema>,
  googleSubject: string,
): OwnedSecondaryCalendar {
  return Object.freeze({
    id: entry.id,
    summary: "Vision",
    accessRole: "owner",
    timeZone: entry.timeZone,
    providerEtag: entry.etag,
    ownerGoogleSubject: googleSubject,
  });
}

/** Accepts one non-whitespace scalar within a protocol-specific character bound. */
function isBoundedText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum
  );
}

/** Validates a positive integer test override without exceeding the production ceiling. */
function readPositiveBound(value: unknown, maximum: number): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > maximum
  ) {
    throw new CalendarProviderError("definite_failure");
  }
  return value;
}

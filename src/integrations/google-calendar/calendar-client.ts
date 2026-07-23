/** Provides the only Google Calendar endpoints allowed during Vision calendar setup. */
import { z } from "zod";

const GOOGLE_CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3";
const MAX_PROVIDER_BODY_BYTES = 1_048_576;
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

/** Narrow Google adapter that can list, create, and verify calendars but has no event methods. */
export class CalendarClient {
  /** Binds a short-lived token and all ownership evidence to one server-verified Google subject. */
  constructor(
    private readonly accessToken: string,
    private readonly verifiedGoogleSubject: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (
      !isBoundedText(accessToken, 16 * 1024) ||
      !isBoundedText(verifiedGoogleSubject, 255)
    ) {
      throw new CalendarProviderError("definite_failure");
    }
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
      const response = await this.request(url.toString(), { method: "GET" }, false);
      const payload = calendarListSchema.safeParse(
        await readBoundedJson(response),
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
    const response = await this.request(
      `${GOOGLE_CALENDAR_BASE_URL}/calendars`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summary: "Vision", timeZone: userTimeZone }),
      },
      true,
    );
    const payload = insertedCalendarSchema.safeParse(
      await readBoundedJson(response),
    );
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
    const response = await this.request(
      `${GOOGLE_CALENDAR_BASE_URL}/users/me/calendarList/${encodeURIComponent(calendarId)}`,
      { method: "GET" },
      false,
    );
    const payload = calendarListEntrySchema.safeParse(
      await readBoundedJson(response),
    );
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
  ): Promise<Response> {
    try {
      const response = await this.fetcher(url, {
        ...init,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.accessToken}`,
          ...(init.headers ?? {}),
        },
      });
      if (!response.ok) {
        throw new CalendarProviderError(
          mutationMayHaveSucceeded && response.status >= 500
            ? "uncertain"
            : "definite_failure",
        );
      }
      return response;
    } catch (error) {
      if (error instanceof CalendarProviderError) throw error;
      throw new CalendarProviderError(
        mutationMayHaveSucceeded ? "uncertain" : "definite_failure",
      );
    }
  }
}

/** Reads a provider JSON body only after media type and byte bounds are enforced. */
async function readBoundedJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/json(?:;|$)/iu.test(contentType)) {
    throw new CalendarProviderError("definite_failure");
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_PROVIDER_BODY_BYTES) {
    throw new CalendarProviderError("definite_failure");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CalendarProviderError("definite_failure");
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

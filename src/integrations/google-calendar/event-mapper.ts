/** Translates one permissive Google Calendar event boundary value into a closed provider-neutral change. */
import { z } from "zod";
import {
  ProviderEventChangeSchema,
  type ProviderEventChange,
  type ProviderRecurrence,
} from "../../domain/sync/change";

const MAX_PROVIDER_TEXT_LENGTH = 32_768;
const MAX_PROVIDER_ARRAY_LENGTH = 2_000;
const nonEmptyProviderText = z.string().trim().min(1).max(MAX_PROVIDER_TEXT_LENGTH);
const googleTimeSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
    dateTime: z.string().max(255).optional(),
    timeZone: z.string().trim().min(1).max(255).optional(),
  })
  .passthrough();
const googleAttendeeSchema = z.object({ email: nonEmptyProviderText.optional() }).passthrough();
const googleAttachmentSchema = z
  .object({
    fileId: nonEmptyProviderText.optional(),
    fileUrl: nonEmptyProviderText.optional(),
    mimeType: nonEmptyProviderText.optional(),
  })
  .passthrough();
const googleEventSchema = z
  .object({
    attachments: z.array(googleAttachmentSchema).max(MAX_PROVIDER_ARRAY_LENGTH).optional(),
    attendees: z.array(googleAttendeeSchema).max(MAX_PROVIDER_ARRAY_LENGTH).optional(),
    calendarId: nonEmptyProviderText,
    conferenceData: z
      .object({
        entryPoints: z
          .array(z.object({ uri: nonEmptyProviderText.optional() }).passthrough())
          .max(MAX_PROVIDER_ARRAY_LENGTH)
          .optional(),
      })
      .passthrough()
      .optional(),
    description: z.string().max(MAX_PROVIDER_TEXT_LENGTH).optional(),
    end: googleTimeSchema.optional(),
    hangoutLink: nonEmptyProviderText.optional(),
    id: nonEmptyProviderText,
    location: z.string().max(MAX_PROVIDER_TEXT_LENGTH).optional(),
    originalStartTime: googleTimeSchema.optional(),
    recurrence: z.array(z.string().max(MAX_PROVIDER_TEXT_LENGTH)).max(MAX_PROVIDER_ARRAY_LENGTH).optional(),
    recurringEventId: nonEmptyProviderText.optional(),
    start: googleTimeSchema.optional(),
    status: z.enum(["cancelled", "confirmed", "tentative"]).optional(),
    summary: z.string().max(MAX_PROVIDER_TEXT_LENGTH).optional(),
    timeZone: z.string().trim().min(1).max(255).optional(),
    transparency: z.enum(["opaque", "transparent"]).optional(),
    updated: z.string().max(255).optional(),
  })
  .passthrough();

/** Reports malformed provider data without retaining or exposing the provider response. */
export class GoogleEventMappingError extends Error {
  /** Creates the single safe mapper error used for malformed Google event payloads. */
  constructor() {
    super("Google Calendar event data is invalid.");
    this.name = "GoogleEventMappingError";
  }
}

/** Maps one Google event plus its supplied calendar context to an immutable Vision provider change. */
export function mapGoogleEvent(raw: unknown): ProviderEventChange {
  const parsed = googleEventSchema.safeParse(raw);
  if (!parsed.success) throw new GoogleEventMappingError();
  const event = parsed.data;
  const status = event.status ?? "confirmed";
  const timeZone = readTimeZone(event);
  const recurrence = mapRecurrence(event, timeZone);

  if (status === "cancelled") {
    return ProviderEventChangeSchema.parse({
      recurrence,
      target: {
        sourceCalendarId: event.calendarId,
        sourceEventId: event.id,
        sourceSystem: "google-calendar",
      },
      type: "delete",
    });
  }
  if (!event.updated) throw new GoogleEventMappingError();
  const identity = {
    sourceCalendarId: event.calendarId,
    sourceEventId: event.id,
    sourceSystem: "google-calendar",
    sourceVersion: toProviderOrderKey(event.updated),
  } as const;
  const startsAt = normalizeGoogleTime(event.start, timeZone);
  const endsAt = normalizeGoogleTime(event.end, timeZone);
  const mapped = ProviderEventChangeSchema.safeParse({
    busy: event.transparency !== "transparent",
    endsAt,
    identity,
    protected: {
      attachmentReferences: mapAttachmentReferences(event.attachments),
      attendees: mapAttendees(event.attendees),
      description: event.description ?? null,
      location: event.location ?? null,
      meetingLinks: mapMeetingLinks(event),
      title: event.summary ?? null,
    },
    recurrence,
    startsAt,
    status,
    timeZone,
    type: "upsert",
  });
  if (!mapped.success) throw new GoogleEventMappingError();
  return mapped.data;
}

/** Selects and validates the source zone retained beside normalized instants. */
function readTimeZone(event: z.infer<typeof googleEventSchema>): string {
  const timeZone = event.start?.timeZone ?? event.end?.timeZone ?? event.timeZone ?? "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return timeZone;
  } catch {
    throw new GoogleEventMappingError();
  }
}

/** Converts a provider revision timestamp into Vision's fixed-width comparable provider order key. */
function toProviderOrderKey(updated: string): string {
  const parsed = parseGoogleDateTime(updated);
  if (!parsed.offset) throw new GoogleEventMappingError();
  const milliseconds = Date.parse(updated);
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
    throw new GoogleEventMappingError();
  }
  const value = String(milliseconds).padStart(20, "0");
  if (!/^\d{20}$/u.test(value)) throw new GoogleEventMappingError();
  return value;
}

/** Derives a closed recurrence identity without retaining Google recurrence rules or unsupported fields. */
function mapRecurrence(
  event: z.infer<typeof googleEventSchema>,
  timeZone: string,
): ProviderRecurrence {
  if (event.recurringEventId) {
    const originalStartAt = event.originalStartTime
      ? normalizeGoogleTime(event.originalStartTime, timeZone)
      : undefined;
    return originalStartAt === undefined
      ? { kind: "occurrence", masterEventId: event.recurringEventId }
      : { kind: "occurrence", masterEventId: event.recurringEventId, originalStartAt };
  }
  return event.recurrence && event.recurrence.length > 0
    ? { kind: "master", masterEventId: event.id }
    : { kind: "single" };
}

/** Normalizes one Google date-time or all-day date to a UTC instant while preserving its original zone separately. */
function normalizeGoogleTime(
  value: z.infer<typeof googleTimeSchema> | undefined,
  timeZone: string,
): string {
  if (!value) throw new GoogleEventMappingError();
  if (value.dateTime) {
    return normalizeGoogleDateTime(value.dateTime, value.timeZone ?? timeZone, value.timeZone !== undefined);
  }
  if (value.date) return localDateStartToInstant(value.date, value.timeZone ?? timeZone);
  throw new GoogleEventMappingError();
}

/** Normalizes an RFC 3339 instant directly or resolves an offset-less wall clock only in its explicit IANA zone. */
function normalizeGoogleDateTime(
  dateTime: string,
  timeZone: string,
  hasExplicitTimeZone: boolean,
): string {
  const parsed = parseGoogleDateTime(dateTime);
  if (parsed.offset) {
    const milliseconds = Date.parse(dateTime);
    if (!Number.isSafeInteger(milliseconds)) throw new GoogleEventMappingError();
    if (hasExplicitTimeZone && !matchesLocalDateTime(milliseconds, timeZone, parsed)) {
      throw new GoogleEventMappingError();
    }
    return new Date(milliseconds).toISOString();
  }
  if (!hasExplicitTimeZone) throw new GoogleEventMappingError();
  return localDateTimeToInstant(parsed, timeZone);
}

/** Parses the limited RFC 3339 calendar fields needed to distinguish an instant from an offset-less local time. */
function parseGoogleDateTime(dateTime: string): {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
  readonly offset: string | undefined;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})?$/u.exec(dateTime);
  if (!match) throw new GoogleEventMappingError();
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText, offset] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number((fractionText ?? "").slice(0, 3).padEnd(3, "0"));
  const localEpoch = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  if (
    !Number.isSafeInteger(localEpoch) ||
    new Date(localEpoch).getUTCFullYear() !== year ||
    new Date(localEpoch).getUTCMonth() !== month - 1 ||
    new Date(localEpoch).getUTCDate() !== day ||
    new Date(localEpoch).getUTCHours() !== hour ||
    new Date(localEpoch).getUTCMinutes() !== minute ||
    new Date(localEpoch).getUTCSeconds() !== second ||
    new Date(localEpoch).getUTCMilliseconds() !== millisecond
  ) {
    throw new GoogleEventMappingError();
  }
  return { year, month, day, hour, minute, second, millisecond, offset };
}

/** Finds the earliest instant belonging to one all-day local date without treating a midnight gap or overlap as invalid. */
function localDateStartToInstant(date: string, timeZone: string): string {
  const localDate = parseGoogleDateTime(`${date}T00:00:00`);
  const localEpoch = Date.UTC(localDate.year, localDate.month - 1, localDate.day);
  const targetDateKey = toLocalDateKey(localDate);
  let lower = localEpoch - 48 * 60 * 60 * 1_000;
  let upper = localEpoch + 48 * 60 * 60 * 1_000;
  while (lower < upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    if (formatLocalDateKey(middle, timeZone) >= targetDateKey) {
      upper = middle;
    } else {
      lower = middle + 1;
    }
  }
  if (formatLocalDateKey(lower, timeZone) !== targetDateKey) {
    throw new GoogleEventMappingError();
  }
  return new Date(lower).toISOString();
}

/** Builds a lexicographically comparable date key from validated local calendar parts. */
function toLocalDateKey(local: ReturnType<typeof parseGoogleDateTime>): string {
  return `${String(local.year).padStart(4, "0")}${String(local.month).padStart(2, "0")}${String(local.day).padStart(2, "0")}`;
}

/** Formats only an instant's local IANA calendar date so the date-boundary binary search is host-timezone independent. */
function formatLocalDateKey(instant: number, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(new Date(instant));
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const year = values.get("year");
    const month = values.get("month");
    const day = values.get("day");
    if (!year || !month || !day) throw new GoogleEventMappingError();
    return `${year.padStart(4, "0")}${month}${day}`;
  } catch (error) {
    if (error instanceof GoogleEventMappingError) throw error;
    throw new GoogleEventMappingError();
  }
}

/** Resolves one offset-less local wall-clock value only when its IANA zone has exactly one matching instant. */
function localDateTimeToInstant(
  local: ReturnType<typeof parseGoogleDateTime>,
  timeZone: string,
): string {
  const localEpoch = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
    local.millisecond,
  );
  const candidates = [...getCandidateOffsets(localEpoch, timeZone)]
    .map((offset) => localEpoch - offset)
    .filter((instant) => matchesLocalDateTime(instant, timeZone, local));
  if (candidates.length !== 1) {
    // Gaps have no instant and overlaps have two; neither can be inferred safely from a wall-clock string alone.
    throw new GoogleEventMappingError();
  }
  return new Date(candidates[0]!).toISOString();
}

/** Samples the bounded timezone-offset neighborhood that can apply to a local date near a DST transition. */
function getCandidateOffsets(localEpoch: number, timeZone: string): ReadonlySet<number> {
  const offsets = new Set<number>();
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    offsets.add(getTimeZoneOffset(localEpoch + hours * 60 * 60 * 1_000, timeZone));
  }
  return offsets;
}

/** Checks whether an instant formats to every local wall-clock component without depending on the Worker host zone. */
function matchesLocalDateTime(
  instant: number,
  timeZone: string,
  expected: ReturnType<typeof parseGoogleDateTime>,
): boolean {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      fractionalSecondDigits: 3,
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(new Date(instant));
    const values = new Map(parts.map((part) => [part.type, part.value]));
    return (
      Number(values.get("year")) === expected.year &&
      Number(values.get("month")) === expected.month &&
      Number(values.get("day")) === expected.day &&
      Number(values.get("hour")) === expected.hour &&
      Number(values.get("minute")) === expected.minute &&
      Number(values.get("second")) === expected.second &&
      Number(values.get("fractionalSecond")) === expected.millisecond
    );
  } catch {
    throw new GoogleEventMappingError();
  }
}

/** Returns the supplied IANA zone's offset at an instant using locale-independent numeric calendar parts. */
function getTimeZoneOffset(instant: number, timeZone: string): number {
  try {
    const wholeSecondInstant = Math.floor(instant / 1_000) * 1_000;
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(new Date(wholeSecondInstant));
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const localMillis = Date.UTC(
      Number(values.get("year")),
      Number(values.get("month")) - 1,
      Number(values.get("day")),
      Number(values.get("hour")),
      Number(values.get("minute")),
      Number(values.get("second")),
    );
    if (!Number.isSafeInteger(localMillis)) throw new GoogleEventMappingError();
    return localMillis - wholeSecondInstant;
  } catch (error) {
    if (error instanceof GoogleEventMappingError) throw error;
    throw new GoogleEventMappingError();
  }
}

/** Copies only attendee email addresses into the protected payload and removes duplicates deterministically. */
function mapAttendees(attendees: readonly z.infer<typeof googleAttendeeSchema>[] | undefined): string[] {
  return [...new Set((attendees ?? []).flatMap((attendee) => attendee.email ? [attendee.email] : []))];
}

/** Copies only call links into protected content, not provider conference metadata. */
function mapMeetingLinks(event: z.infer<typeof googleEventSchema>): string[] {
  const conferenceLinks = event.conferenceData?.entryPoints?.flatMap((entryPoint) => (
    entryPoint.uri ? [entryPoint.uri] : []
  )) ?? [];
  return [...new Set([...(event.hangoutLink ? [event.hangoutLink] : []), ...conferenceLinks])];
}

/** Retains attachment locators but intentionally excludes Google attachment titles and all attachment bytes. */
function mapAttachmentReferences(
  attachments: readonly z.infer<typeof googleAttachmentSchema>[] | undefined,
): Array<{ id: string | null; url: string | null; mimeType: string | null }> {
  return (attachments ?? []).flatMap((attachment) => (
    attachment.fileId || attachment.fileUrl
      ? [{
        id: attachment.fileId ?? null,
        mimeType: attachment.mimeType ?? null,
        url: attachment.fileUrl ?? null,
      }]
      : []
  ));
}

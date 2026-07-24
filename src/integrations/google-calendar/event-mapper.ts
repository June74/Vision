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
    status: z.enum(["cancelled", "confirmed", "tentative"]),
    summary: z.string().max(MAX_PROVIDER_TEXT_LENGTH).optional(),
    timeZone: z.string().trim().min(1).max(255).optional(),
    transparency: z.enum(["opaque", "transparent"]).optional(),
    updated: z.string().max(255),
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
  const timeZone = readTimeZone(event);
  const identity = {
    sourceCalendarId: event.calendarId,
    sourceEventId: event.id,
    sourceSystem: "google-calendar",
    sourceVersion: toProviderOrderKey(event.updated),
  } as const;
  const recurrence = mapRecurrence(event, timeZone);

  if (event.status === "cancelled") {
    return ProviderEventChangeSchema.parse({ type: "delete", identity, recurrence });
  }

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
    status: event.status,
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
    const milliseconds = Date.parse(value.dateTime);
    if (!Number.isSafeInteger(milliseconds)) throw new GoogleEventMappingError();
    return new Date(milliseconds).toISOString();
  }
  if (value.date) return localDateStartToInstant(value.date, value.timeZone ?? timeZone);
  throw new GoogleEventMappingError();
}

/** Converts an all-day local calendar date into its UTC midnight instant without assuming the host timezone. */
function localDateStartToInstant(date: string, timeZone: string): string {
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const localEpoch = Date.UTC(year, month - 1, day);
  if (
    !Number.isSafeInteger(localEpoch) ||
    new Date(localEpoch).getUTCFullYear() !== year ||
    new Date(localEpoch).getUTCMonth() !== month - 1 ||
    new Date(localEpoch).getUTCDate() !== day
  ) {
    throw new GoogleEventMappingError();
  }
  const firstOffset = getTimeZoneOffset(localEpoch, timeZone);
  const candidate = localEpoch - firstOffset;
  const finalOffset = getTimeZoneOffset(candidate, timeZone);
  return new Date(localEpoch - finalOffset).toISOString();
}

/** Returns the supplied IANA zone's offset at an instant using locale-independent numeric calendar parts. */
function getTimeZoneOffset(instant: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(new Date(instant));
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
    return localMillis - instant;
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

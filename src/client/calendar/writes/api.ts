/** Defines the browser's safe, credential-free contract with Phase C write routes. */
import type { BrowserSession } from "../../setup/api";

export type CalendarWriteStatus =
  | "proposed"
  | "confirmed"
  | "writing"
  | "verification_pending"
  | "verified"
  | "failed"
  | "undone"
  | "invalidated";

export type CalendarWriteDomain = "school" | "work" | "personal";
export type CalendarWritePrivacy = "planning" | "private" | "restricted";

/** The only editable fields accepted by the one-off preview route. */
export interface OneOffEventDraft {
  readonly title: string;
  readonly description: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
  readonly domain: CalendarWriteDomain;
  readonly privacy: CalendarWritePrivacy;
}

/** Immutable provider-neutral facts shown before confirmation. */
export interface CalendarWritePreview {
  readonly before: null;
  readonly after: {
    readonly title: string;
    readonly description: string | null;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly timeZone: string;
    readonly domain: CalendarWriteDomain;
    readonly privacy: CalendarWritePrivacy;
    readonly attendees: {
      readonly mode: "none";
      readonly count: 0;
      readonly addresses: readonly [];
    };
    readonly recurrence: {
      readonly scope: "one-off";
      readonly rules: readonly [];
    };
    readonly notifications: {
      readonly policy: "none";
      readonly willNotify: false;
    };
  };
}

export interface CalendarWriteResponse {
  readonly operationId: string;
  readonly status?: CalendarWriteStatus;
  readonly expiresAt?: string;
  readonly preview?: CalendarWritePreview;
  readonly undoAvailable: boolean;
}

/** Keeps safe server error metadata without exposing provider response details. */
export class CalendarWriteApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined) {
    super("Calendar write request was not accepted.");
    this.name = "CalendarWriteApiError";
    this.status = status;
    this.code = code;
  }
}

/** Creates the encrypted-at-rest approval proposal without accepting server authority fields. */
export async function previewOneOffEvent(
  session: BrowserSession,
  draft: OneOffEventDraft,
): Promise<CalendarWriteResponse> {
  return readWriteResponse(await fetch("/api/calendar/writes/preview", {
    body: JSON.stringify({
      ...draft,
      attendees: [],
      recurrence: null,
      notifications: "none",
    }),
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "x-vision-csrf": session.csrfToken,
    },
    method: "POST",
  }));
}

/** Confirms only the server-retained proposal identified by the opaque operation ID. */
export async function confirmOneOffEvent(
  session: BrowserSession,
  operationId: string,
): Promise<CalendarWriteResponse> {
  return readWriteResponse(await fetch(
    `/api/calendar/writes/${encodeURIComponent(operationId)}/confirm`,
    {
      body: JSON.stringify({ confirmation: "CONFIRM ONE-OFF EVENT" }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-vision-csrf": session.csrfToken,
      },
      method: "POST",
    },
  ));
}

/** Reads authoritative owner-scoped operation state after reload or uncertainty. */
export async function readOneOffEventStatus(
  operationId: string,
): Promise<CalendarWriteResponse> {
  return readWriteResponse(await fetch(
    `/api/calendar/writes/${encodeURIComponent(operationId)}`,
    { credentials: "same-origin" },
  ));
}

/** Requests the server-owned, version-guarded compensating undo. */
export async function undoOneOffEvent(
  session: BrowserSession,
  operationId: string,
): Promise<CalendarWriteResponse> {
  return readWriteResponse(await fetch(
    `/api/calendar/writes/${encodeURIComponent(operationId)}/undo`,
    {
      body: JSON.stringify({ confirmation: "UNDO ONE-OFF EVENT" }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-vision-csrf": session.csrfToken,
      },
      method: "POST",
    },
  ));
}

/** Parses only the bounded public response shape and maps failures to a safe client error. */
async function readWriteResponse(response: Response): Promise<CalendarWriteResponse> {
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const record = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
    throw new CalendarWriteApiError(
      response.status,
      record && typeof record.code === "string" ? record.code : undefined,
    );
  }
  if (!isCalendarWriteResponse(payload)) {
    throw new CalendarWriteApiError(response.status, "INVALID_CALENDAR_WRITE_RESPONSE");
  }
  return payload;
}

/** Accepts the exact preview and status fields rendered by the composer. */
function isCalendarWriteResponse(value: unknown): value is CalendarWriteResponse {
  if (!isRecord(value) || !isBoundedIdentity(value.operationId) || typeof value.undoAvailable !== "boolean") {
    return false;
  }
  if (value.status !== undefined && !isOneOf(value.status, [
    "proposed",
    "confirmed",
    "writing",
    "verification_pending",
    "verified",
    "failed",
    "undone",
    "invalidated",
  ])) {
    return false;
  }
  if (value.expiresAt !== undefined && typeof value.expiresAt !== "string") return false;
  return value.preview === undefined || isCalendarWritePreview(value.preview);
}

function isCalendarWritePreview(value: unknown): value is CalendarWritePreview {
  if (!isRecord(value) || value.before !== null || !isRecord(value.after)) return false;
  const after = value.after;
  const attendees = isRecord(after.attendees) ? after.attendees : undefined;
  const recurrence = isRecord(after.recurrence) ? after.recurrence : undefined;
  const notifications = isRecord(after.notifications) ? after.notifications : undefined;
  return typeof after.title === "string" &&
    (after.description === null || typeof after.description === "string") &&
    typeof after.startsAt === "string" &&
    typeof after.endsAt === "string" &&
    typeof after.timeZone === "string" &&
    isOneOf(after.domain, ["school", "work", "personal"]) &&
    isOneOf(after.privacy, ["planning", "private", "restricted"]) &&
    attendees?.mode === "none" &&
    attendees.count === 0 &&
    Array.isArray(attendees.addresses) &&
    attendees.addresses.length === 0 &&
    recurrence?.scope === "one-off" &&
    Array.isArray(recurrence.rules) &&
    recurrence.rules.length === 0 &&
    notifications?.policy === "none" &&
    notifications.willNotify === false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedIdentity(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && !/[\u0000-\u001F\u007F]/u.test(value);
}

function isOneOf<const Value extends string>(
  value: unknown,
  allowed: readonly Value[],
): value is Value {
  return typeof value === "string" && allowed.includes(value as Value);
}

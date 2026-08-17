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

export type CalendarMutationAction = "update" | "move" | "cancel" | "delete";

/** The only browser-supplied fields accepted by the server-derived mutation preview. */
export interface CalendarMutationEventPatch {
  readonly title?: string;
  readonly description?: string | null;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly timeZone?: string;
  readonly domain?: CalendarWriteDomain;
  readonly privacy?: CalendarWritePrivacy;
  readonly status?: "confirmed" | "tentative" | "cancelled";
  readonly attendees?: readonly string[];
  readonly recurrence?: {
    readonly scope: "occurrence" | "series";
    readonly rules: readonly string[];
  } | null;
  readonly notifications?: "none" | "provider-default";
}

/** Immutable before/after event facts returned by the mutation preview. */
export interface CalendarMutationEvent {
  readonly title: string;
  readonly description: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
  readonly domain: CalendarWriteDomain;
  readonly privacy: CalendarWritePrivacy;
  readonly status: "confirmed" | "tentative" | "cancelled";
  readonly attendees: {
    readonly mode: "none" | "count";
    readonly count: number;
    readonly addresses: readonly [];
  };
  readonly recurrence: {
    readonly scope: "one-off" | "occurrence" | "series";
    readonly rules: readonly string[];
  };
  readonly notifications: {
    readonly policy: "none" | "provider-default";
    readonly willNotify: boolean;
  };
}

export interface CalendarMutationPreview {
  readonly before: CalendarMutationEvent;
  readonly after: CalendarMutationEvent | null;
}

export interface CalendarMutationResponse {
  readonly operationId: string;
  readonly action: CalendarMutationAction;
  readonly status?: CalendarWriteStatus;
  readonly expiresAt?: string;
  readonly preview?: CalendarMutationPreview;
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

/** Creates a server-derived, owner-scoped before/after mutation proposal. */
export async function previewCalendarEventMutation(
  session: BrowserSession,
  input: {
    readonly action: CalendarMutationAction;
    readonly eventId: string;
    readonly scope?: "single" | "series";
    readonly after: CalendarMutationEventPatch | null;
  },
): Promise<CalendarMutationResponse> {
  return readMutationResponse(await fetch("/api/calendar/mutations/preview", {
    body: JSON.stringify(input),
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "x-vision-csrf": session.csrfToken,
    },
    method: "POST",
  }));
}

/** Confirms a retained mutation with the exact action-specific phrase. */
export async function confirmCalendarEventMutation(
  session: BrowserSession,
  operationId: string,
  action: CalendarMutationAction,
): Promise<CalendarMutationResponse> {
  return readMutationResponse(await fetch(
    `/api/calendar/mutations/${encodeURIComponent(operationId)}/confirm`,
    {
      body: JSON.stringify({ confirmation: mutationConfirmationPhrase(action) }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-vision-csrf": session.csrfToken,
      },
      method: "POST",
    },
  ));
}

/** Reads an owner-scoped mutation after reload or provider uncertainty. */
export async function readCalendarEventMutationStatus(
  operationId: string,
): Promise<CalendarMutationResponse> {
  return readMutationResponse(await fetch(
    `/api/calendar/mutations/${encodeURIComponent(operationId)}`,
    { credentials: "same-origin" },
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

/** Parses only the bounded public mutation response shape. */
async function readMutationResponse(response: Response): Promise<CalendarMutationResponse> {
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const record = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
    throw new CalendarWriteApiError(
      response.status,
      record && typeof record.code === "string" ? record.code : undefined,
    );
  }
  if (!isCalendarMutationResponse(payload)) {
    throw new CalendarWriteApiError(response.status, "INVALID_CALENDAR_MUTATION_RESPONSE");
  }
  return payload;
}

/** Accepts the exact preview and status fields rendered by the composer. */
function isCalendarWriteResponse(value: unknown): value is CalendarWriteResponse {
  if (!isRecord(value) || !isBoundedIdentity(value.operationId) || typeof value.undoAvailable !== "boolean") {
    return false;
  }
  if (value.status !== undefined && !isCalendarWriteStatus(value.status)) return false;
  if (value.expiresAt !== undefined && typeof value.expiresAt !== "string") return false;
  return value.preview === undefined || isCalendarWritePreview(value.preview);
}

/** Validates a mutation response without accepting provider-only identity fields. */
function isCalendarMutationResponse(value: unknown): value is CalendarMutationResponse {
  if (!isRecord(value) ||
      !isBoundedIdentity(value.operationId) ||
      !isOneOf(value.action, ["update", "move", "cancel", "delete"]) ||
      typeof value.undoAvailable !== "boolean") {
    return false;
  }
  if (value.status !== undefined && !isCalendarWriteStatus(value.status)) return false;
  if (value.expiresAt !== undefined && typeof value.expiresAt !== "string") return false;
  return value.preview === undefined || isCalendarMutationPreview(value.preview);
}

/** Validates the immutable before/after mutation facts rendered by the controls. */
function isCalendarMutationPreview(value: unknown): value is CalendarMutationPreview {
  return isRecord(value) &&
    isCalendarMutationEvent(value.before) &&
    (value.after === null || isCalendarMutationEvent(value.after));
}

/** Validates the exact provider-neutral event descriptor shape. */
function isCalendarMutationEvent(value: unknown): value is CalendarMutationEvent {
  if (!isRecord(value)) return false;
  const attendees = isRecord(value.attendees) ? value.attendees : undefined;
  const recurrence = isRecord(value.recurrence) ? value.recurrence : undefined;
  const notifications = isRecord(value.notifications) ? value.notifications : undefined;
  return typeof value.title === "string" &&
    (value.description === null || typeof value.description === "string") &&
    typeof value.startsAt === "string" &&
    typeof value.endsAt === "string" &&
    typeof value.timeZone === "string" &&
    isOneOf(value.domain, ["school", "work", "personal"]) &&
    isOneOf(value.privacy, ["planning", "private", "restricted"]) &&
    isOneOf(value.status, ["confirmed", "tentative", "cancelled"]) &&
    (attendees?.mode === "none" || attendees?.mode === "count") &&
    typeof attendees.count === "number" &&
    Number.isSafeInteger(attendees.count) &&
    attendees.count >= 0 &&
    attendees.mode === (attendees.count === 0 ? "none" : "count") &&
    Array.isArray(attendees.addresses) &&
    attendees.addresses.length === 0 &&
    isOneOf(recurrence?.scope, ["one-off", "occurrence", "series"]) &&
    Array.isArray(recurrence.rules) &&
    recurrence.rules.length <= 20 &&
    recurrence.rules.every((rule) => typeof rule === "string" && rule.length > 0 && rule.length <= 1_024) &&
    isOneOf(notifications?.policy, ["none", "provider-default"]) &&
    notifications.willNotify === (notifications.policy !== "none");
}

/** Keeps status parsing identical across create and mutation browser responses. */
function isCalendarWriteStatus(value: unknown): value is CalendarWriteStatus {
  return isOneOf(value, [
    "proposed",
    "confirmed",
    "writing",
    "verification_pending",
    "verified",
    "failed",
    "undone",
    "invalidated",
  ]);
}

/** Returns the exact phrase the server requires for one mutation action. */
function mutationConfirmationPhrase(action: CalendarMutationAction): string {
  if (action === "update") return "CONFIRM EVENT UPDATE";
  if (action === "move") return "CONFIRM EVENT MOVE";
  if (action === "cancel") return "CONFIRM EVENT CANCELLATION";
  return "CONFIRM EVENT DELETE";
}

/** Validates the immutable preview fields that are safe for the browser to render. */
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

/** Narrows untrusted JSON to a plain property bag before allowlist checks. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Accepts only bounded opaque operation identities from the server. */
function isBoundedIdentity(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && !/[\u0000-\u001F\u007F]/u.test(value);
}

/** Tests an untrusted value against one immutable public string allowlist. */
function isOneOf<const Value extends string>(
  value: unknown,
  allowed: readonly Value[],
): value is Value {
  return typeof value === "string" && allowed.includes(value as Value);
}

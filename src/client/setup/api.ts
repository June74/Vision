/** Defines the browser's safe, credential-free contract with Vision setup routes. */

/** One currently authenticated private-pilot session exposed by the safe session route. */
export interface BrowserSession {
  readonly csrfToken: string;
  readonly email: string;
}

/** A selectable secondary calendar returned by safe discovery. */
export interface CalendarCandidate {
  readonly calendarId: string;
  readonly providerEtag: string;
  readonly summary: string;
  readonly timeZone: string;
}

/** The verified connection reported once a calendar is attached to Vision. */
export interface CalendarConnection {
  readonly calendarId: string;
  readonly connectionKind: "created" | "existing";
  readonly providerEtag: string;
  readonly timeZone: string;
  readonly verifiedAt: string;
}

/** A versioned public setup state from the calendar setup API. */
export interface CalendarSetupSnapshot {
  readonly actionRequired: boolean;
  readonly candidates: readonly CalendarCandidate[];
  readonly connection?: CalendarConnection;
  readonly retryable?: boolean;
  readonly setupVersion: number;
  readonly status: string;
}

/** The small set of session outcomes that can safely alter the browser shell. */
export type SessionResult =
  | { readonly kind: "authenticated"; readonly session: BrowserSession }
  | { readonly kind: "access_denied" }
  | { readonly kind: "signed_out" }
  | { readonly kind: "unavailable" };

/** Reads the current server session without receiving any provider token. */
export async function readSession(): Promise<SessionResult> {
  const response = await fetch("/api/auth/session", { credentials: "same-origin" }).catch(() => undefined);
  if (!response) return { kind: "unavailable" };
  if (response.status === 401) return { kind: "signed_out" };
  if (response.status === 403) return { kind: "access_denied" };
  if (!response.ok) return { kind: "unavailable" };
  const payload = (await response.json()) as Partial<BrowserSession>;
  return typeof payload.csrfToken === "string" && typeof payload.email === "string"
    ? { kind: "authenticated", session: { csrfToken: payload.csrfToken, email: payload.email } }
    : { kind: "unavailable" };
}

/** Reads the authoritative versioned setup snapshot for an authenticated session. */
export async function readCalendarSetup(): Promise<CalendarSetupSnapshot> {
  return readSetupResponse(await fetch("/api/setup/calendar", { credentials: "same-origin" }));
}

/** Requests a fresh owned-calendar discovery using the supplied server version. */
export async function discoverCalendars(
  session: BrowserSession,
  setupVersion: number,
): Promise<CalendarSetupSnapshot> {
  return sendSetupCommand("/api/setup/calendar/discover", session, { setupVersion });
}

/** Verifies and connects one explicitly selected owned secondary calendar. */
export async function selectCalendar(
  session: BrowserSession,
  setupVersion: number,
  calendarId: string,
): Promise<CalendarSetupSnapshot> {
  return sendSetupCommand("/api/setup/calendar/select", session, { calendarId, setupVersion });
}

/** Sends one exactly-confirmed creation command with the caller's replay key. */
export async function confirmCalendarCreation(
  session: BrowserSession,
  setupVersion: number,
  idempotencyKey: string,
): Promise<CalendarSetupSnapshot> {
  return sendSetupCommand("/api/setup/calendar/confirm-create", session, {
    confirmation: "CREATE VISION CALENDAR",
    idempotencyKey,
    setupVersion,
  });
}

/** Performs one CSRF-protected setup mutation without retaining any response beyond its safe snapshot. */
async function sendSetupCommand(
  path: string,
  session: BrowserSession,
  body: Record<string, unknown>,
): Promise<CalendarSetupSnapshot> {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-vision-csrf": session.csrfToken },
    method: "POST",
  });
  return readSetupResponse(response);
}

/** Parses a safe setup response, including expected conflict and in-progress outcomes. */
async function readSetupResponse(response: Response): Promise<CalendarSetupSnapshot> {
  const payload = (await response.json().catch(() => undefined)) as Partial<CalendarSetupSnapshot> | undefined;
  if (payload && typeof payload.setupVersion === "number" && typeof payload.status === "string") {
    return {
      actionRequired: payload.actionRequired === true,
      candidates: Array.isArray(payload.candidates) ? payload.candidates as CalendarCandidate[] : [],
      connection: payload.connection as CalendarConnection | undefined,
      retryable: payload.retryable,
      setupVersion: payload.setupVersion,
      status: payload.status,
    };
  }
  throw new Error(response.ok ? "Calendar setup returned an invalid response." : "Calendar setup is temporarily unavailable.");
}

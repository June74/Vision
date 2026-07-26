/** Defines the browser's allowlisted, credential-free foundation diagnostic contract. */
import type { BrowserSession } from "../setup/api";

/** One synchronized event whose protected title was authorized by the server. */
export interface FoundationEvent {
  readonly id: string;
  readonly title: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
  readonly status: "confirmed" | "tentative" | "cancelled";
  readonly domain: "school" | "work" | "personal" | "unresolved";
  readonly domainState: "confirmed" | "inferred" | "unresolved";
  readonly categoryProvenance: "provider" | "user" | "system" | "model";
}

/** Safe operational facts used by the foundation signal and cost status. */
export interface FoundationStatusSnapshot {
  readonly state: "Healthy" | "Delayed" | "Action required" | "Disconnected";
  readonly authorizationState: "connected" | "missing" | "revoked";
  readonly lastSuccessfulSyncAt: string | null;
  readonly syncDelayMs: number | null;
  readonly oldestQueuedJobAt: string | null;
  readonly oldestJobDelayMs: number | null;
  readonly queueRetryCount: number;
  readonly failedJobCount: number;
  readonly channelExpiresAt: string | null;
  readonly aiSpendTier: "normal" | "warning" | "optional_stopped" | "stopped";
  readonly aiMonthlyCents: number;
  readonly databaseUsageWarning: boolean;
  readonly r2UsageWarning: boolean;
  readonly safeErrorCode: string | null;
  readonly warningCodes: readonly string[];
}

/** The two independent safe reads required by the authenticated calendar desk. */
export interface FoundationSnapshot {
  readonly events: readonly FoundationEvent[];
  readonly status: FoundationStatusSnapshot;
}

/** An explicit category accepted by Vision without changing Google Calendar. */
export interface CategoryCorrection {
  readonly id: string;
  readonly domain: "school" | "work" | "personal";
  readonly domainState: "confirmed";
  readonly categoryProvenance: "user";
  readonly assignedAt: string;
  readonly version: number;
}

/** Reads status and events concurrently, then validates both allowlisted response shapes. */
export async function readFoundationSnapshot(): Promise<FoundationSnapshot> {
  const [statusResult, eventsResult] = await Promise.allSettled([
    fetch("/api/diagnostics/status", { credentials: "same-origin" }),
    fetch("/api/calendar/events", { credentials: "same-origin" }),
  ]);
  if (
    statusResult.status !== "fulfilled" ||
    eventsResult.status !== "fulfilled" ||
    !statusResult.value.ok ||
    !eventsResult.value.ok
  ) {
    throw new Error("Foundation diagnostics are temporarily unavailable.");
  }
  const [statusPayload, eventPayload] = await Promise.all([
    statusResult.value.json().catch(() => undefined),
    eventsResult.value.json().catch(() => undefined),
  ]);
  return {
    status: parseStatus(statusPayload),
    events: parseEvents(eventPayload),
  };
}

/** Sends one CSRF-protected Vision-only category correction and validates its result. */
export async function correctEventCategory(
  session: BrowserSession,
  eventId: string,
  domain: "school" | "work" | "personal",
): Promise<CategoryCorrection> {
  const response = await fetch(
    `/api/calendar/events/${encodeURIComponent(eventId)}/category`,
    {
      body: JSON.stringify({ domain }),
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-vision-csrf": session.csrfToken,
      },
      method: "PATCH",
    },
  );
  if (!response.ok) throw new Error("Category correction was not accepted.");
  return parseCorrection(await response.json().catch(() => undefined));
}

/** Accepts only the exact status values rendered by the operational rail. */
function parseStatus(value: unknown): FoundationStatusSnapshot {
  const status = isRecord(value) && isRecord(value.status) ? value.status : undefined;
  if (
    !status ||
    !isOneOf(status.state, ["Healthy", "Delayed", "Action required", "Disconnected"]) ||
    !isOneOf(status.authorizationState, ["connected", "missing", "revoked"]) ||
    !isNullableString(status.lastSuccessfulSyncAt) ||
    !isNullableNonnegativeNumber(status.syncDelayMs) ||
    !isNullableString(status.oldestQueuedJobAt) ||
    !isNullableNonnegativeNumber(status.oldestJobDelayMs) ||
    !isNonnegativeInteger(status.queueRetryCount) ||
    !isNonnegativeInteger(status.failedJobCount) ||
    !isNullableString(status.channelExpiresAt) ||
    !isOneOf(status.aiSpendTier, ["normal", "warning", "optional_stopped", "stopped"]) ||
    !isNonnegativeInteger(status.aiMonthlyCents) ||
    typeof status.databaseUsageWarning !== "boolean" ||
    typeof status.r2UsageWarning !== "boolean" ||
    !isNullableString(status.safeErrorCode) ||
    !Array.isArray(status.warningCodes) ||
    !status.warningCodes.every((code) => typeof code === "string")
  ) {
    throw new Error("Foundation status returned an invalid response.");
  }
  return status as unknown as FoundationStatusSnapshot;
}

/** Accepts a bounded array containing only server-approved event display fields. */
function parseEvents(value: unknown): readonly FoundationEvent[] {
  const events = isRecord(value) && Array.isArray(value.events) ? value.events : undefined;
  if (!events || events.length > 200 || !events.every(isFoundationEvent)) {
    throw new Error("Calendar events returned an invalid response.");
  }
  return events;
}

/** Validates one synchronized event without accepting provider payload additions. */
function isFoundationEvent(value: unknown): value is FoundationEvent {
  return isRecord(value) &&
    typeof value.id === "string" &&
    isNullableString(value.title) &&
    typeof value.startsAt === "string" &&
    typeof value.endsAt === "string" &&
    typeof value.timeZone === "string" &&
    isOneOf(value.status, ["confirmed", "tentative", "cancelled"]) &&
    isOneOf(value.domain, ["school", "work", "personal", "unresolved"]) &&
    isOneOf(value.domainState, ["confirmed", "inferred", "unresolved"]) &&
    isOneOf(value.categoryProvenance, ["provider", "user", "system", "model"]);
}

/** Validates the minimal result used to replace category presentation state. */
function parseCorrection(value: unknown): CategoryCorrection {
  const correction = isRecord(value) && isRecord(value.category) ? value.category : undefined;
  if (
    !correction ||
    typeof correction.id !== "string" ||
    !isOneOf(correction.domain, ["school", "work", "personal"]) ||
    correction.domainState !== "confirmed" ||
    correction.categoryProvenance !== "user" ||
    typeof correction.assignedAt !== "string" ||
    !isNonnegativeInteger(correction.version)
  ) {
    throw new Error("Category correction returned an invalid response.");
  }
  return correction as unknown as CategoryCorrection;
}

/** Narrows untrusted JSON to a property bag before allowlist checks. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Tests an unknown value against one immutable string allowlist. */
function isOneOf<const Value extends string>(
  value: unknown,
  allowed: readonly Value[],
): value is Value {
  return typeof value === "string" && allowed.includes(value as Value);
}

/** Accepts either a string or the API's explicit absent marker. */
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/** Accepts finite, nonnegative measurements or an explicit absent marker. */
function isNullableNonnegativeNumber(value: unknown): value is number | null {
  return value === null ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

/** Accepts counts and cents without silent fractional coercion. */
function isNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

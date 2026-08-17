/** Defines the browser-safe local secretary API contract and CSRF-protected writes. */
import type { BrowserSession } from "../setup/api";

export type SecretaryCaptureKind = "task" | "note" | "calendar_candidate" | "ambiguous";

export interface SecretaryCalendarProposalMarker {
  readonly action: "create";
  readonly status: "pending_approval";
  readonly requiresExplicitApproval: true;
  readonly canConfirm: false;
}

export interface SecretaryCapture {
  readonly id: string;
  readonly content: string;
  readonly title: string | null;
  readonly kind: SecretaryCaptureKind;
  readonly ambiguity: "none" | "needs_clarification";
  readonly createdAt: string;
  readonly calendarProposal: SecretaryCalendarProposalMarker | null;
}

export interface SecretaryTask {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly timeZone: string;
  readonly status: "open" | "completed";
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export interface SecretaryNote {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: "active";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SecretaryTodayEvent {
  readonly id: string;
  readonly title: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
  readonly status: "confirmed" | "tentative" | "cancelled";
  readonly readOnly: true;
  readonly canWrite: false;
}

export interface SecretaryToday {
  readonly dateKey: string;
  readonly calendarWriteAuthority: "approval-required";
  readonly tasks: readonly SecretaryTask[];
  readonly events: readonly SecretaryTodayEvent[];
  readonly captures: readonly SecretaryCapture[];
  readonly notes: readonly SecretaryNote[];
}

/** Reads local Today with an explicit browser timezone and no provider write authority. */
export async function readSecretaryToday(timeZone: string): Promise<SecretaryToday> {
  const response = await fetch(`/api/secretary/today?timeZone=${encodeURIComponent(timeZone)}`, {
    credentials: "same-origin",
  });
  return readPayload(response, parseToday);
}

/** Stores one local capture; a calendar candidate remains pending approval. */
export async function createSecretaryCapture(
  session: BrowserSession,
  content: string,
): Promise<SecretaryCapture> {
  const response = await fetch("/api/secretary/captures", {
    body: JSON.stringify({ content }),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-vision-csrf": session.csrfToken },
    method: "POST",
  });
  return readPayload(response, parseCaptureEnvelope);
}

/** Creates one local task without creating a calendar event. */
export async function createSecretaryTask(
  session: BrowserSession,
  input: { readonly title: string; readonly dueAt: string | null; readonly timeZone: string },
): Promise<SecretaryTask> {
  const response = await fetch("/api/secretary/tasks", {
    body: JSON.stringify(input),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-vision-csrf": session.csrfToken },
    method: "POST",
  });
  return readPayload(response, parseTaskEnvelope);
}

/** Completes or reopens one owner-scoped local task through a CSRF-protected route. */
export async function transitionSecretaryTask(
  session: BrowserSession,
  taskId: string,
  action: "complete" | "undo",
): Promise<SecretaryTask> {
  const response = await fetch(`/api/secretary/tasks/${encodeURIComponent(taskId)}/${action}`, {
    body: "{}",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-vision-csrf": session.csrfToken },
    method: "POST",
  });
  return readPayload(response, parseTaskEnvelope);
}

/** Stores a protected local note and never sends a calendar operation handle. */
export async function createSecretaryNote(
  session: BrowserSession,
  input: { readonly title: string; readonly body: string },
): Promise<SecretaryNote> {
  const response = await fetch("/api/secretary/notes", {
    body: JSON.stringify(input),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-vision-csrf": session.csrfToken },
    method: "POST",
  });
  return readPayload(response, parseNoteEnvelope);
}

/** Converts HTTP and malformed payloads into one safe browser error. */
async function readPayload<T>(response: Response, parser: (value: unknown) => T): Promise<T> {
  if (!response.ok) throw new Error("Local secretary request was not accepted.");
  return parser(await response.json().catch(() => undefined));
}

/** Parses the Today envelope. */
function parseToday(value: unknown): SecretaryToday {
  const today = isRecord(value) && isRecord(value.today) ? value.today : undefined;
  if (
    !today ||
    typeof today.dateKey !== "string" ||
    today.calendarWriteAuthority !== "approval-required" ||
    !Array.isArray(today.tasks) || !today.tasks.every(isTask) ||
    !Array.isArray(today.events) || !today.events.every(isEvent) ||
    !Array.isArray(today.captures) || !today.captures.every(isCapture) ||
    !Array.isArray(today.notes) || !today.notes.every(isNote)
  ) throw new Error("Local secretary returned an invalid Today response.");
  return today as unknown as SecretaryToday;
}

/** Parses the capture response envelope. */
function parseCaptureEnvelope(value: unknown): SecretaryCapture {
  const capture = isRecord(value) ? value.capture : undefined;
  if (!isCapture(capture)) throw new Error("Local secretary returned an invalid capture.");
  return capture;
}

/** Parses the task response envelope. */
function parseTaskEnvelope(value: unknown): SecretaryTask {
  const task = isRecord(value) ? value.task : undefined;
  if (!isTask(task)) throw new Error("Local secretary returned an invalid task.");
  return task;
}

/** Parses the note response envelope. */
function parseNoteEnvelope(value: unknown): SecretaryNote {
  const note = isRecord(value) ? value.note : undefined;
  if (!isNote(note)) throw new Error("Local secretary returned an invalid note.");
  return note;
}

/** Validates the bounded capture descriptor before rendering it. */
function isCapture(value: unknown): value is SecretaryCapture {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.content !== "string" ||
      (value.title !== null && typeof value.title !== "string") ||
      !isOneOf(value.kind, ["task", "note", "calendar_candidate", "ambiguous"]) ||
      !isOneOf(value.ambiguity, ["none", "needs_clarification"]) ||
      typeof value.createdAt !== "string") return false;
  if (value.calendarProposal === null) return value.kind !== "calendar_candidate";
  return value.kind === "calendar_candidate" && isCalendarProposal(value.calendarProposal);
}

/** Validates a pending calendar marker without accepting a confirm authority. */
function isCalendarProposal(value: unknown): value is SecretaryCalendarProposalMarker {
  return isRecord(value) && value.action === "create" && value.status === "pending_approval" &&
    value.requiresExplicitApproval === true && value.canConfirm === false;
}

/** Validates one task response. */
function isTask(value: unknown): value is SecretaryTask {
  return isRecord(value) && typeof value.id === "string" && typeof value.title === "string" &&
    (value.dueAt === null || typeof value.dueAt === "string") && typeof value.timeZone === "string" &&
    isOneOf(value.status, ["open", "completed"]) && typeof value.createdAt === "string" &&
    (value.completedAt === null || typeof value.completedAt === "string");
}

/** Validates one note response. */
function isNote(value: unknown): value is SecretaryNote {
  return isRecord(value) && typeof value.id === "string" && typeof value.title === "string" &&
    typeof value.body === "string" && value.status === "active" &&
    typeof value.createdAt === "string" && typeof value.updatedAt === "string";
}

/** Validates one read-only calendar event. */
function isEvent(value: unknown): value is SecretaryTodayEvent {
  return isRecord(value) && typeof value.id === "string" &&
    (value.title === null || typeof value.title === "string") &&
    typeof value.startsAt === "string" && typeof value.endsAt === "string" &&
    typeof value.timeZone === "string" && isOneOf(value.status, ["confirmed", "tentative", "cancelled"]) &&
    value.readOnly === true && value.canWrite === false;
}

/** Narrows unknown JSON to a non-array record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks one finite public string union. */
function isOneOf<const Value extends string>(value: unknown, allowed: readonly Value[]): value is Value {
  return typeof value === "string" && allowed.includes(value as Value);
}

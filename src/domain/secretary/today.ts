/** Builds a deterministic local Today projection without granting calendar write authority. */
import type { SecretaryCapture } from "./capture";
import type { SecretaryNote } from "./note";
import type { SecretaryTask } from "./task";

/** Minimal read-only calendar event facts allowed into the local Today projection. */
export interface SecretaryTodayEventInput {
  readonly id: string;
  readonly title: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
  readonly status: "confirmed" | "tentative" | "cancelled";
}

/** Calendar event after the local projection adds an explicit no-write boundary. */
export interface SecretaryTodayEvent extends SecretaryTodayEventInput {
  readonly readOnly: true;
  readonly canWrite: false;
}

/** Owner-visible local Today projection. */
export interface SecretaryTodayProjection {
  readonly dateKey: string;
  readonly calendarWriteAuthority: "approval-required";
  readonly tasks: readonly SecretaryTask[];
  readonly events: readonly SecretaryTodayEvent[];
  readonly captures: readonly SecretaryCapture[];
  readonly notes: readonly SecretaryNote[];
}

/** Builds the date-scoped projection using each task/event's explicit timezone metadata. */
export function buildTodayProjection(input: {
  readonly now: Date;
  readonly timeZone: string;
  readonly tasks: readonly SecretaryTask[];
  readonly events: readonly SecretaryTodayEventInput[];
  readonly captures: readonly SecretaryCapture[];
  readonly notes: readonly SecretaryNote[];
}): SecretaryTodayProjection {
  assertDate(input.now);
  assertTimeZone(input.timeZone);
  const dateKey = localDateKey(input.now, input.timeZone);
  const tasks = input.tasks
    .filter((task) => task.status === "open" && task.dueAt !== null && localDateKey(new Date(task.dueAt), task.timeZone) === dateKey)
    .slice()
    .sort((left, right) => (Date.parse(left.dueAt ?? "") - Date.parse(right.dueAt ?? "")) || left.id.localeCompare(right.id));
  const events = input.events
    .filter((event) => localDateKey(new Date(event.startsAt), input.timeZone) === dateKey)
    .slice()
    .sort((left, right) => (Date.parse(left.startsAt) - Date.parse(right.startsAt)) || left.id.localeCompare(right.id))
    .map((event) => ({ ...event, readOnly: true as const, canWrite: false as const }));
  return {
    dateKey,
    calendarWriteAuthority: "approval-required",
    tasks,
    events,
    captures: input.captures.slice().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    notes: input.notes.slice().sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
  };
}

/** Produces a stable YYYY-MM-DD key in the supplied IANA timezone. */
export function localDateKey(value: Date, timeZone: string): string {
  assertDate(value);
  assertTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Today timezone is invalid.");
  return `${year}-${month}-${day}`;
}

/** Rejects invalid dates without coercion. */
function assertDate(value: unknown): asserts value is Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error("Today date is invalid.");
}

/** Rejects invalid IANA zones rather than using the process default. */
function assertTimeZone(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 255) throw new Error("Today timezone is invalid.");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
  } catch {
    throw new Error("Today timezone is invalid.");
  }
}

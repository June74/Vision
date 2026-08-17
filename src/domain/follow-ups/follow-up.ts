/** Defines the owner-local follow-up lifecycle used by deterministic planning. */
import { z } from "zod";

const identifier = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const timestamp = z.string().datetime({ offset: true });

const followUpInputSchema = z.object({
  id: identifier,
  title: z.string().trim().min(1).max(1_024),
  dueAt: timestamp.nullable(),
  timeZone: z.string().min(1).max(255),
  sourceFactIds: z.array(identifier).max(32),
  createdAt: z.union([timestamp, z.date()]),
}).strict();

/** Owner-local follow-up lifecycle states. */
export type FollowUpStatus = "open" | "snoozed" | "completed";

/** Local follow-up record with only source identifiers and no calendar operation authority. */
export interface FollowUp {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly timeZone: string;
  readonly sourceFactIds: readonly string[];
  readonly status: FollowUpStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly snoozedUntil: string | null;
  readonly completedAt: string | null;
}

/** Safe domain failure for malformed follow-up data. */
export class FollowUpValidationError extends Error {
  constructor() {
    super("Follow-up input is invalid.");
    this.name = "FollowUpValidationError";
  }
}

/** Safe domain failure for an invalid state transition. */
export class FollowUpTransitionError extends Error {
  constructor() {
    super("Follow-up transition is invalid.");
    this.name = "FollowUpTransitionError";
  }
}

/** Creates one open, local follow-up with a deterministic initial timestamp. */
export function createFollowUp(input: unknown): FollowUp {
  const parsed = followUpInputSchema.safeParse(input);
  if (!parsed.success) throw new FollowUpValidationError();
  const createdAt = toDate(parsed.data.createdAt);
  validateTimeZone(parsed.data.timeZone);
  if (parsed.data.dueAt !== null && !Number.isFinite(Date.parse(parsed.data.dueAt))) {
    throw new FollowUpValidationError();
  }
  if (new Set(parsed.data.sourceFactIds).size !== parsed.data.sourceFactIds.length) {
    throw new FollowUpValidationError();
  }
  return Object.freeze({
    id: parsed.data.id,
    title: parsed.data.title,
    dueAt: parsed.data.dueAt,
    timeZone: parsed.data.timeZone,
    sourceFactIds: [...parsed.data.sourceFactIds],
    status: "open" as const,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    snoozedUntil: null,
    completedAt: null,
  });
}

/** Applies one explicit local lifecycle transition and never creates a provider operation. */
export function transitionFollowUp(
  current: FollowUp,
  transition: {
    readonly action: "complete" | "reopen" | "snooze";
    readonly at: Date;
    readonly snoozedUntil?: string;
  },
): FollowUp {
  assertFollowUp(current);
  assertDate(transition.at);
  if (transition.action === "complete") {
    if (current.status === "completed") throw new FollowUpTransitionError();
    return updated(current, {
      status: "completed",
      completedAt: transition.at.toISOString(),
      snoozedUntil: null,
    }, transition.at);
  }
  if (transition.action === "reopen") {
    if (current.status !== "completed") throw new FollowUpTransitionError();
    return updated(current, { status: "open", completedAt: null, snoozedUntil: null }, transition.at);
  }
  if (current.status === "completed" || typeof transition.snoozedUntil !== "string") {
    throw new FollowUpTransitionError();
  }
  const snoozedUntil = Date.parse(transition.snoozedUntil);
  if (!Number.isFinite(snoozedUntil) || snoozedUntil <= transition.at.getTime()) {
    throw new FollowUpTransitionError();
  }
  return updated(current, {
    status: "snoozed",
    completedAt: null,
    snoozedUntil: new Date(snoozedUntil).toISOString(),
  }, transition.at);
}

/** Copies a follow-up with one lifecycle patch and the exact transition timestamp. */
function updated(
  current: FollowUp,
  patch: Pick<FollowUp, "status" | "completedAt" | "snoozedUntil">,
  at: Date,
): FollowUp {
  return Object.freeze({ ...current, ...patch, updatedAt: at.toISOString() });
}

/** Checks the minimum persisted lifecycle shape before applying a transition. */
function assertFollowUp(value: FollowUp): void {
  if (!value || typeof value.id !== "string" || !["open", "snoozed", "completed"].includes(value.status)) {
    throw new FollowUpTransitionError();
  }
}

/** Copies a date-like creation input without retaining a mutable Date object. */
function toDate(value: Date | string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  assertDate(date);
  return date;
}

/** Rejects invalid transition instants without coercing caller input. */
function assertDate(value: Date): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new FollowUpTransitionError();
}

/** Validates the follow-up's explicit IANA timezone. */
function validateTimeZone(value: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
  } catch {
    throw new FollowUpValidationError();
  }
}

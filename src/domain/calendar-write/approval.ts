/** Defines the provider-neutral Phase C proposal and approval state machine. */
import { z } from "zod";
import { PrivacyLevelSchema, type PrivacyLevel } from "../privacy/privacy";
import type { Domain } from "../categorization/category";

const opaqueId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const providerCalendarId = z
  .string()
  .min(1)
  .max(2_048)
  .regex(/^[^\u0000-\u001F\u007F]+$/u);
const providerVersion = z
  .string()
  .min(1)
  .max(1_024)
  .regex(/^[^\u0000-\u001F\u007F]+$/u);
const boundedTitle = z.string().min(1).max(1_024);
const nullableDescription = z.string().max(8_192).nullable();
const timestamp = z.string().datetime({ offset: true });
const boundedTimeZone = z.string().min(1).max(255);
const concreteDomain = z.enum(["school", "work", "personal"]);

const targetSchema = z
  .object({
    calendarId: providerCalendarId,
    version: providerVersion,
  })
  .strict();

const eventSchema = z
  .object({
    title: boundedTitle,
    description: nullableDescription,
    startsAt: timestamp,
    endsAt: timestamp,
    timeZone: boundedTimeZone,
    domain: concreteDomain,
    privacy: PrivacyLevelSchema,
    attendees: z.array(z.string().min(1).max(320)).max(50),
    recurrence: z.null(),
    notifications: z.literal("none"),
  })
  .strict();

const proposalInputSchema = z
  .object({
    operationId: opaqueId,
    ownerId: opaqueId,
    target: targetSchema,
    requestedAt: timestamp,
    event: eventSchema,
  })
  .strict();

/** Closed reason codes that may cross the provider-neutral write boundary. */
export const CALENDAR_WRITE_REASON_CODES = [
  "INVALID_PROPOSAL_INPUT",
  "UNSUPPORTED_ATTENDEES",
  "UNSUPPORTED_RECURRENCE",
  "UNSUPPORTED_NOTIFICATIONS",
  "STALE_TARGET_VERSION",
  "INVALID_STATE_TRANSITION",
] as const;

/** A safe rejection category without reflected input or provider detail. */
export type CalendarWriteReasonCode =
  (typeof CALENDAR_WRITE_REASON_CODES)[number];

/** Reports one rejected proposal or illegal lifecycle transition safely. */
export class CalendarWriteContractError extends Error {
  /** Creates a constant error whose code is safe for route and audit mapping. */
  constructor(readonly code: CalendarWriteReasonCode) {
    super("Calendar write request is outside the approved contract.");
    this.name = "CalendarWriteContractError";
  }
}

/** Input accepted by the first provider-neutral one-off create contract. */
export type CalendarWriteProposalInput = {
  readonly operationId: string;
  readonly ownerId: string;
  readonly target: {
    readonly calendarId: string;
    readonly version: string;
  };
  readonly requestedAt: string;
  readonly event: {
    readonly title: string;
    readonly description: string | null;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly timeZone: string;
    readonly domain: Exclude<Domain, "unresolved">;
    readonly privacy: PrivacyLevel;
    readonly attendees: readonly string[];
    readonly recurrence: unknown;
    readonly notifications: string;
  };
};

/** Lifecycle states before and after a future provider write. */
export type CalendarWriteStatus =
  | "proposed"
  | "confirmed"
  | "invalidated"
  | "writing"
  | "verification_pending"
  | "verified"
  | "failed";

/** Exact protected event facts that a future provider adapter must preview. */
export interface CalendarEventPreview {
  readonly title: string;
  readonly description: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
  readonly domain: Exclude<Domain, "unresolved">;
  readonly privacy: PrivacyLevel;
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
}

/** Immutable operation value consumed by the next Phase C provider increment. */
export interface CalendarWriteProposal {
  readonly operationId: string;
  readonly ownerId: string;
  readonly action: "create";
  readonly requestedAt: string;
  readonly target: {
    readonly calendarId: string;
    readonly version: string;
  };
  readonly preview: {
    readonly before: null;
    readonly after: CalendarEventPreview;
  };
  readonly status: CalendarWriteStatus;
  readonly invalidatedReason?: "STALE_TARGET_VERSION";
}

/** A provider snapshot supplied immediately before the confirmation decision. */
export interface CalendarTargetSnapshot {
  readonly calendarId: string;
  readonly version: string;
}

/** Pure lifecycle transitions available before provider reconciliation is added. */
export type CalendarWriteTransition =
  | { readonly kind: "approve"; readonly target: CalendarTargetSnapshot }
  | { readonly kind: "begin_write" }
  | { readonly kind: "verified" }
  | { readonly kind: "verification_pending" }
  | { readonly kind: "failed" };

/** Builds one strict, immutable proposal without contacting a provider. */
export function createCalendarWriteProposal(
  input: unknown,
): CalendarWriteProposal {
  const safeInput = readProposalInput(input);
  const parsed = proposalInputSchema.safeParse(safeInput);
  if (!parsed.success) {
    throw new CalendarWriteContractError("INVALID_PROPOSAL_INPUT");
  }

  if (parsed.data.event.attendees.length > 0) {
    throw new CalendarWriteContractError("UNSUPPORTED_ATTENDEES");
  }
  if (parsed.data.event.recurrence !== null) {
    throw new CalendarWriteContractError("UNSUPPORTED_RECURRENCE");
  }
  if (parsed.data.event.notifications !== "none") {
    throw new CalendarWriteContractError("UNSUPPORTED_NOTIFICATIONS");
  }
  if (Date.parse(parsed.data.event.endsAt) <= Date.parse(parsed.data.event.startsAt)) {
    throw new CalendarWriteContractError("INVALID_PROPOSAL_INPUT");
  }

  return freezeValue({
    operationId: parsed.data.operationId,
    ownerId: parsed.data.ownerId,
    action: "create" as const,
    requestedAt: parsed.data.requestedAt,
    target: {
      calendarId: parsed.data.target.calendarId,
      version: parsed.data.target.version,
    },
    preview: {
      before: null,
      after: {
        title: parsed.data.event.title,
        description: parsed.data.event.description,
        startsAt: parsed.data.event.startsAt,
        endsAt: parsed.data.event.endsAt,
        timeZone: parsed.data.event.timeZone,
        domain: parsed.data.event.domain,
        privacy: parsed.data.event.privacy,
        attendees: {
          mode: "none" as const,
          count: 0 as const,
          addresses: [] as const,
        },
        recurrence: {
          scope: "one-off" as const,
          rules: [] as const,
        },
        notifications: {
          policy: "none" as const,
          willNotify: false as const,
        },
      },
    },
    status: "proposed" as const,
  });
}

/** Rehydrates a persisted proposed value through the same strict constructor used at admission. */
export function restoreCalendarWriteProposal(
  input: unknown,
): CalendarWriteProposal {
  const root = readPlainRecord(input);
  assertExactKeys(root, [
    "action",
    "operationId",
    "ownerId",
    "preview",
    "requestedAt",
    "status",
    "target",
  ]);
  if (root.action !== "create" || root.status !== "proposed") {
    throw invalidProposal();
  }

  const target = readPlainRecord(root.target);
  assertExactKeys(target, ["calendarId", "version"]);

  const preview = readPlainRecord(root.preview);
  assertExactKeys(preview, ["after", "before"]);
  if (preview.before !== null) throw invalidProposal();

  const after = readPlainRecord(preview.after);
  assertExactKeys(after, [
    "attendees",
    "description",
    "domain",
    "endsAt",
    "notifications",
    "privacy",
    "recurrence",
    "startsAt",
    "timeZone",
    "title",
  ]);

  const attendees = readPlainRecord(after.attendees);
  assertExactKeys(attendees, ["addresses", "count", "mode"]);
  if (attendees.mode !== "none" || attendees.count !== 0) {
    throw invalidProposal();
  }
  const addresses = readPlainAttendees(attendees.addresses);
  if (addresses.length !== 0) throw invalidProposal();

  const recurrence = readPlainRecord(after.recurrence);
  assertExactKeys(recurrence, ["rules", "scope"]);
  if (recurrence.scope !== "one-off") throw invalidProposal();
  const rules = readPlainAttendees(recurrence.rules);
  if (rules.length !== 0) throw invalidProposal();

  const notifications = readPlainRecord(after.notifications);
  assertExactKeys(notifications, ["policy", "willNotify"]);
  if (notifications.policy !== "none" || notifications.willNotify !== false) {
    throw invalidProposal();
  }

  return createCalendarWriteProposal({
    operationId: root.operationId,
    ownerId: root.ownerId,
    target: {
      calendarId: target.calendarId,
      version: target.version,
    },
    requestedAt: root.requestedAt,
    event: {
      title: after.title,
      description: after.description,
      startsAt: after.startsAt,
      endsAt: after.endsAt,
      timeZone: after.timeZone,
      domain: after.domain,
      privacy: after.privacy,
      attendees: addresses,
      recurrence: null,
      notifications: "none",
    },
  });
}

/** Applies one explicitly allowed transition and returns a new immutable value. */
export function transitionCalendarWrite(
  operation: CalendarWriteProposal,
  transition: CalendarWriteTransition,
): CalendarWriteProposal {
  if (transition.kind === "approve") {
    if (operation.status !== "proposed") {
      throw invalidTransition();
    }

    if (
      transition.target.calendarId !== operation.target.calendarId ||
      transition.target.version !== operation.target.version
    ) {
      return freezeValue({
        ...operation,
        status: "invalidated" as const,
        invalidatedReason: "STALE_TARGET_VERSION" as const,
      });
    }

    return freezeValue({ ...operation, status: "confirmed" as const });
  }

  if (transition.kind === "begin_write") {
    if (operation.status !== "confirmed") {
      throw invalidTransition();
    }
    return freezeValue({ ...operation, status: "writing" as const });
  }

  if (operation.status !== "writing") {
    throw invalidTransition();
  }

  return freezeValue({ ...operation, status: transition.kind });
}

/** Reads one plain data object through descriptors without invoking accessors. */
function readPlainRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidProposal();
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw invalidProposal();
  }

  for (const inheritedKey of Reflect.ownKeys(Object.prototype)) {
    if (Object.getOwnPropertyDescriptor(Object.prototype, inheritedKey)?.enumerable) {
      throw invalidProposal();
    }
  }

  const output = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !descriptor?.enumerable ||
      !("value" in descriptor)
    ) {
      throw invalidProposal();
    }
    Object.defineProperty(output, key, {
      configurable: false,
      enumerable: true,
      value: descriptor.value,
      writable: false,
    });
  }
  return output;
}

/** Rejects unknown or missing fields in a persisted canonical value. */
function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const actual = Object.keys(value).sort().join(",");
  if (actual !== [...expected].sort().join(",")) throw invalidProposal();
}

/** Copies an attendee array after rejecting sparse, accessor, or extra data shapes. */
function readPlainAttendees(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw invalidProposal();
  }

  const keys = Reflect.ownKeys(value);
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor)) {
    throw invalidProposal();
  }
  const length = lengthDescriptor.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > 50) {
    throw invalidProposal();
  }

  const output: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      throw invalidProposal();
    }
    output.push(descriptor.value);
  }
  if (
    keys.length !== length + 1 ||
    keys.some((key) => key !== "length" && (typeof key !== "string" || !/^\d+$/u.test(key)))
  ) {
    throw invalidProposal();
  }
  return output;
}

/** Normalizes nested descriptors before Zod can read any caller-owned object. */
function readProposalInput(input: unknown): unknown {
  const root = readPlainRecord(input);
  const target = readPlainRecord(root.target);
  const event = readPlainRecord(root.event);
  const attendees = readPlainAttendees(event.attendees);

  if (attendees.length > 0) {
    throw new CalendarWriteContractError("UNSUPPORTED_ATTENDEES");
  }
  if (event.recurrence !== null) {
    throw new CalendarWriteContractError("UNSUPPORTED_RECURRENCE");
  }
  if (event.notifications !== "none") {
    throw new CalendarWriteContractError("UNSUPPORTED_NOTIFICATIONS");
  }

  return {
    ...root,
    target,
    event: {
      ...event,
      attendees,
    },
  };
}

/** Creates the constant invalid-input contract error. */
function invalidProposal(): CalendarWriteContractError {
  return new CalendarWriteContractError("INVALID_PROPOSAL_INPUT");
}

/** Creates the constant illegal-transition contract error. */
function invalidTransition(): CalendarWriteContractError {
  return new CalendarWriteContractError("INVALID_STATE_TRANSITION");
}

/** Deep-freezes only the newly-created plain data graph returned by this module. */
function freezeValue<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) {
      freezeValue(descriptor.value);
    }
  }
  return Object.freeze(value);
}

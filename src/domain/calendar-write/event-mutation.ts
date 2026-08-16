/** Defines strict, provider-neutral previews for one-off event mutations. */
import { z } from "zod";
import { type Domain } from "../categorization/category";
import { PrivacyLevelSchema, type PrivacyLevel } from "../privacy/privacy";
import { CalendarWriteContractError } from "./approval";

export { CalendarWriteContractError } from "./approval";

const opaqueId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const providerIdentity = z
  .string()
  .min(1)
  .max(2_048)
  .regex(/^[^\u0000-\u001F\u007F]+$/u);
const timestamp = z.string().datetime({ offset: true });
const concreteDomain = z.enum(["school", "work", "personal"]);
const eventStatus = z.enum(["confirmed", "tentative", "cancelled"]);
const eventInputSchema = z
  .object({
    title: z.string().min(1).max(1_024),
    description: z.string().max(8_192).nullable(),
    startsAt: timestamp,
    endsAt: timestamp,
    timeZone: z.string().min(1).max(255),
    domain: concreteDomain,
    privacy: PrivacyLevelSchema,
    status: eventStatus,
    attendees: z.array(z.string().min(1).max(320)).max(50),
    recurrence: z.null(),
    notifications: z.literal("none"),
  })
  .strict();
const targetInputSchema = z
  .object({
    calendarId: providerIdentity,
    eventId: providerIdentity,
    version: providerIdentity,
    scope: z.enum(["single", "series"]),
  })
  .strict();
const mutationInputSchema = z
  .object({
    operationId: opaqueId,
    ownerId: opaqueId,
    action: z.enum(["update", "move", "cancel", "delete"]),
    target: targetInputSchema,
    requestedAt: timestamp,
    before: eventInputSchema,
    after: eventInputSchema.nullable(),
  })
  .strict();

/** The supported one-off event mutation actions. */
export type CalendarWriteMutationAction = "update" | "move" | "cancel" | "delete";

/** The only scope available before the recurrence increment is accepted. */
export type CalendarWriteMutationScope = "single";

/** A provider-normalized event snapshot accepted by the mutation contract. */
export type CalendarWriteMutationEventInput = {
  readonly title: string;
  readonly description: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
  readonly domain: Exclude<Domain, "unresolved">;
  readonly privacy: PrivacyLevel;
  readonly status: "confirmed" | "tentative" | "cancelled";
  readonly attendees: readonly string[];
  readonly recurrence: null;
  readonly notifications: "none";
};

/** Input accepted only after strict shape, scope, and action checks. */
export type CalendarWriteMutationInput = {
  readonly operationId: string;
  readonly ownerId: string;
  readonly action: CalendarWriteMutationAction;
  readonly target: {
    readonly calendarId: string;
    readonly eventId: string;
    readonly version: string;
    readonly scope: CalendarWriteMutationScope | "series";
  };
  readonly requestedAt: string;
  readonly before: CalendarWriteMutationEventInput;
  readonly after: CalendarWriteMutationEventInput | null;
};

/** Immutable provider-neutral event facts shown in a before/after preview. */
export interface CalendarWriteMutationEvent {
  readonly title: string;
  readonly description: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
  readonly domain: Exclude<Domain, "unresolved">;
  readonly privacy: PrivacyLevel;
  readonly status: "confirmed" | "tentative" | "cancelled";
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

/** Immutable target identity and exact provider version approved by the user. */
export interface CalendarWriteMutationTarget {
  readonly calendarId: string;
  readonly eventId: string;
  readonly version: string;
  readonly scope: CalendarWriteMutationScope;
}

/** Lifecycle states used while a mutation is confirmed and reconciled. */
export type CalendarWriteMutationStatus =
  | "proposed"
  | "confirmed"
  | "invalidated"
  | "writing"
  | "verification_pending"
  | "verified"
  | "failed"
  | "undone";

/** Immutable mutation proposal persisted inside the encrypted approval envelope. */
export interface CalendarWriteMutationProposal {
  readonly operationId: string;
  readonly ownerId: string;
  readonly action: CalendarWriteMutationAction;
  readonly requestedAt: string;
  readonly target: CalendarWriteMutationTarget;
  readonly preview: {
    readonly before: CalendarWriteMutationEvent;
    readonly after: CalendarWriteMutationEvent | null;
  };
  readonly status: CalendarWriteMutationStatus;
  readonly invalidatedReason?: "STALE_EVENT_VERSION";
}

/** Provider snapshot supplied immediately before a mutation confirmation. */
export type CalendarWriteMutationTargetSnapshot = CalendarWriteMutationTarget;

/** Pure lifecycle transitions available before provider reconciliation. */
export type CalendarWriteMutationTransition =
  | { readonly kind: "approve"; readonly target: CalendarWriteMutationTargetSnapshot }
  | { readonly kind: "begin_write" }
  | { readonly kind: "verified" }
  | { readonly kind: "verification_pending" }
  | { readonly kind: "failed" }
  | { readonly kind: "undone" };

/** Builds one strict, immutable one-off mutation proposal without provider I/O. */
export function createCalendarWriteMutationProposal(
  input: unknown,
): CalendarWriteMutationProposal {
  const safeInput = readMutationInput(input);
  const parsed = mutationInputSchema.safeParse(safeInput);
  if (!parsed.success) {
    throw mutationError("INVALID_MUTATION_INPUT");
  }
  if (parsed.data.target.scope !== "single") {
    throw mutationError("UNSUPPORTED_MUTATION_SCOPE");
  }
  if (Date.parse(parsed.data.before.endsAt) <= Date.parse(parsed.data.before.startsAt)) {
    throw mutationError("INVALID_MUTATION_PREVIEW");
  }
  if (
    parsed.data.after &&
    Date.parse(parsed.data.after.endsAt) <= Date.parse(parsed.data.after.startsAt)
  ) {
    throw mutationError("INVALID_MUTATION_PREVIEW");
  }
  validateActionShape(parsed.data.action, parsed.data.before, parsed.data.after);

  return freezeValue({
    operationId: parsed.data.operationId,
    ownerId: parsed.data.ownerId,
    action: parsed.data.action,
    requestedAt: parsed.data.requestedAt,
    target: {
      calendarId: parsed.data.target.calendarId,
      eventId: parsed.data.target.eventId,
      version: parsed.data.target.version,
      scope: "single" as const,
    },
    preview: {
      before: toPreviewEvent(parsed.data.before),
      after: parsed.data.after ? toPreviewEvent(parsed.data.after) : null,
    },
    status: "proposed" as const,
  });
}

/** Rehydrates one persisted proposed mutation through the strict admission contract. */
export function restoreCalendarWriteMutationProposal(
  input: unknown,
): CalendarWriteMutationProposal {
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
  if (
    root.status !== "proposed" ||
    root.action !== "update" &&
      root.action !== "move" &&
      root.action !== "cancel" &&
      root.action !== "delete"
  ) {
    throw mutationError("INVALID_MUTATION_INPUT");
  }

  const target = readPlainRecord(root.target);
  assertExactKeys(target, ["calendarId", "eventId", "scope", "version"]);
  if (target.scope !== "single") {
    throw mutationError("INVALID_MUTATION_INPUT");
  }

  const preview = readPlainRecord(root.preview);
  assertExactKeys(preview, ["after", "before"]);
  const before = readPersistedPreviewEvent(preview.before);
  const after =
    preview.after === null ? null : readPersistedPreviewEvent(preview.after);

  return createCalendarWriteMutationProposal({
    operationId: root.operationId,
    ownerId: root.ownerId,
    action: root.action,
    target: {
      calendarId: target.calendarId,
      eventId: target.eventId,
      version: target.version,
      scope: "single",
    },
    requestedAt: root.requestedAt,
    before,
    after,
  });
}

/** Applies one explicitly allowed mutation transition without changing the input. */
export function transitionCalendarWriteMutation(
  proposal: CalendarWriteMutationProposal,
  transition: CalendarWriteMutationTransition,
): CalendarWriteMutationProposal {
  if (transition.kind === "approve") {
    if (proposal.status !== "proposed") throw invalidTransition();
    if (!sameTarget(proposal.target, transition.target)) {
      return freezeValue({
        ...proposal,
        status: "invalidated" as const,
        invalidatedReason: "STALE_EVENT_VERSION" as const,
      });
    }
    return freezeValue({ ...proposal, status: "confirmed" as const });
  }

  if (transition.kind === "begin_write") {
    if (proposal.status !== "confirmed") throw invalidTransition();
    return freezeValue({ ...proposal, status: "writing" as const });
  }

  if (proposal.status !== "writing") throw invalidTransition();
  return freezeValue({ ...proposal, status: transition.kind });
}

/** Validates that an action's immutable before/after shape matches its meaning. */
function validateActionShape(
  action: CalendarWriteMutationAction,
  before: z.infer<typeof eventInputSchema>,
  after: z.infer<typeof eventInputSchema> | null,
): void {
  if (action === "delete") {
    if (after !== null) throw mutationError("INVALID_MUTATION_PREVIEW");
    return;
  }
  if (after === null) throw mutationError("INVALID_MUTATION_PREVIEW");

  if (action === "cancel") {
    if (after.status !== "cancelled" || !sameNonStatusFields(before, after)) {
      throw mutationError("INVALID_MUTATION_PREVIEW");
    }
    return;
  }

  if (action === "move") {
    if (!sameNonTimeFields(before, after) || sameTimeFields(before, after)) {
      throw mutationError("INVALID_MUTATION_PREVIEW");
    }
    return;
  }

  if (after.status !== before.status || !sameTimeFields(before, after) && action !== "update") {
    throw mutationError("INVALID_MUTATION_PREVIEW");
  }
}

/** Compares all fields except lifecycle status for cancellation. */
function sameNonStatusFields(
  before: z.infer<typeof eventInputSchema>,
  after: z.infer<typeof eventInputSchema>,
): boolean {
  return (
    before.title === after.title &&
    before.description === after.description &&
    before.startsAt === after.startsAt &&
    before.endsAt === after.endsAt &&
    before.timeZone === after.timeZone &&
    before.domain === after.domain &&
    before.privacy === after.privacy &&
    JSON.stringify(before.attendees) === JSON.stringify(after.attendees) &&
    before.recurrence === after.recurrence &&
    before.notifications === after.notifications
  );
}

/** Compares all fields except the time fields for a move. */
function sameNonTimeFields(
  before: z.infer<typeof eventInputSchema>,
  after: z.infer<typeof eventInputSchema>,
): boolean {
  return (
    before.title === after.title &&
    before.description === after.description &&
    before.domain === after.domain &&
    before.privacy === after.privacy &&
    before.status === after.status &&
    JSON.stringify(before.attendees) === JSON.stringify(after.attendees) &&
    before.recurrence === after.recurrence &&
    before.notifications === after.notifications
  );
}

/** Compares the immutable time fields used to distinguish a move. */
function sameTimeFields(
  before: z.infer<typeof eventInputSchema>,
  after: z.infer<typeof eventInputSchema>,
): boolean {
  return (
    before.startsAt === after.startsAt &&
    before.endsAt === after.endsAt &&
    before.timeZone === after.timeZone
  );
}

/** Converts a strict input event into the public preview shape. */
function toPreviewEvent(
  event: z.infer<typeof eventInputSchema>,
): CalendarWriteMutationEvent {
  return {
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timeZone: event.timeZone,
    domain: event.domain,
    privacy: event.privacy,
    status: event.status,
    attendees: { mode: "none", count: 0, addresses: [] },
    recurrence: { scope: "one-off", rules: [] },
    notifications: { policy: "none", willNotify: false },
  };
}

/** Compares all provider identity and scope fields before confirmation. */
function sameTarget(
  left: CalendarWriteMutationTarget,
  right: CalendarWriteMutationTarget,
): boolean {
  return (
    left.calendarId === right.calendarId &&
    left.eventId === right.eventId &&
    left.version === right.version &&
    left.scope === right.scope
  );
}

/** Reads a caller-owned mutation input without invoking accessors. */
function readMutationInput(input: unknown): unknown {
  const root = readPlainRecord(input);
  assertExactKeys(root, ["action", "after", "before", "operationId", "ownerId", "requestedAt", "target"]);
  const target = readPlainRecord(root.target);
  assertExactKeys(target, ["calendarId", "eventId", "scope", "version"]);
  const before = readEventInput(root.before);
  const after = root.after === null ? null : readEventInput(root.after);
  return { ...root, target, before, after };
}

/** Reads one event object and its bounded attendee array without invoking getters. */
function readEventInput(value: unknown): unknown {
  const event = readPlainRecord(value);
  assertExactKeys(event, [
    "attendees",
    "description",
    "domain",
    "endsAt",
    "notifications",
    "privacy",
    "recurrence",
    "startsAt",
    "status",
    "timeZone",
    "title",
  ]);
  return { ...event, attendees: readPlainAttendees(event.attendees) };
}

/** Reads the canonical nested preview shape without invoking persisted getters. */
function readPersistedPreviewEvent(value: unknown): CalendarWriteMutationEventInput {
  const event = readPlainRecord(value);
  assertExactKeys(event, [
    "attendees",
    "description",
    "domain",
    "endsAt",
    "notifications",
    "privacy",
    "recurrence",
    "startsAt",
    "status",
    "timeZone",
    "title",
  ]);

  const attendees = readPlainRecord(event.attendees);
  assertExactKeys(attendees, ["addresses", "count", "mode"]);
  if (attendees.mode !== "none" || attendees.count !== 0) {
    throw mutationError("INVALID_MUTATION_INPUT");
  }
  const addresses = readPlainAttendees(attendees.addresses);
  if (addresses.length !== 0) {
    throw mutationError("INVALID_MUTATION_INPUT");
  }

  const recurrence = readPlainRecord(event.recurrence);
  assertExactKeys(recurrence, ["rules", "scope"]);
  if (recurrence.scope !== "one-off" || readPlainAttendees(recurrence.rules).length !== 0) {
    throw mutationError("INVALID_MUTATION_INPUT");
  }

  const notifications = readPlainRecord(event.notifications);
  assertExactKeys(notifications, ["policy", "willNotify"]);
  if (notifications.policy !== "none" || notifications.willNotify !== false) {
    throw mutationError("INVALID_MUTATION_INPUT");
  }

  return {
    title: event.title as string,
    description: event.description as string | null,
    startsAt: event.startsAt as string,
    endsAt: event.endsAt as string,
    timeZone: event.timeZone as string,
    domain: event.domain as Exclude<Domain, "unresolved">,
    privacy: event.privacy as PrivacyLevel,
    status: event.status as "confirmed" | "tentative" | "cancelled",
    attendees: [],
    recurrence: null,
    notifications: "none",
  };
}

/** Copies an ordinary array only when every indexed value is a data property. */
function readPlainAttendees(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw mutationError("INVALID_MUTATION_INPUT");
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value)) {
    throw mutationError("INVALID_MUTATION_INPUT");
  }
  const output: unknown[] = [];
  for (let index = 0; index < lengthDescriptor.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      throw mutationError("INVALID_MUTATION_INPUT");
    }
    output.push(descriptor.value);
  }
  if (Reflect.ownKeys(value).length !== lengthDescriptor.value + 1) {
    throw mutationError("INVALID_MUTATION_INPUT");
  }
  return output;
}

/** Reads only a plain object with enumerable data properties. */
function readPlainRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw mutationError("INVALID_MUTATION_INPUT");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw mutationError("INVALID_MUTATION_INPUT");
  }
  const output = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !descriptor?.enumerable || !("value" in descriptor)) {
      throw mutationError("INVALID_MUTATION_INPUT");
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

/** Rejects unknown or missing keys in caller-owned mutation records. */
function assertExactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  if (Object.keys(value).sort().join(",") !== [...expected].sort().join(",")) {
    throw mutationError("INVALID_MUTATION_INPUT");
  }
}

/** Creates a stable public contract error without reflecting rejected values. */
function mutationError(
  code: "INVALID_MUTATION_INPUT" | "INVALID_MUTATION_PREVIEW" | "UNSUPPORTED_MUTATION_SCOPE" | "STALE_EVENT_VERSION",
): CalendarWriteContractError {
  return new CalendarWriteContractError(code);
}

/** Creates the constant invalid-transition error shared with create. */
function invalidTransition(): CalendarWriteContractError {
  return new CalendarWriteContractError("INVALID_STATE_TRANSITION");
}

/** Deep-freezes the new proposal graph without mutating caller-owned input. */
function freezeValue<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) freezeValue(descriptor.value);
  }
  return Object.freeze(value);
}

/** Defines the pure, versioned state machine for connecting one Vision secondary calendar. */

/** The exact phrase required before the setup flow can request calendar creation. */
export const CREATE_VISION_CALENDAR_CONFIRMATION = "CREATE VISION CALENDAR";

/** The safe error emitted when a command is replayed or based on an older setup state. */
export const STALE_SETUP_VERSION = "STALE_SETUP_VERSION";

/** The safe error emitted when a command cannot be applied to the current setup state. */
export const INVALID_SETUP_TRANSITION = "INVALID_SETUP_TRANSITION";

/** The safe error emitted when a calendar creation request lacks the exact confirmation phrase. */
export const EXACT_CONFIRMATION_REQUIRED = "EXACT_CONFIRMATION_REQUIRED";

/** The eight explicit stages used to render and persist the private-pilot calendar setup journey. */
export type CalendarSetupStatus =
  | "signed_out"
  | "authenticated"
  | "discovering"
  | "awaiting_choice"
  | "awaiting_confirmation"
  | "creating"
  | "connected"
  | "failed";

/** A versioned state in which no private-pilot identity is currently authenticated. */
export interface SignedOutCalendarSetupState {
  readonly setupVersion: number;
  readonly status: "signed_out";
}

/** A versioned state in which the allowed identity may start calendar discovery. */
export interface AuthenticatedCalendarSetupState {
  readonly setupVersion: number;
  readonly status: "authenticated";
}

/** A versioned state in which the integration is discovering owned secondary calendars. */
export interface DiscoveringCalendarSetupState {
  readonly setupVersion: number;
  readonly status: "discovering";
}

/** A versioned state containing owned existing calendars that require an explicit selection. */
export interface AwaitingChoiceCalendarSetupState {
  readonly candidates: readonly string[];
  readonly setupVersion: number;
  readonly status: "awaiting_choice";
}

/** A versioned state that permits a user to provide the exact creation confirmation. */
export interface AwaitingConfirmationCalendarSetupState {
  readonly setupVersion: number;
  readonly status: "awaiting_confirmation";
}

/** A versioned state that records a confirmed, in-flight calendar creation request. */
export interface CreatingCalendarSetupState {
  readonly setupVersion: number;
  readonly status: "creating";
}

/** A versioned state that records the explicitly selected or newly created calendar connection. */
export interface ConnectedCalendarSetupState {
  readonly calendarId: string;
  readonly connection: "created" | "existing";
  readonly setupVersion: number;
  readonly status: "connected";
}

/** A versioned state that requires a safe, explicit retry after an external setup failure. */
export interface FailedCalendarSetupState {
  readonly setupVersion: number;
  readonly status: "failed";
}

/** Every state accepted and produced by the calendar setup state machine. */
export type CalendarSetupState =
  | SignedOutCalendarSetupState
  | AuthenticatedCalendarSetupState
  | DiscoveringCalendarSetupState
  | AwaitingChoiceCalendarSetupState
  | AwaitingConfirmationCalendarSetupState
  | CreatingCalendarSetupState
  | ConnectedCalendarSetupState
  | FailedCalendarSetupState;

/** A mutation that records successful private-pilot authentication. */
export interface SignInCalendarSetupCommand {
  readonly setupVersion: number;
  readonly type: "sign-in";
}

/** A mutation that begins discovery of owned secondary calendars. */
export interface StartDiscoveryCalendarSetupCommand {
  readonly setupVersion: number;
  readonly type: "start-discovery";
}

/** A mutation that records the stable IDs of discovered owned secondary calendar candidates. */
export interface DiscoveryCompleteCalendarSetupCommand {
  readonly calendarIds: readonly string[];
  readonly setupVersion: number;
  readonly type: "discovery-complete";
}

/** A mutation that explicitly connects one discovered, owned secondary calendar. */
export interface SelectExistingCalendarSetupCommand {
  readonly calendarId: string;
  readonly setupVersion: number;
  readonly type: "select-existing-calendar";
}

/** A mutation that supplies the exact confirmation phrase before calendar creation can begin. */
export interface ConfirmCreateCalendarSetupCommand {
  readonly phrase: string;
  readonly setupVersion: number;
  readonly type: "confirm-create";
}

/** A mutation that records the stable ID returned by a completed secondary-calendar creation request. */
export interface CreationCompleteCalendarSetupCommand {
  readonly calendarId: string;
  readonly setupVersion: number;
  readonly type: "creation-complete";
}

/** A mutation that records a safe failure state without provider details. */
export interface FailCalendarSetupCommand {
  readonly setupVersion: number;
  readonly type: "fail";
}

/** A mutation that restarts discovery after an explicit failure retry. */
export interface RetryCalendarSetupCommand {
  readonly setupVersion: number;
  readonly type: "retry";
}

/** A mutation that ends the current setup journey and removes its client-visible state. */
export interface SignOutCalendarSetupCommand {
  readonly setupVersion: number;
  readonly type: "sign-out";
}

/** Every versioned mutation accepted by the calendar setup state machine. */
export type CalendarSetupCommand =
  | SignInCalendarSetupCommand
  | StartDiscoveryCalendarSetupCommand
  | DiscoveryCompleteCalendarSetupCommand
  | SelectExistingCalendarSetupCommand
  | ConfirmCreateCalendarSetupCommand
  | CreationCompleteCalendarSetupCommand
  | FailCalendarSetupCommand
  | RetryCalendarSetupCommand
  | SignOutCalendarSetupCommand;

/** Reports a safe setup transition error without echoing state, calendar, or provider data. */
export class CalendarSetupTransitionError extends Error {
  constructor(message: typeof STALE_SETUP_VERSION | typeof INVALID_SETUP_TRANSITION | typeof EXACT_CONFIRMATION_REQUIRED) {
    super(message);
    this.name = "CalendarSetupTransitionError";
  }
}

/**
 * Applies one exact-version command and returns the next immutable setup state.
 *
 * This domain rule never calls a provider: `creating` only authorizes a later integration boundary
 * to request a secondary-calendar creation, and no state transition can write an event.
 */
export function transitionCalendarSetup(
  stateInput: CalendarSetupState,
  commandInput: CalendarSetupCommand,
): CalendarSetupState {
  const state = snapshotSetupState(stateInput);
  const command = snapshotSetupCommand(commandInput);
  if (!state || !command) throw new CalendarSetupTransitionError(STALE_SETUP_VERSION);
  assertCurrentVersion(state, command);

  if (command.type === "sign-out" && state.status !== "signed_out") {
    return { setupVersion: nextVersion(state), status: "signed_out" };
  }

  if (command.type === "fail" && state.status !== "signed_out" && state.status !== "connected" && state.status !== "failed") {
    return { setupVersion: nextVersion(state), status: "failed" };
  }

  switch (state.status) {
    case "signed_out":
      return command.type === "sign-in"
        ? { setupVersion: nextVersion(state), status: "authenticated" }
        : rejectInvalidTransition();
    case "authenticated":
      return command.type === "start-discovery"
        ? { setupVersion: nextVersion(state), status: "discovering" }
        : rejectInvalidTransition();
    case "discovering":
      return command.type === "discovery-complete"
        ? discoveredState(command, nextVersion(state))
        : rejectInvalidTransition();
    case "awaiting_choice":
      if (command.type === "select-existing-calendar" && state.candidates.includes(command.calendarId)) {
        return {
          calendarId: command.calendarId,
          connection: "existing",
          setupVersion: nextVersion(state),
          status: "connected",
        };
      }
      return rejectInvalidTransition();
    case "awaiting_confirmation":
      if (command.type !== "confirm-create") {
        return rejectInvalidTransition();
      }
      if (command.phrase !== CREATE_VISION_CALENDAR_CONFIRMATION) {
        throw new CalendarSetupTransitionError(EXACT_CONFIRMATION_REQUIRED);
      }
      return { setupVersion: nextVersion(state), status: "creating" };
    case "creating":
      return command.type === "creation-complete" && isNonEmptyCalendarId(command.calendarId)
        ? {
            calendarId: command.calendarId,
            connection: "created",
            setupVersion: nextVersion(state),
            status: "connected",
          }
        : rejectInvalidTransition();
    case "connected":
      return rejectInvalidTransition();
    case "failed":
      return command.type === "retry"
        ? { setupVersion: nextVersion(state), status: "discovering" }
        : rejectInvalidTransition();
    default:
      return rejectInvalidTransition();
  }
}

/** Verifies that a command is based on the current valid version before any state transition occurs. */
function assertCurrentVersion(state: CalendarSetupState, command: CalendarSetupCommand): void {
  if (state.setupVersion !== command.setupVersion) {
    throw new CalendarSetupTransitionError(STALE_SETUP_VERSION);
  }
}

/** Produces the next deterministic setup version after checking that an increment stays safe. */
function nextVersion(state: CalendarSetupState): number {
  if (state.setupVersion === Number.MAX_SAFE_INTEGER) {
    throw new CalendarSetupTransitionError(STALE_SETUP_VERSION);
  }
  return state.setupVersion + 1;
}

/** Builds the next discovery outcome, requiring stable non-empty calendar IDs for an existing choice. */
function discoveredState(command: DiscoveryCompleteCalendarSetupCommand, setupVersion: number): CalendarSetupState {
  if (!isCalendarIdArray(command.calendarIds)) {
    return rejectInvalidTransition();
  }
  const candidates = [...new Set(command.calendarIds)];
  return candidates.length === 0
    ? { setupVersion, status: "awaiting_confirmation" }
    : { candidates, setupVersion, status: "awaiting_choice" };
}

/** Returns whether a value is a safe, non-negative integer setup version. */
function isSetupVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Returns whether a record is present and can safely expose runtime input fields. */
/** Returns whether a value names one of the eight supported calendar setup states. */
function isCalendarSetupStatus(value: unknown): value is CalendarSetupStatus {
  return (
    value === "signed_out" ||
    value === "authenticated" ||
    value === "discovering" ||
    value === "awaiting_choice" ||
    value === "awaiting_confirmation" ||
    value === "creating" ||
    value === "connected" ||
    value === "failed"
  );
}

/** Returns whether a provider-neutral calendar ID is a non-empty, non-whitespace string. */
function isNonEmptyCalendarId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Returns whether a value is an array of non-empty opaque calendar IDs. */
function isCalendarIdArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isNonEmptyCalendarId);
}

/** Validates a runtime state shape before transition logic reads its status-specific fields. */
function snapshotSetupState(value: unknown): CalendarSetupState | undefined {
  const record = snapshotRecord(value, ["setupVersion", "status", "candidates", "calendarId", "connection"]);
  if (!record || !isSetupVersion(record.setupVersion) || !isCalendarSetupStatus(record.status)) {
    return undefined;
  }
  if (record.status === "awaiting_choice") {
    return hasExactKeys(record, ["setupVersion", "status", "candidates"]) && isCalendarIdArray(record.candidates) && record.candidates.length > 0
      ? Object.freeze({ candidates: Object.freeze([...record.candidates]), setupVersion: record.setupVersion, status: record.status })
      : undefined;
  }
  if (record.status === "connected") {
    return hasExactKeys(record, ["setupVersion", "status", "calendarId", "connection"]) && isNonEmptyCalendarId(record.calendarId) && (record.connection === "created" || record.connection === "existing")
      ? Object.freeze({ calendarId: record.calendarId, connection: record.connection, setupVersion: record.setupVersion, status: record.status })
      : undefined;
  }
  return hasExactKeys(record, ["setupVersion", "status"])
    ? Object.freeze({ setupVersion: record.setupVersion, status: record.status }) as CalendarSetupState
    : undefined;
}

/** Validates runtime command fields before transition logic consumes command-specific payloads. */
function snapshotSetupCommand(value: unknown): CalendarSetupCommand | undefined {
  const record = snapshotRecord(value, ["setupVersion", "type", "calendarIds", "calendarId", "phrase"]);
  if (!record || !isSetupVersion(record.setupVersion)) return undefined;
  switch (record.type) {
    case "sign-in":
    case "start-discovery":
    case "fail":
    case "retry":
    case "sign-out":
      return hasExactKeys(record, ["setupVersion", "type"])
        ? Object.freeze({ setupVersion: record.setupVersion, type: record.type }) as CalendarSetupCommand
        : undefined;
    case "discovery-complete": {
      return hasExactKeys(record, ["setupVersion", "type", "calendarIds"]) && isCalendarIdArray(record.calendarIds)
        ? Object.freeze({ calendarIds: Object.freeze([...record.calendarIds]), setupVersion: record.setupVersion, type: record.type })
        : undefined;
    }
    case "select-existing-calendar":
    case "creation-complete": {
      return hasExactKeys(record, ["setupVersion", "type", "calendarId"]) && isNonEmptyCalendarId(record.calendarId)
        ? Object.freeze({ calendarId: record.calendarId, setupVersion: record.setupVersion, type: record.type }) as CalendarSetupCommand
        : undefined;
    }
    case "confirm-create": {
      return hasExactKeys(record, ["setupVersion", "type", "phrase"]) && typeof record.phrase === "string"
        ? Object.freeze({ phrase: record.phrase, setupVersion: record.setupVersion, type: record.type })
        : undefined;
    }
    default:
      return undefined;
  }
}

/** Copies allowed enumerable own data properties without invoking original getters after validation. */
function snapshotRecord(value: unknown, allowedKeys: readonly string[]): Readonly<Record<string, unknown>> | undefined {
  try {
    if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return undefined;
    const names = Object.getOwnPropertyNames(value);
    if (Object.getOwnPropertySymbols(value).length !== 0 || !names.every((name) => allowedKeys.includes(name))) return undefined;
    const snapshot: Record<string, unknown> = {};
    for (const name of names) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return undefined;
      snapshot[name] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return undefined;
  }
}

/** Returns whether a snapshot has exactly the fields required by its state or command variant. */
function hasExactKeys(value: Readonly<Record<string, unknown>>, expectedKeys: readonly string[]): boolean {
  const names = Object.keys(value);
  return names.length === expectedKeys.length && expectedKeys.every((key) => names.includes(key));
}

/** Throws the constant safe error for a command that is not valid in the current state. */
function rejectInvalidTransition(): never {
  throw new CalendarSetupTransitionError(INVALID_SETUP_TRANSITION);
}

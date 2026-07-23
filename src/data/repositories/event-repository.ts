/** Encrypts protected event content before persistence and gates every decrypted read. */
import {
  decryptProtectedFields,
  encryptProtectedFields,
  type EncryptedProtectedFields,
} from "../../crypto/protected-fields";
import {
  parseCipherEnvelope,
  serializeCipherEnvelope,
  type CipherEnvelope,
} from "../../crypto/envelope";
import type { KeyProvider } from "../../crypto/key-provider";
import {
  VisionEventSchema,
  type VisionEvent,
} from "../../domain/events/event";
import {
  PrivacyLevelSchema,
  type PrivacyLevel,
} from "../../domain/privacy/privacy";

/** Plaintext event content accepted only on the trusted side of the repository boundary. */
export interface PlaintextEvent extends VisionEvent {
  readonly title: string | null;
  readonly description: string | null;
  readonly attendees: readonly string[];
  readonly location: string | null;
  readonly meetingLink: string | null;
}

/** Complete encrypted row passed to an atomic persistence adapter. */
export interface StoredEventRow extends VisionEvent {
  readonly titleEnvelope: Uint8Array | null;
  readonly descriptionEnvelope: Uint8Array | null;
  readonly attendeesEnvelope: Uint8Array;
  readonly locationEnvelope: Uint8Array | null;
  readonly meetingLinkEnvelope: Uint8Array | null;
  readonly protectedKeyVersion: number;
}

/**
 * Atomic storage contract separating ciphertext-blind planning reads from version-pinned protected reads.
 *
 * `saveAtomically` must preserve a newer same-owner row and return the authoritative row. `selectProtectedEvent`
 * must compare `expectedVersion` in the same database statement that selects protected envelope columns.
 */
export interface AtomicEventStore {
  saveAtomically(row: StoredEventRow): Promise<StoredEventRow>;
  selectPlanningEvent(nodeId: string, ownerId: string): Promise<VisionEvent | undefined>;
  selectProtectedEvent(
    nodeId: string,
    ownerId: string,
    expectedVersion: number,
  ): Promise<StoredEventRow | undefined>;
}

/** Explicit owner and privacy capabilities supplied for one protected-content read. */
export interface ProtectedEventReadAuthorization {
  readonly ownerId: string;
  readonly allowedPrivacyLevels: readonly PrivacyLevel[];
}

/** Reports a denied protected-content read without including identities or content. */
export class EventContentAccessDeniedError extends Error {
  constructor() {
    super("Protected event content access is not authorized.");
    this.name = "EventContentAccessDeniedError";
  }
}

/** Reports a changed event snapshot without exposing its protected or provider data. */
export class EventReadStaleError extends Error {
  constructor() {
    super("Event changed during the authorized read.");
    this.name = "EventReadStaleError";
  }
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const REQUIRED_EVENT_KEYS = new Set([
  "attendees",
  "busy",
  "description",
  "domain",
  "domainState",
  "endsAt",
  "identity",
  "location",
  "meetingLink",
  "nodeId",
  "ownerId",
  "privacy",
  "startsAt",
  "status",
  "timeZone",
  "title",
  "version",
]);
const OPTIONAL_EVENT_KEYS = new Set(["recurrenceId"]);

type PlainProtectedEventFields = {
  readonly title: string | null;
  readonly description: string | null;
  readonly attendees: string;
  readonly location: string | null;
  readonly meetingLink: string | null;
};

type EncryptedProtectedEventFields = EncryptedProtectedFields<PlainProtectedEventFields>;

/** Connects plaintext event objects to an atomic ciphertext store and authorization-gated reads. */
export class EventRepository {
  constructor(
    private readonly store: AtomicEventStore,
    private readonly keyProvider: KeyProvider,
  ) {}

  /** Encrypts every represented protected field before making the single atomic adapter call. */
  async save(event: PlaintextEvent): Promise<void> {
    const validated = validatePlaintextEvent(event);
    const planningEvent = toPlanningEvent(validated);
    const encrypted = await encryptProtectedFields(
      this.keyProvider,
      {
        ownerId: validated.ownerId,
        nodeId: validated.nodeId,
        domain: validated.domain,
      },
      {
        title: validated.title,
        description: validated.description,
        attendees: JSON.stringify(validated.attendees),
        location: validated.location,
        meetingLink: validated.meetingLink,
      },
    );
    const row = toStoredEventRow(planningEvent, encrypted);

    // No database adapter method is reachable until all plaintext fields have become authenticated envelopes.
    const authoritative = await this.store.saveAtomically(row);
    validateAuthoritativeSave(authoritative, row);
  }

  /** Reads only planning-safe columns for an explicitly named owner. */
  async getPlanning(nodeId: string, ownerId: string): Promise<VisionEvent | undefined> {
    validateOpaqueLookup(nodeId, ownerId);
    const event = await this.store.selectPlanningEvent(nodeId, ownerId);
    if (!event) {
      return undefined;
    }

    const parsed = VisionEventSchema.safeParse(event);
    if (
      !parsed.success ||
      parsed.data.nodeId !== nodeId ||
      parsed.data.ownerId !== ownerId
    ) {
      throw new Error("Planning event lookup returned an invalid owner-bound row.");
    }
    return parsed.data;
  }

  /** Decrypts only after owner and privacy checks, using the authorized planning version as a read pin. */
  async get(
    nodeId: string,
    authorization: ProtectedEventReadAuthorization,
  ): Promise<PlaintextEvent | undefined> {
    const allowedPrivacyLevels = validateReadAuthorization(authorization);
    const planningEvent = await this.getPlanning(nodeId, authorization.ownerId);
    if (!planningEvent) {
      return undefined;
    }

    if (!allowedPrivacyLevels.has(planningEvent.privacy)) {
      throw new EventContentAccessDeniedError();
    }

    const stored = await this.store.selectProtectedEvent(
      nodeId,
      authorization.ownerId,
      planningEvent.version,
    );
    if (!stored || !matchesAuthorizedSnapshot(stored, planningEvent)) {
      // A changed owner, privacy, domain, or version invalidates the authorization decision before decryption.
      throw new EventReadStaleError();
    }

    const plaintext = await decryptProtectedFields(
      this.keyProvider,
      {
        ownerId: planningEvent.ownerId,
        nodeId: planningEvent.nodeId,
        domain: planningEvent.domain,
      },
      toEncryptedProtectedFields(stored),
    );

    return {
      ...planningEvent,
      title: plaintext.title,
      description: plaintext.description,
      attendees: parseAttendees(plaintext.attendees),
      location: plaintext.location,
      meetingLink: plaintext.meetingLink,
    };
  }
}

/** Validates the exact top-level event and protected value shapes without coercion. */
function validatePlaintextEvent(event: PlaintextEvent): PlaintextEvent {
  if (typeof event !== "object" || event === null || Array.isArray(event)) {
    throw new Error("Plaintext event must be a plain object.");
  }

  const prototype = Object.getPrototypeOf(event);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Plaintext event must be a plain object.");
  }

  const seenKeys = new Set<string>();
  for (const key of Reflect.ownKeys(event)) {
    const descriptor = Object.getOwnPropertyDescriptor(event, key);
    if (
      typeof key !== "string" ||
      (!REQUIRED_EVENT_KEYS.has(key) && !OPTIONAL_EVENT_KEYS.has(key)) ||
      !descriptor?.enumerable ||
      !("value" in descriptor)
    ) {
      throw new Error("Plaintext event contains an unsupported field shape.");
    }
    seenKeys.add(key);
  }

  if ([...REQUIRED_EVENT_KEYS].some((key) => !seenKeys.has(key))) {
    throw new Error("Plaintext event is missing a required field.");
  }

  const {
    title,
    description,
    attendees,
    location,
    meetingLink,
    ...planningInput
  } = event;
  if (
    !isNullableString(title) ||
    !isNullableString(description) ||
    !isNullableString(location) ||
    !isNullableString(meetingLink)
  ) {
    throw new Error("Protected event text must be a string or null.");
  }

  const validatedAttendees = validateAttendees(attendees);
  const parsedPlanning = VisionEventSchema.safeParse(planningInput);
  if (!parsedPlanning.success) {
    throw new Error("Plaintext event planning fields are invalid.");
  }

  return {
    ...parsedPlanning.data,
    title,
    description,
    attendees: validatedAttendees,
    location,
    meetingLink,
  };
}

/** Copies only the pure planning contract from a validated plaintext event. */
function toPlanningEvent(event: PlaintextEvent): VisionEvent {
  const {
    title: _title,
    description: _description,
    attendees: _attendees,
    location: _location,
    meetingLink: _meetingLink,
    ...planningEvent
  } = event;
  return planningEvent;
}

/** Converts authenticated JSON envelopes into binary database values. */
function toStoredEventRow(
  event: VisionEvent,
  encrypted: EncryptedProtectedEventFields,
): StoredEventRow {
  const versions = new Set(
    Object.values(encrypted)
      .filter((envelope): envelope is CipherEnvelope => envelope !== null)
      .map((envelope) => envelope.keyVersion),
  );
  if (versions.size !== 1) {
    throw new Error("Protected event fields must use one active key version.");
  }

  return {
    ...event,
    titleEnvelope: encodeEnvelope(encrypted.title),
    descriptionEnvelope: encodeEnvelope(encrypted.description),
    attendeesEnvelope: encodeEnvelope(encrypted.attendees) as Uint8Array,
    locationEnvelope: encodeEnvelope(encrypted.location),
    meetingLinkEnvelope: encodeEnvelope(encrypted.meetingLink),
    protectedKeyVersion: [...versions][0]!,
  };
}

/** Serializes one validated cipher envelope as UTF-8 binary for the `bytea` column. */
function encodeEnvelope(envelope: CipherEnvelope | null): Uint8Array | null {
  return envelope === null
    ? null
    : textEncoder.encode(serializeCipherEnvelope(envelope));
}

/** Parses one bounded UTF-8 binary envelope after authorization. */
function decodeEnvelope(envelope: Uint8Array | null): CipherEnvelope | null {
  if (envelope === null) {
    return null;
  }
  if (!(envelope instanceof Uint8Array)) {
    throw new Error("Stored event ciphertext is invalid.");
  }

  try {
    return parseCipherEnvelope(textDecoder.decode(envelope));
  } catch {
    throw new Error("Stored event ciphertext is invalid.");
  }
}

/** Reconstructs the encrypted field map only after the authorized row has been selected. */
function toEncryptedProtectedFields(row: StoredEventRow): EncryptedProtectedEventFields {
  const attendees = decodeEnvelope(row.attendeesEnvelope);
  if (attendees === null) {
    throw new Error("Stored attendee ciphertext is missing.");
  }

  const encrypted = {
    title: decodeEnvelope(row.titleEnvelope),
    description: decodeEnvelope(row.descriptionEnvelope),
    attendees,
    location: decodeEnvelope(row.locationEnvelope),
    meetingLink: decodeEnvelope(row.meetingLinkEnvelope),
  };
  const versions = new Set(
    Object.values(encrypted)
      .filter((envelope): envelope is CipherEnvelope => envelope !== null)
      .map((envelope) => envelope.keyVersion),
  );
  if (
    versions.size !== 1 ||
    !versions.has(row.protectedKeyVersion)
  ) {
    throw new Error("Stored event key metadata is inconsistent.");
  }
  return encrypted;
}

/** Ensures an atomic save cannot cross owner, identity, or monotonic-version boundaries. */
function validateAuthoritativeSave(
  authoritative: StoredEventRow,
  requested: StoredEventRow,
): void {
  if (
    authoritative.nodeId !== requested.nodeId ||
    authoritative.ownerId !== requested.ownerId ||
    authoritative.identity.sourceSystem !== requested.identity.sourceSystem ||
    authoritative.identity.sourceCalendarId !== requested.identity.sourceCalendarId ||
    authoritative.identity.sourceEventId !== requested.identity.sourceEventId ||
    authoritative.version < requested.version
  ) {
    throw new Error("Atomic event save returned an invalid owner-bound result.");
  }
}

/** Validates an explicit owner and closed set of privacy levels before any lookup. */
function validateReadAuthorization(
  authorization: ProtectedEventReadAuthorization,
): ReadonlySet<PrivacyLevel> {
  if (
    typeof authorization !== "object" ||
    authorization === null ||
    Array.isArray(authorization) ||
    Object.getPrototypeOf(authorization) !== Object.prototype ||
    typeof authorization.ownerId !== "string" ||
    authorization.ownerId.length === 0 ||
    !Array.isArray(authorization.allowedPrivacyLevels)
  ) {
    throw new EventContentAccessDeniedError();
  }

  const levels = new Set<PrivacyLevel>();
  for (const level of authorization.allowedPrivacyLevels) {
    const parsed = PrivacyLevelSchema.safeParse(level);
    if (!parsed.success) {
      throw new EventContentAccessDeniedError();
    }
    levels.add(parsed.data);
  }
  return levels;
}

/** Compares every policy-relevant field with the snapshot that was explicitly authorized. */
function matchesAuthorizedSnapshot(
  stored: StoredEventRow,
  authorized: VisionEvent,
): boolean {
  return (
    stored.nodeId === authorized.nodeId &&
    stored.ownerId === authorized.ownerId &&
    stored.version === authorized.version &&
    stored.domain === authorized.domain &&
    stored.privacy === authorized.privacy
  );
}

/** Validates non-empty owner-bound lookup identifiers. */
function validateOpaqueLookup(nodeId: string, ownerId: string): void {
  if (
    typeof nodeId !== "string" ||
    nodeId.length === 0 ||
    typeof ownerId !== "string" ||
    ownerId.length === 0
  ) {
    throw new Error("Event lookup requires opaque node and owner IDs.");
  }
}

/** Validates a protected nullable text field without coercion. */
function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

/** Validates a dense plain array of attendee strings before JSON encoding. */
function validateAttendees(attendees: readonly string[]): readonly string[] {
  if (
    !Array.isArray(attendees) ||
    Object.getPrototypeOf(attendees) !== Array.prototype
  ) {
    throw new Error("Event attendees must be a plain string array.");
  }

  for (const key of Reflect.ownKeys(attendees)) {
    const descriptor = Object.getOwnPropertyDescriptor(attendees, key);
    if (
      typeof key === "symbol" ||
      !descriptor ||
      !("value" in descriptor) ||
      (key !== "length" && !/^(0|[1-9]\d*)$/u.test(key))
    ) {
      throw new Error("Event attendees must be a dense plain string array.");
    }
  }
  if (
    attendees.some((attendee) => typeof attendee !== "string") ||
    Object.keys(attendees).length !== attendees.length
  ) {
    throw new Error("Event attendees must be a dense plain string array.");
  }
  return [...attendees];
}

/** Parses and revalidates decrypted attendee JSON without returning malformed content. */
function parseAttendees(serialized: string): readonly string[] {
  try {
    return validateAttendees(JSON.parse(serialized) as readonly string[]);
  } catch {
    throw new Error("Stored attendee ciphertext contains invalid attendee data.");
  }
}

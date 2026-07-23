/** Encrypts protected event content before persistence and gates every decrypted read. */
import { sql } from "drizzle-orm";
import {
  decryptProtectedFields,
  encryptProtectedFields,
  type EncryptedProtectedFields,
} from "../../crypto/protected-fields";
import {
  MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS,
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
  isVerifiedEventRepositoryAccess,
  matchesEventContentAuthorizationDecision,
  type VerifiedEventRepositoryAccess,
} from "../../server/authorization/event-content-authorization";
import type { VisionDatabase } from "../db";

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
  saveAtomically(row: StoredEventRow): Promise<AtomicEventSaveResult>;
  selectPlanningEvent(nodeId: string, ownerId: string): Promise<VisionEvent | undefined>;
  selectProtectedEvent(
    nodeId: string,
    ownerId: string,
    expectedVersion: number,
    expectedProviderVersion: string,
  ): Promise<StoredEventRow | undefined>;
}

/** Authoritative row and concurrency classification returned by one atomic save statement. */
export interface AtomicEventSaveResult {
  readonly outcome: "applied" | "equal" | "newer";
  readonly event: VisionEvent;
}

/** Owner-scoped repository surface returned only after verified server composition. */
export interface EventRepositoryPort {
  save(event: PlaintextEvent): Promise<void>;
  getPlanning(nodeId: string): Promise<VisionEvent | undefined>;
  get(nodeId: string): Promise<PlaintextEvent | undefined>;
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

/** Reports a save attempted outside the authenticated repository owner scope. */
export class EventOwnerMismatchError extends Error {
  constructor() {
    super("Event owner does not match the authenticated repository scope.");
    this.name = "EventOwnerMismatchError";
  }
}

/** Reports an equal-version non-idempotent write without exposing either event. */
export class EventPersistenceConflictError extends Error {
  constructor() {
    super("Equal event version contains conflicting persisted facts.");
    this.name = "EventPersistenceConflictError";
  }
}

/** Reports that the supplied event was encrypted for a node snapshot that is no longer authoritative. */
export class EventNodeSnapshotConflictError extends Error {
  constructor() {
    super("Event node snapshot does not match the authoritative node.");
    this.name = "EventNodeSnapshotConflictError";
  }
}

type DatabaseEventRow = Record<string, unknown>;
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

/** Concrete Neon/Drizzle adapter using atomic PostgreSQL writes and owner-scoped projections. */
export class DrizzleAtomicEventStore implements AtomicEventStore {
  constructor(private readonly database: VisionDatabase) {}

  /** Applies only a strictly newer provider version and returns the row PostgreSQL kept. */
  async saveAtomically(row: StoredEventRow): Promise<AtomicEventSaveResult> {
    const result = await this.database.execute<DatabaseEventRow>(sql`
      with incoming (
        node_id, owner_id, provider, provider_calendar_id, provider_event_id, provider_version,
        starts_at, ends_at, time_zone, busy, status, recurrence_id,
        expected_domain, expected_domain_state, expected_privacy, expected_node_version,
        title_envelope,
        description_envelope, attendees_envelope, location_envelope, meeting_link_envelope,
        protected_key_version
      ) as (
        values (
          ${row.nodeId}, ${row.ownerId}, ${row.identity.sourceSystem},
          ${row.identity.sourceCalendarId}, ${row.identity.sourceEventId},
          ${row.identity.sourceVersion}, ${row.startsAt}::timestamptz, ${row.endsAt}::timestamptz,
          ${row.timeZone}, ${row.busy}::boolean, ${row.status}, ${row.recurrenceId ?? null},
          ${row.domain}, ${row.domainState}, ${row.privacy}, ${row.version}::integer,
          ${row.titleEnvelope}::bytea, ${row.descriptionEnvelope}::bytea, ${row.attendeesEnvelope}::bytea,
          ${row.locationEnvelope}::bytea, ${row.meetingLinkEnvelope}::bytea,
          ${row.protectedKeyVersion}::integer
        )
      ),
      eligible as (
        select incoming.*
        from incoming
        inner join nodes node
          on node.id = incoming.node_id
          and node.owner_id = incoming.owner_id
          and node.domain = incoming.expected_domain
          and node.domain_state = incoming.expected_domain_state
          and node.privacy = incoming.expected_privacy
          and node.version = incoming.expected_node_version
      ),
      write as (
        insert into events as persisted (
          node_id, owner_id, provider, provider_calendar_id, provider_event_id, provider_version,
          starts_at, ends_at, time_zone, busy, status, recurrence_id, title_envelope,
          description_envelope, attendees_envelope, location_envelope, meeting_link_envelope,
          protected_key_version
        )
        select
          node_id, owner_id, provider, provider_calendar_id, provider_event_id, provider_version,
          starts_at, ends_at, time_zone, busy, status, recurrence_id, title_envelope,
          description_envelope, attendees_envelope, location_envelope, meeting_link_envelope,
          protected_key_version
        from eligible
        on conflict (provider, provider_calendar_id, provider_event_id) do update set
          provider_version = excluded.provider_version,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          time_zone = excluded.time_zone,
          busy = excluded.busy,
          status = excluded.status,
          recurrence_id = excluded.recurrence_id,
          title_envelope = excluded.title_envelope,
          description_envelope = excluded.description_envelope,
          attendees_envelope = excluded.attendees_envelope,
          location_envelope = excluded.location_envelope,
          meeting_link_envelope = excluded.meeting_link_envelope,
          protected_key_version = excluded.protected_key_version
        where persisted.owner_id = excluded.owner_id
          and persisted.node_id = excluded.node_id
          and persisted.provider_version < excluded.provider_version
        returning persisted.*
      )
      select
        write.node_id as "nodeId",
        write.owner_id as "ownerId",
        write.provider,
        write.provider_calendar_id as "providerCalendarId",
        write.provider_event_id as "providerEventId",
        write.provider_version as "providerVersion",
        write.starts_at as "startsAt",
        write.ends_at as "endsAt",
        write.time_zone as "timeZone",
        write.busy,
        write.status,
        write.recurrence_id as "recurrenceId",
        node.domain,
        node.domain_state as "domainState",
        node.privacy,
        node.version
      from write
      inner join nodes node
        on node.id = write.node_id and node.owner_id = write.owner_id
    `);

    const [persisted] = result.rows;
    if (persisted) {
      const event = databaseRowToPlanningEvent(persisted);
      validateAuthoritativeSave(event, row);
      return { outcome: "applied", event };
    }

    // A fresh statement sees a conflict winner committed after the write statement snapshot.
    const winner = await this.selectSaveWinner(row);
    if (!winner) {
      throw new EventNodeSnapshotConflictError();
    }
    validateAuthoritativeSave(winner, row);
    if (winner.identity.sourceVersion === row.identity.sourceVersion) {
      return { outcome: "equal", event: winner };
    }
    if (winner.identity.sourceVersion > row.identity.sourceVersion) {
      return { outcome: "newer", event: winner };
    }
    throw new Error("PostgreSQL returned an invalid atomic event-save result.");
  }

  /** Re-reads only nonprotected winner facts in a fresh snapshot after an empty write result. */
  private async selectSaveWinner(row: StoredEventRow): Promise<VisionEvent | undefined> {
    const result = await this.database.execute<DatabaseEventRow>(sql`
      select
        event.node_id as "nodeId",
        event.owner_id as "ownerId",
        event.provider,
        event.provider_calendar_id as "providerCalendarId",
        event.provider_event_id as "providerEventId",
        event.provider_version as "providerVersion",
        event.starts_at as "startsAt",
        event.ends_at as "endsAt",
        event.time_zone as "timeZone",
        event.busy,
        event.status,
        event.recurrence_id as "recurrenceId",
        node.domain,
        node.domain_state as "domainState",
        node.privacy,
        node.version
      from events event
      inner join nodes node on node.id = event.node_id and node.owner_id = event.owner_id
      where event.provider = ${row.identity.sourceSystem}
        and event.provider_calendar_id = ${row.identity.sourceCalendarId}
        and event.provider_event_id = ${row.identity.sourceEventId}
      limit 1
    `);
    return result.rows[0] ? databaseRowToPlanningEvent(result.rows[0]) : undefined;
  }

  /** Selects only planning-safe columns for one node and owner. */
  async selectPlanningEvent(
    nodeId: string,
    ownerId: string,
  ): Promise<VisionEvent | undefined> {
    const result = await this.database.execute<DatabaseEventRow>(sql`
      select
        event.node_id as "nodeId",
        event.owner_id as "ownerId",
        event.provider,
        event.provider_calendar_id as "providerCalendarId",
        event.provider_event_id as "providerEventId",
        event.provider_version as "providerVersion",
        event.starts_at as "startsAt",
        event.ends_at as "endsAt",
        event.time_zone as "timeZone",
        event.busy,
        event.status,
        event.recurrence_id as "recurrenceId",
        node.domain,
        node.domain_state as "domainState",
        node.privacy,
        node.version
      from events event
      inner join nodes node on node.id = event.node_id and node.owner_id = event.owner_id
      where event.node_id = ${nodeId} and event.owner_id = ${ownerId}
      limit 1
    `);
    return result.rows[0] ? databaseRowToPlanningEvent(result.rows[0]) : undefined;
  }

  /** Selects envelopes only when owner, node version, and provider version match the authorized snapshot. */
  async selectProtectedEvent(
    nodeId: string,
    ownerId: string,
    expectedVersion: number,
    expectedProviderVersion: string,
  ): Promise<StoredEventRow | undefined> {
    const result = await this.database.execute<DatabaseEventRow>(sql`
      select
        event.node_id as "nodeId",
        event.owner_id as "ownerId",
        event.provider,
        event.provider_calendar_id as "providerCalendarId",
        event.provider_event_id as "providerEventId",
        event.provider_version as "providerVersion",
        event.starts_at as "startsAt",
        event.ends_at as "endsAt",
        event.time_zone as "timeZone",
        event.busy,
        event.status,
        event.recurrence_id as "recurrenceId",
        node.domain,
        node.domain_state as "domainState",
        node.privacy,
        node.version,
        event.title_envelope as "titleEnvelope",
        event.description_envelope as "descriptionEnvelope",
        event.attendees_envelope as "attendeesEnvelope",
        event.location_envelope as "locationEnvelope",
        event.meeting_link_envelope as "meetingLinkEnvelope",
        event.protected_key_version as "protectedKeyVersion"
      from events event
      inner join nodes node on node.id = event.node_id and node.owner_id = event.owner_id
      where event.node_id = ${nodeId}
        and event.owner_id = ${ownerId}
        and node.version = ${expectedVersion}
        and event.provider_version = ${expectedProviderVersion}
      limit 1
    `);
    return result.rows[0] ? databaseRowToStoredEvent(result.rows[0]) : undefined;
  }
}

/** Connects plaintext event objects to an atomic ciphertext store and authorization-gated reads. */
class EventRepository implements EventRepositoryPort {
  constructor(
    private readonly store: AtomicEventStore,
    private readonly keyProvider: KeyProvider,
    private readonly access: VerifiedEventRepositoryAccess,
  ) {}

  /** Encrypts every represented protected field before making the single atomic adapter call. */
  async save(event: PlaintextEvent): Promise<void> {
    const validated = validatePlaintextEvent(event);
    if (validated.ownerId !== this.access.authenticatedOwnerId) {
      throw new EventOwnerMismatchError();
    }
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
    const result = await this.store.saveAtomically(row);
    if (result.outcome === "equal") {
      await this.assertIdempotentReplay(result.event, validated);
    }
  }

  /** Reads only planning-safe columns for an explicitly named owner. */
  async getPlanning(nodeId: string): Promise<VisionEvent | undefined> {
    validateOpaqueLookup(nodeId, this.access.authenticatedOwnerId);
    const event = await this.store.selectPlanningEvent(nodeId, this.access.authenticatedOwnerId);
    if (!event) {
      return undefined;
    }

    const parsed = VisionEventSchema.safeParse(event);
    if (
      !parsed.success ||
      parsed.data.nodeId !== nodeId ||
      parsed.data.ownerId !== this.access.authenticatedOwnerId
    ) {
      throw new Error("Planning event lookup returned an invalid owner-bound row.");
    }
    return parsed.data;
  }

  /** Decrypts only after owner and privacy checks, using the authorized planning version as a read pin. */
  async get(
    nodeId: string,
  ): Promise<PlaintextEvent | undefined> {
    const planningEvent = await this.getPlanning(nodeId);
    if (!planningEvent) {
      return undefined;
    }

    const request = {
      authenticatedOwnerId: this.access.authenticatedOwnerId,
      eventOwnerId: planningEvent.ownerId,
      privacy: planningEvent.privacy,
    };
    const decision = this.access.authorize(request);
    if (!matchesEventContentAuthorizationDecision(decision, request)) {
      throw new EventContentAccessDeniedError();
    }

    const stored = await this.store.selectProtectedEvent(
      nodeId,
      this.access.authenticatedOwnerId,
      planningEvent.version,
      planningEvent.identity.sourceVersion,
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

  /** Owner/privacy-authorizes and compares an equal-version row to distinguish replay from conflict. */
  private async assertIdempotentReplay(
    planningEvent: VisionEvent,
    requested: PlaintextEvent,
  ): Promise<void> {
    const request = {
      authenticatedOwnerId: this.access.authenticatedOwnerId,
      eventOwnerId: planningEvent.ownerId,
      privacy: planningEvent.privacy,
    };
    const decision = this.access.authorize(request);
    if (!matchesEventContentAuthorizationDecision(decision, request)) {
      throw new EventPersistenceConflictError();
    }
    const stored = await this.store.selectProtectedEvent(
      planningEvent.nodeId,
      this.access.authenticatedOwnerId,
      planningEvent.version,
      planningEvent.identity.sourceVersion,
    );
    if (!stored || !matchesAuthorizedSnapshot(stored, planningEvent)) {
      throw new EventPersistenceConflictError();
    }
    const persisted = await decryptStoredEvent(this.keyProvider, stored);
    if (!plaintextEventsEqual(persisted, requested)) {
      throw new EventPersistenceConflictError();
    }
  }
}

/** Wires the production Drizzle adapter and trusted server policy into one owner-scoped repository. */
export function createEventRepository(
  database: VisionDatabase,
  keyProvider: KeyProvider,
  access: VerifiedEventRepositoryAccess,
): EventRepositoryPort {
  if (!isVerifiedEventRepositoryAccess(access)) {
    throw new EventOwnerMismatchError();
  }
  return new EventRepository(
    new DrizzleAtomicEventStore(database),
    keyProvider,
    access,
  );
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
  authoritative: VisionEvent,
  requested: StoredEventRow,
): void {
  if (
    authoritative.ownerId !== requested.ownerId ||
    authoritative.nodeId !== requested.nodeId ||
    authoritative.identity.sourceSystem !== requested.identity.sourceSystem ||
    authoritative.identity.sourceCalendarId !== requested.identity.sourceCalendarId ||
    authoritative.identity.sourceEventId !== requested.identity.sourceEventId
  ) {
    throw new EventPersistenceConflictError();
  }
  if (
    authoritative.version !== requested.version ||
    authoritative.domain !== requested.domain ||
    authoritative.domainState !== requested.domainState ||
    authoritative.privacy !== requested.privacy
  ) {
    throw new EventNodeSnapshotConflictError();
  }
}

/** Converts one PostgreSQL projection into the strict planning event contract. */
function databaseRowToPlanningEvent(row: DatabaseEventRow): VisionEvent {
  return VisionEventSchema.parse({
    nodeId: decodeDatabaseString(row.nodeId, "node ID"),
    ownerId: decodeDatabaseString(row.ownerId, "owner ID"),
    identity: {
      sourceSystem: decodeDatabaseString(row.provider, "provider"),
      sourceCalendarId: decodeDatabaseString(row.providerCalendarId, "provider calendar ID"),
      sourceEventId: decodeDatabaseString(row.providerEventId, "provider event ID"),
      sourceVersion: decodeDatabaseString(row.providerVersion, "provider order key"),
    },
    startsAt: decodeDatabaseTimestamp(row.startsAt, "event start"),
    endsAt: decodeDatabaseTimestamp(row.endsAt, "event end"),
    timeZone: decodeDatabaseString(row.timeZone, "time zone"),
    busy: decodeDatabaseBoolean(row.busy, "busy"),
    status: decodeDatabaseString(row.status, "status"),
    recurrenceId: decodeDatabaseNullableString(row.recurrenceId, "recurrence ID") ?? undefined,
    domain: decodeDatabaseString(row.domain, "domain"),
    domainState: decodeDatabaseString(row.domainState, "domain state"),
    privacy: decodeDatabaseString(row.privacy, "privacy"),
    version: decodeDatabasePositiveInteger(row.version, "node version"),
  });
}

/** Converts a complete protected PostgreSQL projection into the encrypted row contract. */
function databaseRowToStoredEvent(row: DatabaseEventRow): StoredEventRow {
  return {
    ...databaseRowToPlanningEvent(row),
    titleEnvelope: decodeDatabaseNullableBytea(row.titleEnvelope, "title envelope"),
    descriptionEnvelope: decodeDatabaseNullableBytea(row.descriptionEnvelope, "description envelope"),
    attendeesEnvelope: decodeDatabaseBytea(row.attendeesEnvelope, "attendees envelope"),
    locationEnvelope: decodeDatabaseNullableBytea(row.locationEnvelope, "location envelope"),
    meetingLinkEnvelope: decodeDatabaseNullableBytea(row.meetingLinkEnvelope, "meeting link envelope"),
    protectedKeyVersion: decodeDatabasePositiveInteger(
      row.protectedKeyVersion,
      "protected key version",
    ),
  };
}

/** Decodes one required raw PostgreSQL text cell without coercing other types. */
function decodeDatabaseString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`PostgreSQL returned invalid ${label}.`);
  }
  return value;
}

/** Decodes one nullable PostgreSQL text cell without treating missing values as null. */
function decodeDatabaseNullableString(value: unknown, label: string): string | null {
  if (value === null) {
    return null;
  }
  return decodeDatabaseString(value, label);
}

/** Decodes Neon raw `t`/`f` cells and already-decoded PostgreSQL test-driver booleans. */
function decodeDatabaseBoolean(value: unknown, label: string): boolean {
  if (value === true || value === "t") {
    return true;
  }
  if (value === false || value === "f") {
    return false;
  }
  throw new Error(`PostgreSQL returned invalid ${label}.`);
}

/** Decodes a canonical positive safe integer from Neon raw text or a decoded driver number. */
function decodeDatabasePositiveInteger(value: unknown, label: string): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^[1-9]\d*$/u.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }
  throw new Error(`PostgreSQL returned invalid ${label}.`);
}

/** Decodes a timestamp cell into the canonical ISO representation used by the domain. */
function decodeDatabaseTimestamp(value: unknown, label: string): string {
  const timestamp =
    value instanceof Date
      ? value
      : typeof value === "string" && /(?:Z|[+-]\d{2}(?::?\d{2})?)$/u.test(value)
        ? new Date(value)
        : undefined;
  if (!timestamp || Number.isNaN(timestamp.getTime())) {
    throw new Error(`PostgreSQL returned invalid ${label}.`);
  }
  return timestamp.toISOString();
}

/** Decodes canonical PostgreSQL hex `bytea` text with a strict allocation bound. */
function decodeDatabaseBytea(value: unknown, label: string): Uint8Array {
  if (value instanceof Uint8Array) {
    if (value.byteLength > MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS) {
      throw new Error(`PostgreSQL returned invalid ${label}.`);
    }
    return value;
  }
  if (
    typeof value !== "string" ||
    !/^\\x(?:[0-9a-f]{2})*$/u.test(value) ||
    (value.length - 2) / 2 > MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS
  ) {
    throw new Error(`PostgreSQL returned invalid ${label}.`);
  }
  const decoded = new Uint8Array((value.length - 2) / 2);
  for (let index = 0; index < decoded.length; index += 1) {
    decoded[index] = Number.parseInt(value.slice(2 + index * 2, 4 + index * 2), 16);
  }
  return decoded;
}

/** Decodes a nullable protected `bytea` cell. */
function decodeDatabaseNullableBytea(value: unknown, label: string): Uint8Array | null {
  return value === null ? null : decodeDatabaseBytea(value, label);
}

/** Decrypts one already-owner/privacy-authorized stored row. */
async function decryptStoredEvent(
  keyProvider: KeyProvider,
  stored: StoredEventRow,
): Promise<PlaintextEvent> {
  const plaintext = await decryptProtectedFields(
    keyProvider,
    {
      ownerId: stored.ownerId,
      nodeId: stored.nodeId,
      domain: stored.domain,
    },
    toEncryptedProtectedFields(stored),
  );
  return {
    ...storedRowToPlanningEvent(stored),
    title: plaintext.title,
    description: plaintext.description,
    attendees: parseAttendees(plaintext.attendees),
    location: plaintext.location,
    meetingLink: plaintext.meetingLink,
  };
}

/** Removes encrypted persistence columns from a validated stored row. */
function storedRowToPlanningEvent(stored: StoredEventRow): VisionEvent {
  const {
    titleEnvelope: _titleEnvelope,
    descriptionEnvelope: _descriptionEnvelope,
    attendeesEnvelope: _attendeesEnvelope,
    locationEnvelope: _locationEnvelope,
    meetingLinkEnvelope: _meetingLinkEnvelope,
    protectedKeyVersion: _protectedKeyVersion,
    ...planning
  } = stored;
  return planning;
}

/** Compares the complete normalized plaintext event for exact idempotent replay. */
function plaintextEventsEqual(
  left: PlaintextEvent,
  right: PlaintextEvent,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
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
    stored.identity.sourceVersion === authorized.identity.sourceVersion &&
    stored.domain === authorized.domain &&
    stored.domainState === authorized.domainState &&
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

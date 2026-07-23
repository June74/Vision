/** Encrypts protected event content before persistence and gates every decrypted read. */
import { sql } from "drizzle-orm";
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
  matchesEventContentAuthorizationDecision,
  type EventContentAuthorizationPolicy,
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
  readonly row: StoredEventRow;
}

/** Server-owned construction facts for one authenticated owner-scoped repository. */
export interface EventRepositoryOptions {
  readonly authenticatedOwnerId: string;
  readonly authorizationPolicy: EventContentAuthorizationPolicy;
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

interface DatabaseEventRow extends Record<string, unknown> {
  nodeId: string;
  ownerId: string;
  provider: string;
  providerCalendarId: string;
  providerEventId: string;
  providerVersion: string;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  busy: boolean;
  status: string;
  recurrenceId: string | null;
  domain: string;
  domainState: string;
  privacy: string;
  version: number;
  titleEnvelope?: Uint8Array | null;
  descriptionEnvelope?: Uint8Array | null;
  attendeesEnvelope?: Uint8Array | null;
  locationEnvelope?: Uint8Array | null;
  meetingLinkEnvelope?: Uint8Array | null;
  protectedKeyVersion?: number | null;
  saveOutcome?: "applied" | "equal" | "newer" | "invalid";
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

/** Concrete Neon/Drizzle adapter using atomic PostgreSQL writes and owner-scoped projections. */
export class DrizzleAtomicEventStore implements AtomicEventStore {
  constructor(private readonly database: VisionDatabase) {}

  /** Applies only a strictly newer provider version and returns the row PostgreSQL kept. */
  async saveAtomically(row: StoredEventRow): Promise<AtomicEventSaveResult> {
    const result = await this.database.execute<DatabaseEventRow>(sql`
      with incoming (
        node_id, owner_id, provider, provider_calendar_id, provider_event_id, provider_version,
        starts_at, ends_at, time_zone, busy, status, recurrence_id, title_envelope,
        description_envelope, attendees_envelope, location_envelope, meeting_link_envelope,
        protected_key_version
      ) as (
        values (
          ${row.nodeId}, ${row.ownerId}, ${row.identity.sourceSystem},
          ${row.identity.sourceCalendarId}, ${row.identity.sourceEventId},
          ${row.identity.sourceVersion}, ${row.startsAt}::timestamptz, ${row.endsAt}::timestamptz,
          ${row.timeZone}, ${row.busy}::boolean, ${row.status}, ${row.recurrenceId ?? null},
          ${row.titleEnvelope}::bytea, ${row.descriptionEnvelope}::bytea, ${row.attendeesEnvelope}::bytea,
          ${row.locationEnvelope}::bytea, ${row.meetingLinkEnvelope}::bytea,
          ${row.protectedKeyVersion}::integer
        )
      ),
      write as (
        insert into events as persisted (
          node_id, owner_id, provider, provider_calendar_id, provider_event_id, provider_version,
          starts_at, ends_at, time_zone, busy, status, recurrence_id, title_envelope,
          description_envelope, attendees_envelope, location_envelope, meeting_link_envelope,
          protected_key_version
        )
        select * from incoming
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
      ),
      authoritative as (
        select write.*, 'applied'::text as save_outcome from write
        union all
        select persisted.*,
          case
            when persisted.provider_version = incoming.provider_version then 'equal'
            when persisted.provider_version > incoming.provider_version then 'newer'
            else 'invalid'
          end as save_outcome
        from events persisted
        cross join incoming
        where not exists (select 1 from write)
          and persisted.provider = incoming.provider
          and persisted.provider_calendar_id = incoming.provider_calendar_id
          and persisted.provider_event_id = incoming.provider_event_id
      )
      select
        authoritative.node_id as "nodeId",
        authoritative.owner_id as "ownerId",
        authoritative.provider,
        authoritative.provider_calendar_id as "providerCalendarId",
        authoritative.provider_event_id as "providerEventId",
        authoritative.provider_version as "providerVersion",
        authoritative.starts_at as "startsAt",
        authoritative.ends_at as "endsAt",
        authoritative.time_zone as "timeZone",
        authoritative.busy,
        authoritative.status,
        authoritative.recurrence_id as "recurrenceId",
        node.domain,
        node.domain_state as "domainState",
        node.privacy,
        node.version,
        authoritative.title_envelope as "titleEnvelope",
        authoritative.description_envelope as "descriptionEnvelope",
        authoritative.attendees_envelope as "attendeesEnvelope",
        authoritative.location_envelope as "locationEnvelope",
        authoritative.meeting_link_envelope as "meetingLinkEnvelope",
        authoritative.protected_key_version as "protectedKeyVersion",
        authoritative.save_outcome as "saveOutcome"
      from authoritative
      inner join nodes node
        on node.id = authoritative.node_id and node.owner_id = authoritative.owner_id
    `);

    const [persisted] = result.rows;
    if (
      !persisted ||
      !["applied", "equal", "newer"].includes(persisted.saveOutcome ?? "")
    ) {
      throw new Error("PostgreSQL returned an invalid atomic event-save result.");
    }
    return {
      outcome: persisted.saveOutcome as AtomicEventSaveResult["outcome"],
      row: databaseRowToStoredEvent(persisted),
    };
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
export class EventRepository {
  constructor(
    private readonly store: AtomicEventStore,
    private readonly keyProvider: KeyProvider,
    private readonly authenticatedOwnerId: string,
    private readonly authorizationPolicy: EventContentAuthorizationPolicy,
  ) {}

  /** Encrypts every represented protected field before making the single atomic adapter call. */
  async save(event: PlaintextEvent): Promise<void> {
    const validated = validatePlaintextEvent(event);
    if (validated.ownerId !== this.authenticatedOwnerId) {
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
    validateAuthoritativeSave(result.row, row);
    if (result.outcome === "equal") {
      await this.assertIdempotentReplay(result.row, validated);
    }
  }

  /** Reads only planning-safe columns for an explicitly named owner. */
  async getPlanning(nodeId: string): Promise<VisionEvent | undefined> {
    validateOpaqueLookup(nodeId, this.authenticatedOwnerId);
    const event = await this.store.selectPlanningEvent(nodeId, this.authenticatedOwnerId);
    if (!event) {
      return undefined;
    }

    const parsed = VisionEventSchema.safeParse(event);
    if (
      !parsed.success ||
      parsed.data.nodeId !== nodeId ||
      parsed.data.ownerId !== this.authenticatedOwnerId
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
      authenticatedOwnerId: this.authenticatedOwnerId,
      eventOwnerId: planningEvent.ownerId,
      privacy: planningEvent.privacy,
    };
    const decision = this.authorizationPolicy.authorize(request);
    if (!matchesEventContentAuthorizationDecision(decision, request)) {
      throw new EventContentAccessDeniedError();
    }

    const stored = await this.store.selectProtectedEvent(
      nodeId,
      this.authenticatedOwnerId,
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
    stored: StoredEventRow,
    requested: PlaintextEvent,
  ): Promise<void> {
    const request = {
      authenticatedOwnerId: this.authenticatedOwnerId,
      eventOwnerId: stored.ownerId,
      privacy: stored.privacy,
    };
    const decision = this.authorizationPolicy.authorize(request);
    if (!matchesEventContentAuthorizationDecision(decision, request)) {
      throw new EventContentAccessDeniedError();
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
  options: EventRepositoryOptions,
): EventRepository {
  if (
    typeof options.authenticatedOwnerId !== "string" ||
    options.authenticatedOwnerId.length === 0
  ) {
    throw new EventOwnerMismatchError();
  }
  return new EventRepository(
    new DrizzleAtomicEventStore(database),
    keyProvider,
    options.authenticatedOwnerId,
    options.authorizationPolicy,
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

/** Converts one PostgreSQL projection into the strict planning event contract. */
function databaseRowToPlanningEvent(row: DatabaseEventRow): VisionEvent {
  return VisionEventSchema.parse({
    nodeId: row.nodeId,
    ownerId: row.ownerId,
    identity: {
      sourceSystem: row.provider,
      sourceCalendarId: row.providerCalendarId,
      sourceEventId: row.providerEventId,
      sourceVersion: row.providerVersion,
    },
    startsAt: new Date(row.startsAt).toISOString(),
    endsAt: new Date(row.endsAt).toISOString(),
    timeZone: row.timeZone,
    busy: row.busy,
    status: row.status,
    recurrenceId: row.recurrenceId ?? undefined,
    domain: row.domain,
    domainState: row.domainState,
    privacy: row.privacy,
    version: row.version,
  });
}

/** Converts a complete protected PostgreSQL projection into the encrypted row contract. */
function databaseRowToStoredEvent(row: DatabaseEventRow): StoredEventRow {
  if (
    !(row.attendeesEnvelope instanceof Uint8Array) ||
    typeof row.protectedKeyVersion !== "number"
  ) {
    throw new Error("PostgreSQL returned invalid protected event columns.");
  }
  return {
    ...databaseRowToPlanningEvent(row),
    titleEnvelope: row.titleEnvelope ?? null,
    descriptionEnvelope: row.descriptionEnvelope ?? null,
    attendeesEnvelope: row.attendeesEnvelope,
    locationEnvelope: row.locationEnvelope ?? null,
    meetingLinkEnvelope: row.meetingLinkEnvelope ?? null,
    protectedKeyVersion: row.protectedKeyVersion,
  };
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

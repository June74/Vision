/** Persists encrypted Phase C approvals and durable owner-scoped write execution state. */
import { sql } from "drizzle-orm";
import {
  MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS,
  parseCipherEnvelope,
  serializeCipherEnvelope,
  type CipherEnvelope,
} from "../../crypto/envelope";
import {
  decryptProtectedFields,
  encryptProtectedFields,
} from "../../crypto/protected-fields";
import type { KeyProvider } from "../../crypto/key-provider";
import {
  restoreCalendarWriteProposal,
  type CalendarWriteProposal,
} from "../../domain/calendar-write/approval";
import type {
  CalendarWriteLedger,
  CalendarWriteLedgerRecord,
} from "../../domain/calendar-write/create-execution";
import type { VisionDatabase } from "../db";

type ProposalDomain = "school" | "work" | "personal";
type ApprovalStatus = "proposed" | "confirmed" | "invalidated";
type ExecutionStatus =
  | "writing"
  | "verification_pending"
  | "verified"
  | "failed"
  | "undone";

const MAX_OPERATION_ID_CHARS = 128;
const MAX_OWNER_ID_CHARS = 128;
const MAX_PROVIDER_ID_CHARS = 2_048;
const MAX_SERIALIZED_PROPOSAL_CHARS = 32 * 1_024;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export interface CalendarWriteApprovalStore {
  createApproval(input: {
    readonly proposal: CalendarWriteProposal;
    readonly requestedAt: Date;
    readonly expiresAt: Date;
  }): Promise<void>;
  findApproval(
    ownerId: string,
    operationId: string,
  ): Promise<CalendarWriteApprovalRecord | undefined>;
  loadProposal(
    ownerId: string,
    operationId: string,
  ): Promise<CalendarWriteProposal | undefined>;
  confirmApproval(
    ownerId: string,
    operationId: string,
    now: Date,
  ): Promise<"confirmed" | "already_confirmed" | "expired" | "missing">;
  invalidateApproval(
    ownerId: string,
    operationId: string,
    now: Date,
  ): Promise<void>;
}

export interface CalendarWriteApprovalRecord {
  readonly ownerId: string;
  readonly operationId: string;
  readonly provider: "google";
  readonly calendarId: string;
  readonly proposalDomain: ProposalDomain;
  readonly status: ApprovalStatus;
  readonly requestedAt: Date;
  readonly expiresAt: Date;
}

/** Constant persistence error that never reflects SQL, row, or protected content. */
export class CalendarWriteRepositoryError extends Error {
  constructor() {
    super("Calendar write persistence failed.");
    this.name = "CalendarWriteRepositoryError";
  }
}

/** Drizzle/Neon implementation for encrypted approvals and the executor ledger port. */
export class DrizzleCalendarWriteRepository
  implements CalendarWriteApprovalStore, CalendarWriteLedger
{
  constructor(
    private readonly database: VisionDatabase,
    private readonly keyProvider: KeyProvider,
  ) {}

  /** Encrypts and inserts one immutable server-owned proposal approval. */
  async createApproval(input: {
    readonly proposal: CalendarWriteProposal;
    readonly requestedAt: Date;
    readonly expiresAt: Date;
  }): Promise<void> {
    try {
      assertDate(input.requestedAt);
      assertDate(input.expiresAt);
      assertProposalForApproval(input.proposal);
      if (input.expiresAt.getTime() <= input.requestedAt.getTime()) {
        throw persistenceFailure();
      }

      const proposalDomain = input.proposal.preview.after.domain;
      const encrypted = await encryptProtectedFields(
        this.keyProvider,
        {
          ownerId: input.proposal.ownerId,
          nodeId: input.proposal.operationId,
          domain: proposalDomain,
        },
        {
          proposal: serializeProposal(input.proposal),
        },
      );
      const proposalEnvelope = encrypted.proposal;
      if (proposalEnvelope === null) throw persistenceFailure();

      const result = await this.database.execute<Record<string, unknown>>(sql`
        insert into calendar_write_approvals (
          operation_id, owner_id, provider, calendar_id, proposal_domain,
          status, requested_at, expires_at, proposal_envelope
        ) values (
          ${input.proposal.operationId}, ${input.proposal.ownerId}, 'google',
          ${input.proposal.target.calendarId}, ${proposalDomain}, 'proposed',
          ${input.requestedAt}, ${input.expiresAt},
          ${encodeEnvelope(proposalEnvelope)}::bytea
        )
        on conflict (operation_id) do nothing
        returning operation_id as "operationId"
      `);
      if (result.rows[0]?.operationId !== input.proposal.operationId) {
        throw persistenceFailure();
      }
    } catch (error) {
      throw normalizePersistenceError(error);
    }
  }

  /** Reads one approval record inside the supplied owner scope. */
  async findApproval(
    ownerId: string,
    operationId: string,
  ): Promise<CalendarWriteApprovalRecord | undefined> {
    try {
      const row = await this.readApprovalRow(ownerId, operationId);
      return row ? toApprovalRecord(row) : undefined;
    } catch (error) {
      throw normalizePersistenceError(error);
    }
  }

  /** Decrypts and revalidates one owner-scoped proposal after the approval lookup. */
  async loadProposal(
    ownerId: string,
    operationId: string,
  ): Promise<CalendarWriteProposal | undefined> {
    try {
      const row = await this.readApprovalRow(ownerId, operationId);
      if (!row || row.status === "invalidated") return undefined;

      const decrypted = await decryptProtectedFields(
        this.keyProvider,
        {
          ownerId: row.ownerId,
          nodeId: row.operationId,
          domain: row.proposalDomain,
        },
        {
          proposal: parseEnvelope(row.proposalEnvelope),
        },
      );
      if (
        typeof decrypted.proposal !== "string" ||
        decrypted.proposal.length === 0 ||
        decrypted.proposal.length > MAX_SERIALIZED_PROPOSAL_CHARS
      ) {
        throw persistenceFailure();
      }

      const proposal = restoreCalendarWriteProposal(
        JSON.parse(decrypted.proposal) as unknown,
      );
      if (
        proposal.operationId !== row.operationId ||
        proposal.ownerId !== row.ownerId ||
        proposal.target.calendarId !== row.calendarId ||
        proposal.preview.after.domain !== row.proposalDomain ||
        proposal.status !== "proposed"
      ) {
        throw persistenceFailure();
      }
      return proposal;
    } catch (error) {
      throw normalizePersistenceError(error);
    }
  }

  /** Confirms an unexpired proposal through an owner-scoped compare-and-set. */
  async confirmApproval(
    ownerId: string,
    operationId: string,
    now: Date,
  ): Promise<"confirmed" | "already_confirmed" | "expired" | "missing"> {
    try {
      assertOwnerAndOperation(ownerId, operationId);
      assertDate(now);

      const changed = await this.database.execute<Record<string, unknown>>(sql`
        update calendar_write_approvals
        set status = 'confirmed'
        where owner_id = ${ownerId}
          and operation_id = ${operationId}
          and status = 'proposed'
          and expires_at > ${now}
        returning status
      `);
      if (changed.rows[0]?.status === "confirmed") return "confirmed";

      const current = await this.database.execute<Record<string, unknown>>(sql`
        select status, expires_at as "expiresAt"
        from calendar_write_approvals
        where owner_id = ${ownerId}
          and operation_id = ${operationId}
        limit 1
      `);
      const row = current.rows[0];
      if (!row) return "missing";

      const status = readApprovalStatus(row.status);
      if (status === "confirmed") return "already_confirmed";
      if (
        status === "proposed" &&
        readDatabaseDate(row.expiresAt).getTime() <= now.getTime()
      ) {
        await this.database.execute<Record<string, unknown>>(sql`
          update calendar_write_approvals
          set status = 'invalidated'
          where owner_id = ${ownerId}
            and operation_id = ${operationId}
            and status = 'proposed'
          returning status
        `);
        return "expired";
      }
      return "missing";
    } catch (error) {
      throw normalizePersistenceError(error);
    }
  }

  /** Invalidates one owner-scoped proposal without reflecting any database detail. */
  async invalidateApproval(
    ownerId: string,
    operationId: string,
    now: Date,
  ): Promise<void> {
    try {
      assertOwnerAndOperation(ownerId, operationId);
      assertDate(now);
      await this.database.execute(sql`
        update calendar_write_approvals
        set status = 'invalidated'
        where owner_id = ${ownerId}
          and operation_id = ${operationId}
          and status in ('proposed', 'confirmed')
      `);
    } catch (error) {
      throw normalizePersistenceError(error);
    }
  }

  /** Reads one owner-scoped durable execution row or returns absent. */
  async find(
    ownerId: string,
    operationId: string,
  ): Promise<CalendarWriteLedgerRecord | undefined> {
    try {
      assertOwnerAndOperation(ownerId, operationId);
      const result = await this.database.execute<Record<string, unknown>>(sql`
        select
          operation_id as "operationId",
          owner_id as "ownerId",
          provider,
          calendar_id as "calendarId",
          status,
          provider_event_id as "eventId",
          provider_event_version as "eventVersion",
          requested_at as "requestedAt",
          completed_at as "completedAt"
        from calendar_write_operations
        where owner_id = ${ownerId}
          and operation_id = ${operationId}
        limit 1
      `);
      const row = result.rows[0];
      if (!row) return undefined;
      const decoded = decodeLedgerRecord(row);
      if (decoded.ownerId !== ownerId || decoded.operationId !== operationId) {
        throw persistenceFailure();
      }
      return decoded;
    } catch (error) {
      throw normalizePersistenceError(error);
    }
  }

  /** Claims the one provider create fence with an atomic insert. */
  async claim(
    ownerId: string,
    operationId: string,
    calendarId: string,
  ): Promise<"claimed" | "existing"> {
    try {
      assertOwnerAndOperation(ownerId, operationId);
      assertProviderIdentity(calendarId);
      const result = await this.database.execute<Record<string, unknown>>(sql`
        insert into calendar_write_operations (
          operation_id, owner_id, provider, calendar_id, status,
          provider_event_id, provider_event_version, requested_at, completed_at
        ) values (
          ${operationId}, ${ownerId}, 'google', ${calendarId}, 'writing',
          null, null, ${new Date()}, null
        )
        on conflict (operation_id) do nothing
        returning operation_id as "operationId"
      `);
      return result.rows[0]?.operationId === operationId
        ? "claimed"
        : "existing";
    } catch (error) {
      throw normalizePersistenceError(error);
    }
  }

  /** Records conservative pending state for an existing create or undo attempt. */
  async markPending(ownerId: string, operationId: string): Promise<void> {
    try {
      assertOwnerAndOperation(ownerId, operationId);
      await this.database.execute(sql`
        update calendar_write_operations
        set status = 'verification_pending'
        where owner_id = ${ownerId}
          and operation_id = ${operationId}
          and status in ('writing', 'verified', 'verification_pending')
      `);
    } catch (error) {
      throw normalizePersistenceError(error);
    }
  }

  /** Records provider identity and version only after exact read-back verification. */
  async markVerified(
    ownerId: string,
    operationId: string,
    calendarId: string,
    eventId: string,
    eventVersion: string,
  ): Promise<void> {
    try {
      assertOwnerAndOperation(ownerId, operationId);
      assertProviderIdentity(calendarId);
      assertProviderIdentity(eventId);
      assertProviderIdentity(eventVersion);
      await this.database.execute(sql`
        update calendar_write_operations
        set
          status = 'verified',
          calendar_id = ${calendarId},
          provider_event_id = ${eventId},
          provider_event_version = ${eventVersion},
          completed_at = ${new Date()}
        where owner_id = ${ownerId}
          and operation_id = ${operationId}
          and status in ('writing', 'verification_pending')
      `);
    } catch (error) {
      throw normalizePersistenceError(error);
    }
  }

  /** Records a definite provider failure without retaining provider detail. */
  async markFailed(ownerId: string, operationId: string): Promise<void> {
    try {
      assertOwnerAndOperation(ownerId, operationId);
      await this.database.execute(sql`
        update calendar_write_operations
        set status = 'failed', completed_at = ${new Date()}
        where owner_id = ${ownerId}
          and operation_id = ${operationId}
          and status = 'writing'
      `);
    } catch (error) {
      throw normalizePersistenceError(error);
    }
  }

  /** Records undo only after the executor has verified provider absence. */
  async markUndone(ownerId: string, operationId: string): Promise<void> {
    try {
      assertOwnerAndOperation(ownerId, operationId);
      await this.database.execute(sql`
        update calendar_write_operations
        set status = 'undone', completed_at = ${new Date()}
        where owner_id = ${ownerId}
          and operation_id = ${operationId}
          and status = 'verified'
      `);
    } catch (error) {
      throw normalizePersistenceError(error);
    }
  }

  /** Reads one approval row with its encrypted envelope only after owner lookup. */
  private async readApprovalRow(
    ownerId: string,
    operationId: string,
  ): Promise<ApprovalRow | undefined> {
    assertOwnerAndOperation(ownerId, operationId);
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        operation_id as "operationId",
        owner_id as "ownerId",
        provider,
        calendar_id as "calendarId",
        proposal_domain as "proposalDomain",
        status,
        requested_at as "requestedAt",
        expires_at as "expiresAt",
        proposal_envelope as "proposalEnvelope"
      from calendar_write_approvals
      where owner_id = ${ownerId}
        and operation_id = ${operationId}
      limit 1
    `);
    if (result.rows.length > 1) throw persistenceFailure();
    const row = result.rows[0];
    if (!row) return undefined;
    const decoded = decodeApprovalRow(row);
    if (decoded.ownerId !== ownerId || decoded.operationId !== operationId) {
      throw persistenceFailure();
    }
    return decoded;
  }
}

interface ApprovalRow extends CalendarWriteApprovalRecord {
  readonly proposalEnvelope: Uint8Array;
}

function toApprovalRecord(row: ApprovalRow): CalendarWriteApprovalRecord {
  return {
    ownerId: row.ownerId,
    operationId: row.operationId,
    provider: row.provider,
    calendarId: row.calendarId,
    proposalDomain: row.proposalDomain,
    status: row.status,
    requestedAt: new Date(row.requestedAt),
    expiresAt: new Date(row.expiresAt),
  };
}

function decodeApprovalRow(row: Record<string, unknown>): ApprovalRow {
  const provider = readProvider(row.provider);
  const proposalDomain = readProposalDomain(row.proposalDomain);
  const status = readApprovalStatus(row.status);
  const operationId = readBoundedText(row.operationId, MAX_OPERATION_ID_CHARS);
  const ownerId = readBoundedText(row.ownerId, MAX_OWNER_ID_CHARS);
  const calendarId = readBoundedText(row.calendarId, MAX_PROVIDER_ID_CHARS);
  const requestedAt = readDatabaseDate(row.requestedAt);
  const expiresAt = readDatabaseDate(row.expiresAt);
  if (expiresAt.getTime() <= requestedAt.getTime()) {
    throw persistenceFailure();
  }
  return {
    operationId,
    ownerId,
    provider,
    calendarId,
    proposalDomain,
    status,
    requestedAt,
    expiresAt,
    proposalEnvelope: readDatabaseBytes(row.proposalEnvelope),
  };
}

function decodeLedgerRecord(
  row: Record<string, unknown>,
): CalendarWriteLedgerRecord {
  readProvider(row.provider);
  const status = readExecutionStatus(row.status);
  const ownerId = readBoundedText(row.ownerId, MAX_OWNER_ID_CHARS);
  const operationId = readBoundedText(row.operationId, MAX_OPERATION_ID_CHARS);
  const calendarId = readBoundedText(row.calendarId, MAX_PROVIDER_ID_CHARS);
  readDatabaseDate(row.requestedAt);
  if (row.completedAt === null) {
    // An in-progress ledger row has no completion timestamp yet.
  } else {
    readDatabaseDate(row.completedAt);
  }
  const eventId =
    row.eventId === null || row.eventId === undefined
      ? undefined
      : readBoundedText(row.eventId, MAX_PROVIDER_ID_CHARS);
  const eventVersion =
    row.eventVersion === null || row.eventVersion === undefined
      ? undefined
      : readBoundedText(row.eventVersion, MAX_PROVIDER_ID_CHARS);
  if ((eventId === undefined) !== (eventVersion === undefined)) {
    throw persistenceFailure();
  }
  if (
    (status === "verified" || status === "undone") &&
    (eventId === undefined || eventVersion === undefined)
  ) {
    throw persistenceFailure();
  }
  return {
    ownerId,
    operationId,
    calendarId,
    status,
    ...(eventId === undefined ? {} : { eventId }),
    ...(eventVersion === undefined ? {} : { eventVersion }),
  };
}

function assertProposalForApproval(
  proposal: CalendarWriteProposal,
): void {
  if (
    proposal.status !== "proposed" ||
    !isBoundedIdentity(proposal.ownerId, MAX_OWNER_ID_CHARS) ||
    !isBoundedIdentity(proposal.operationId, MAX_OPERATION_ID_CHARS) ||
    !isBoundedIdentity(proposal.target.calendarId, MAX_PROVIDER_ID_CHARS) ||
    proposal.preview.after.attendees.count !== 0 ||
    proposal.preview.after.recurrence.scope !== "one-off" ||
    proposal.preview.after.notifications.policy !== "none"
  ) {
    throw persistenceFailure();
  }
}

function assertOwnerAndOperation(ownerId: string, operationId: string): void {
  if (
    !isBoundedIdentity(ownerId, MAX_OWNER_ID_CHARS) ||
    !isBoundedIdentity(operationId, MAX_OPERATION_ID_CHARS)
  ) {
    throw persistenceFailure();
  }
}

function assertProviderIdentity(value: string): void {
  if (!isBoundedIdentity(value, MAX_PROVIDER_ID_CHARS)) {
    throw persistenceFailure();
  }
}

function isBoundedIdentity(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum &&
    !/[\u0000-\u001F\u007F]/u.test(value)
  );
}

function readBoundedText(value: unknown, maximum: number): string {
  if (!isBoundedIdentity(value, maximum)) throw persistenceFailure();
  return value;
}

function readProvider(value: unknown): "google" {
  if (value !== "google") throw persistenceFailure();
  return value;
}

function readProposalDomain(value: unknown): ProposalDomain {
  if (value !== "school" && value !== "work" && value !== "personal") {
    throw persistenceFailure();
  }
  return value;
}

function readApprovalStatus(value: unknown): ApprovalStatus {
  if (
    value !== "proposed" &&
    value !== "confirmed" &&
    value !== "invalidated"
  ) {
    throw persistenceFailure();
  }
  return value;
}

function readExecutionStatus(value: unknown): ExecutionStatus {
  if (
    value !== "writing" &&
    value !== "verification_pending" &&
    value !== "verified" &&
    value !== "failed" &&
    value !== "undone"
  ) {
    throw persistenceFailure();
  }
  return value;
}

function serializeProposal(proposal: CalendarWriteProposal): string {
  const serialized = JSON.stringify(proposal);
  if (
    typeof serialized !== "string" ||
    serialized.length === 0 ||
    serialized.length > MAX_SERIALIZED_PROPOSAL_CHARS
  ) {
    throw persistenceFailure();
  }
  return serialized;
}

function encodeEnvelope(envelope: CipherEnvelope): Uint8Array {
  const serialized = serializeCipherEnvelope(envelope);
  if (
    serialized.length === 0 ||
    serialized.length > MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS
  ) {
    throw persistenceFailure();
  }
  return textEncoder.encode(serialized);
}

function parseEnvelope(bytes: Uint8Array): CipherEnvelope {
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS
  ) {
    throw persistenceFailure();
  }
  return parseCipherEnvelope(textDecoder.decode(bytes));
}

function readDatabaseBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    if (
      value.byteLength === 0 ||
      value.byteLength > MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS
    ) {
      throw persistenceFailure();
    }
    return new Uint8Array(value);
  }
  if (
    typeof value !== "string" ||
    !/^\\x(?:[0-9a-f]{2})+$/u.test(value) ||
    (value.length - 2) / 2 > MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS
  ) {
    throw persistenceFailure();
  }
  const bytes = new Uint8Array((value.length - 2) / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(2 + index * 2, 4 + index * 2), 16);
  }
  return bytes;
}

function readDatabaseDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(Date.prototype.getTime.call(value))) {
    return new Date(Date.prototype.getTime.call(value));
  }
  if (
    typeof value !== "string" ||
    !/(?:z|[+-]\d{2}(?::\d{2})?)$/iu.test(value)
  ) {
    throw persistenceFailure();
  }
  const normalized = /[+-]\d{2}$/u.test(value) ? value + ":00" : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw persistenceFailure();
  return parsed;
}

function assertDate(value: unknown): asserts value is Date {
  if (
    !(value instanceof Date) ||
    Number.isNaN(Date.prototype.getTime.call(value))
  ) {
    throw persistenceFailure();
  }
}

function persistenceFailure(): CalendarWriteRepositoryError {
  return new CalendarWriteRepositoryError();
}

function normalizePersistenceError(error: unknown): CalendarWriteRepositoryError {
  return error instanceof CalendarWriteRepositoryError
    ? error
    : persistenceFailure();
}

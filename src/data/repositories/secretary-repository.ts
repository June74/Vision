/** Persists owner-scoped local secretary records while encrypting user-authored content. */
import { sql } from "drizzle-orm";
import {
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
  createSecretaryCapture,
  classifyCapture,
  type SecretaryCapture,
} from "../../domain/secretary/capture";
import type { SecretaryNote } from "../../domain/secretary/note";
import type { SecretaryTask } from "../../domain/secretary/task";
import type { SecretaryTodayEventInput } from "../../domain/secretary/today";
import {
  createFollowUp,
  transitionFollowUp,
  type FollowUp,
} from "../../domain/follow-ups/follow-up";
import type {
  PlanningSourceSnapshot,
  PlanningTaskFact,
} from "../../domain/scheduling/proposal";
import type { VisionDatabase } from "../db";

export type { SecretaryCapture } from "../../domain/secretary/capture";
export type { SecretaryNote } from "../../domain/secretary/note";
export type { SecretaryTask } from "../../domain/secretary/task";
export type { FollowUp } from "../../domain/follow-ups/follow-up";

const MAX_OWNER_ID_CHARS = 128;
const MAX_ID_CHARS = 128;
const PERSONAL_DOMAIN = "personal" as const;
const textDecoder = new TextDecoder("utf-8", { fatal: true });

/** Source records supplied to the deterministic Today projection. */
export interface SecretaryTodaySource {
  readonly captures: readonly SecretaryCapture[];
  readonly tasks: readonly SecretaryTask[];
  readonly notes: readonly SecretaryNote[];
  readonly events: readonly SecretaryTodayEventInput[];
}

/** Owner-scoped repository port used by production routes and deterministic Worker tests. */
/** Owner-scoped repository surface required by the deterministic planning routes. */
export interface PlanningRepositoryPort {
  readPlanning(ownerId: string, now: Date, timeZone: string): Promise<PlanningSourceSnapshot>;
  createFollowUp(ownerId: string, followUp: FollowUp): Promise<FollowUp>;
  transitionFollowUp(
    ownerId: string,
    followUpId: string,
    action: "complete" | "reopen" | "snooze",
    at: Date,
    snoozedUntil?: string,
  ): Promise<FollowUp | undefined>;
}

export interface SecretaryRepository extends PlanningRepositoryPort {
  readToday(ownerId: string, now: Date, timeZone: string): Promise<SecretaryTodaySource>;
  createCapture(ownerId: string, capture: SecretaryCapture): Promise<SecretaryCapture>;
  createTask(ownerId: string, task: SecretaryTask): Promise<SecretaryTask>;
  transitionTask(
    ownerId: string,
    taskId: string,
    action: "complete" | "undo",
    at: Date,
  ): Promise<SecretaryTask | undefined>;
  createNote(ownerId: string, note: SecretaryNote): Promise<SecretaryNote>;
}

/** Constant repository failure with no SQL, owner, or protected-content detail. */
export class SecretaryRepositoryError extends Error {
  constructor() {
    super("Secretary persistence failed.");
    this.name = "SecretaryRepositoryError";
  }
}

/** Drizzle/Neon implementation of the owner-scoped local secretary port. */
export class DrizzleSecretaryRepository implements SecretaryRepository {
  constructor(
    private readonly database: VisionDatabase,
    private readonly keyProvider: KeyProvider,
  ) {}

  /** Reads all owner-scoped local records for a deterministic Today projection. */
  async readToday(ownerId: string, now: Date, timeZone: string): Promise<SecretaryTodaySource> {
    try {
      assertOwnerId(ownerId);
      assertDate(now);
      assertTimeZone(timeZone);
      const [captureRows, taskRows, noteRows] = await Promise.all([
        this.database.execute<Record<string, unknown>>(sql`
          select id, kind, ambiguity, content_envelope as "contentEnvelope",
                 created_at as "createdAt"
          from secretary_captures
          where owner_id = ${ownerId}
          order by created_at desc, id desc
          limit 200
        `),
        this.database.execute<Record<string, unknown>>(sql`
          select id, title_envelope as "titleEnvelope", due_at as "dueAt",
                 time_zone as "timeZone", status, created_at as "createdAt",
                 completed_at as "completedAt"
          from secretary_tasks
          where owner_id = ${ownerId}
          order by due_at nulls last, id
          limit 200
        `),
        this.database.execute<Record<string, unknown>>(sql`
          select id, title_envelope as "titleEnvelope", body_envelope as "bodyEnvelope",
                 status, created_at as "createdAt", updated_at as "updatedAt"
          from secretary_notes
          where owner_id = ${ownerId}
          order by updated_at desc, id desc
          limit 200
        `),
      ]);
      return {
        captures: await Promise.all(captureRows.rows.map((row) => this.readCapture(ownerId, row))),
        tasks: await Promise.all(taskRows.rows.map((row) => this.readTask(ownerId, row))),
        notes: await Promise.all(noteRows.rows.map((row) => this.readNote(ownerId, row))),
        events: [],
      };
    } catch (error) {
      throw normalizeSecretaryError(error);
    }
  }

  /** Reads planning-safe calendar timing plus owner-scoped local facts for proposals and briefings. */
  async readPlanning(ownerId: string, now: Date, timeZone: string): Promise<PlanningSourceSnapshot> {
    try {
      assertOwnerId(ownerId);
      assertDate(now);
      assertTimeZone(timeZone);
      const today = await this.readToday(ownerId, now, timeZone);
      const [eventRows, followUpRows] = await Promise.all([
        this.database.execute<Record<string, unknown>>(sql`
          select node_id as "id", starts_at as "startsAt", ends_at as "endsAt",
                 time_zone as "timeZone", busy, status
          from events
          where owner_id = ${ownerId}
            and ends_at >= ${now}
            and starts_at <= ${new Date(now.getTime() + 31 * 24 * 60 * 60 * 1_000)}
          order by starts_at, node_id
          limit 500
        `),
        this.database.execute<Record<string, unknown>>(sql`
          select id, title_envelope as "titleEnvelope",
                 source_fact_ids_envelope as "sourceFactIdsEnvelope",
                 due_at as "dueAt", time_zone as "timeZone", status,
                 snoozed_until as "snoozedUntil", created_at as "createdAt",
                 updated_at as "updatedAt", completed_at as "completedAt"
          from secretary_follow_ups
          where owner_id = ${ownerId}
          order by due_at nulls last, id
          limit 200
        `),
      ]);
      const events = eventRows.rows.map((row) => planningEventFromRow(row));
      const followUps = await Promise.all(followUpRows.rows.map((row) => this.readFollowUp(ownerId, row)));
      const sourceFacts = [
        ...events.map((event) => ({ id: event.sourceFactId, kind: "calendar_event" as const, label: "Calendar event" })),
        ...today.tasks.map((task) => ({ id: `task:${task.id}`, kind: "secretary_task" as const, label: task.title })),
        ...followUps.map((followUp) => ({ id: `follow-up:${followUp.id}`, kind: "follow_up" as const, label: followUp.title })),
      ];
      const tasks: PlanningTaskFact[] = today.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        dueAt: task.dueAt,
        timeZone: task.timeZone,
        status: task.status,
        sourceFactId: `task:${task.id}`,
      }));
      return { events, tasks, followUps, sourceFacts };
    } catch (error) {
      throw normalizeSecretaryError(error);
    }
  }

  /** Encrypts and inserts one classified capture under the authenticated owner. */
  async createCapture(ownerId: string, capture: SecretaryCapture): Promise<SecretaryCapture> {
    try {
      assertOwnerId(ownerId);
      const validated = createSecretaryCapture({
        id: capture.id,
        content: capture.content,
        createdAt: parseDate(capture.createdAt),
      });
      if (
        validated.kind !== capture.kind ||
        validated.ambiguity !== capture.ambiguity ||
        validated.title !== capture.title
      ) throw secretaryFailure();
      const encrypted = await encryptProtectedFields(
        this.keyProvider,
        { ownerId, nodeId: capture.id, domain: PERSONAL_DOMAIN },
        { content: capture.content },
      );
      const result = await this.database.execute<Record<string, unknown>>(sql`
        insert into secretary_captures (
          id, owner_id, kind, ambiguity, content_envelope, created_at, updated_at
        ) values (
          ${capture.id}, ${ownerId}, ${capture.kind}, ${capture.ambiguity},
          ${encodeEnvelope(encrypted.content)}::bytea,
          ${parseDate(capture.createdAt)}, ${parseDate(capture.createdAt)}
        )
        on conflict (id) do nothing
        returning id
      `);
      if (result.rows[0]?.id !== capture.id) throw secretaryFailure();
      return capture;
    } catch (error) {
      throw normalizeSecretaryError(error);
    }
  }

  /** Encrypts and inserts one local task while keeping due metadata queryable. */
  async createTask(ownerId: string, task: SecretaryTask): Promise<SecretaryTask> {
    try {
      assertOwnerId(ownerId);
      if (task.status !== "open" || task.completedAt !== null) throw secretaryFailure();
      const encrypted = await encryptProtectedFields(
        this.keyProvider,
        { ownerId, nodeId: task.id, domain: PERSONAL_DOMAIN },
        { title: task.title },
      );
      const result = await this.database.execute<Record<string, unknown>>(sql`
        insert into secretary_tasks (
          id, owner_id, title_envelope, due_at, time_zone, status,
          created_at, completed_at
        ) values (
          ${task.id}, ${ownerId}, ${encodeEnvelope(encrypted.title)}::bytea,
          ${task.dueAt === null ? null : parseDate(task.dueAt)}, ${task.timeZone},
          'open', ${parseDate(task.createdAt)}, null
        )
        on conflict (id) do nothing
        returning id
      `);
      if (result.rows[0]?.id !== task.id) throw secretaryFailure();
      return task;
    } catch (error) {
      throw normalizeSecretaryError(error);
    }
  }

  /** Applies one owner-scoped compare-and-set task transition and returns the new task. */
  async transitionTask(
    ownerId: string,
    taskId: string,
    action: "complete" | "undo",
    at: Date,
  ): Promise<SecretaryTask | undefined> {
    try {
      assertOwnerId(ownerId);
      assertId(taskId);
      assertDate(at);
      const fromStatus = action === "complete" ? "open" : "completed";
      const toStatus = action === "complete" ? "completed" : "open";
      const completedAt = action === "complete" ? at : null;
      const result = await this.database.execute<Record<string, unknown>>(sql`
        update secretary_tasks
        set status = ${toStatus}, completed_at = ${completedAt}
        where owner_id = ${ownerId} and id = ${taskId} and status = ${fromStatus}
        returning id, title_envelope as "titleEnvelope", due_at as "dueAt",
                  time_zone as "timeZone", status, created_at as "createdAt",
                  completed_at as "completedAt"
      `);
      const row = result.rows[0];
      return row ? await this.readTask(ownerId, row) : undefined;
    } catch (error) {
      throw normalizeSecretaryError(error);
    }
  }

  /** Encrypts and inserts one active note under the authenticated owner. */
  async createNote(ownerId: string, note: SecretaryNote): Promise<SecretaryNote> {
    try {
      assertOwnerId(ownerId);
      if (note.status !== "active") throw secretaryFailure();
      const encrypted = await encryptProtectedFields(
        this.keyProvider,
        { ownerId, nodeId: note.id, domain: PERSONAL_DOMAIN },
        { title: note.title, body: note.body },
      );
      const result = await this.database.execute<Record<string, unknown>>(sql`
        insert into secretary_notes (
          id, owner_id, title_envelope, body_envelope, status, created_at, updated_at
        ) values (
          ${note.id}, ${ownerId}, ${encodeEnvelope(encrypted.title)}::bytea,
          ${encodeEnvelope(encrypted.body)}::bytea, 'active',
          ${parseDate(note.createdAt)}, ${parseDate(note.updatedAt)}
        )
        on conflict (id) do nothing
        returning id
      `);
      if (result.rows[0]?.id !== note.id) throw secretaryFailure();
      return note;
    } catch (error) {
      throw normalizeSecretaryError(error);
    }
  }

  /** Encrypts and inserts one open follow-up with queryable due and lifecycle metadata. */
  async createFollowUp(ownerId: string, followUp: FollowUp): Promise<FollowUp> {
    try {
      assertOwnerId(ownerId);
      const validated = createFollowUp({
        id: followUp.id,
        title: followUp.title,
        dueAt: followUp.dueAt,
        timeZone: followUp.timeZone,
        sourceFactIds: followUp.sourceFactIds,
        createdAt: parseDate(followUp.createdAt),
      });
      if (validated.status !== followUp.status || validated.updatedAt !== followUp.updatedAt) {
        throw secretaryFailure();
      }
      const encrypted = await encryptProtectedFields(
        this.keyProvider,
        { ownerId, nodeId: followUp.id, domain: PERSONAL_DOMAIN },
        { title: followUp.title, sourceFactIds: JSON.stringify(followUp.sourceFactIds) },
      );
      const result = await this.database.execute<Record<string, unknown>>(sql`
        insert into secretary_follow_ups (
          id, owner_id, title_envelope, source_fact_ids_envelope, due_at,
          time_zone, status, snoozed_until, created_at, updated_at, completed_at
        ) values (
          ${followUp.id}, ${ownerId}, ${encodeEnvelope(encrypted.title)}::bytea,
          ${encodeEnvelope(encrypted.sourceFactIds)}::bytea,
          ${followUp.dueAt === null ? null : parseDate(followUp.dueAt)}, ${followUp.timeZone},
          'open', null, ${parseDate(followUp.createdAt)}, ${parseDate(followUp.updatedAt)}, null
        )
        on conflict (id) do nothing
        returning id
      `);
      if (result.rows[0]?.id !== followUp.id) throw secretaryFailure();
      return followUp;
    } catch (error) {
      throw normalizeSecretaryError(error);
    }
  }

  /** Applies one owner-scoped compare-and-set follow-up transition. */
  async transitionFollowUp(
    ownerId: string,
    followUpId: string,
    action: "complete" | "reopen" | "snooze",
    at: Date,
    snoozedUntil?: string,
  ): Promise<FollowUp | undefined> {
    try {
      assertOwnerId(ownerId);
      assertId(followUpId);
      assertDate(at);
      const currentResult = await this.database.execute<Record<string, unknown>>(sql`
        select id, title_envelope as "titleEnvelope",
               source_fact_ids_envelope as "sourceFactIdsEnvelope",
               due_at as "dueAt", time_zone as "timeZone", status,
               snoozed_until as "snoozedUntil", created_at as "createdAt",
               updated_at as "updatedAt", completed_at as "completedAt"
        from secretary_follow_ups
        where owner_id = ${ownerId} and id = ${followUpId}
        limit 1
      `);
      const currentRow = currentResult.rows[0];
      if (!currentRow) return undefined;
      const current = await this.readFollowUp(ownerId, currentRow);
      const next = transitionFollowUp(current, { action, at, snoozedUntil });
      const result = await this.database.execute<Record<string, unknown>>(sql`
        update secretary_follow_ups
        set status = ${next.status}, snoozed_until = ${next.snoozedUntil === null ? null : parseDate(next.snoozedUntil)},
            updated_at = ${parseDate(next.updatedAt)}, completed_at = ${next.completedAt === null ? null : parseDate(next.completedAt)}
        where owner_id = ${ownerId} and id = ${followUpId} and status = ${current.status}
        returning id, title_envelope as "titleEnvelope",
                  source_fact_ids_envelope as "sourceFactIdsEnvelope",
                  due_at as "dueAt", time_zone as "timeZone", status,
                  snoozed_until as "snoozedUntil", created_at as "createdAt",
                  updated_at as "updatedAt", completed_at as "completedAt"
      `);
      return result.rows[0] ? await this.readFollowUp(ownerId, result.rows[0]) : undefined;
    } catch (error) {
      throw normalizeSecretaryError(error);
    }
  }

  /** Decrypts one capture row only after its owner-scoped SQL lookup. */
  private async readCapture(ownerId: string, row: Record<string, unknown>): Promise<SecretaryCapture> {
    const id = readId(row.id);
    const decrypted = await decryptProtectedFields(
      this.keyProvider,
      { ownerId, nodeId: id, domain: PERSONAL_DOMAIN },
      { content: parseEnvelope(readDatabaseBytes(row.contentEnvelope)) },
    );
    const capture = createSecretaryCapture({ id, content: decrypted.content, createdAt: parseDate(row.createdAt) });
    if (capture.kind !== row.kind || capture.ambiguity !== row.ambiguity) throw secretaryFailure();
    return capture;
  }

  /** Decrypts one task row while retaining exact due/status metadata. */
  private async readTask(ownerId: string, row: Record<string, unknown>): Promise<SecretaryTask> {
    const id = readId(row.id);
    const decrypted = await decryptProtectedFields(
      this.keyProvider,
      { ownerId, nodeId: id, domain: PERSONAL_DOMAIN },
      { title: parseEnvelope(readDatabaseBytes(row.titleEnvelope)) },
    );
    if (typeof decrypted.title !== "string") throw secretaryFailure();
    const createdAt = parseDate(row.createdAt);
    const completedAt = row.completedAt === null || row.completedAt === undefined ? null : parseDate(row.completedAt).toISOString();
    const status = row.status === "open" || row.status === "completed" ? row.status : undefined;
    const dueAt = row.dueAt === null || row.dueAt === undefined ? null : parseDate(row.dueAt).toISOString();
    if (!status || typeof row.timeZone !== "string") throw secretaryFailure();
    return {
      id,
      title: decrypted.title,
      dueAt,
      timeZone: row.timeZone,
      status,
      createdAt: createdAt.toISOString(),
      completedAt,
    };
  }

  /** Decrypts one active note row after strict status and timestamp checks. */
  private async readNote(ownerId: string, row: Record<string, unknown>): Promise<SecretaryNote> {
    const id = readId(row.id);
    if (row.status !== "active") throw secretaryFailure();
    const decrypted = await decryptProtectedFields(
      this.keyProvider,
      { ownerId, nodeId: id, domain: PERSONAL_DOMAIN },
      {
        title: parseEnvelope(readDatabaseBytes(row.titleEnvelope)),
        body: parseEnvelope(readDatabaseBytes(row.bodyEnvelope)),
      },
    );
    if (typeof decrypted.title !== "string" || typeof decrypted.body !== "string") throw secretaryFailure();
    return {
      id,
      title: decrypted.title,
      body: decrypted.body,
      status: "active",
      createdAt: parseDate(row.createdAt).toISOString(),
      updatedAt: parseDate(row.updatedAt).toISOString(),
    };
  }

  /** Decrypts one follow-up after its owner-scoped SQL lookup and validates lifecycle metadata. */
  private async readFollowUp(ownerId: string, row: Record<string, unknown>): Promise<FollowUp> {
    const id = readId(row.id);
    const decrypted = await decryptProtectedFields(
      this.keyProvider,
      { ownerId, nodeId: id, domain: PERSONAL_DOMAIN },
      {
        title: parseEnvelope(readDatabaseBytes(row.titleEnvelope)),
        sourceFactIds: parseEnvelope(readDatabaseBytes(row.sourceFactIdsEnvelope)),
      },
    );
    if (typeof decrypted.title !== "string" || typeof decrypted.sourceFactIds !== "string") throw secretaryFailure();
    let sourceFactIds: unknown;
    try { sourceFactIds = JSON.parse(decrypted.sourceFactIds); } catch { throw secretaryFailure(); }
    if (!Array.isArray(sourceFactIds) || !sourceFactIds.every((value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value))) {
      throw secretaryFailure();
    }
    const status = row.status === "open" || row.status === "snoozed" || row.status === "completed" ? row.status : undefined;
    if (!status || typeof row.timeZone !== "string") throw secretaryFailure();
    const dueAt = row.dueAt === null || row.dueAt === undefined ? null : parseDate(row.dueAt).toISOString();
    const snoozedUntil = row.snoozedUntil === null || row.snoozedUntil === undefined ? null : parseDate(row.snoozedUntil).toISOString();
    const completedAt = row.completedAt === null || row.completedAt === undefined ? null : parseDate(row.completedAt).toISOString();
    const createdAt = parseDate(row.createdAt).toISOString();
    const updatedAt = parseDate(row.updatedAt).toISOString();
    if ((status === "completed") !== (completedAt !== null) || (status === "snoozed") !== (snoozedUntil !== null)) throw secretaryFailure();
    return {
      id,
      title: decrypted.title,
      dueAt,
      timeZone: row.timeZone,
      sourceFactIds,
      status,
      createdAt,
      updatedAt,
      snoozedUntil,
      completedAt,
    };
  }
}

/** Produces the constant repository error while preserving an already-safe error. */
function normalizeSecretaryError(error: unknown): Error {
  return error instanceof SecretaryRepositoryError ? error : secretaryFailure();
}

/** Creates one constant persistence failure. */
function secretaryFailure(): SecretaryRepositoryError {
  return new SecretaryRepositoryError();
}

/** Validates owner identity before it becomes an SQL parameter or crypto context. */
function assertOwnerId(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_OWNER_ID_CHARS || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw secretaryFailure();
  }
}

/** Validates an opaque secretary record identity. */
function assertId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) throw secretaryFailure();
}

/** Reads a bounded record identity from a database row. */
function readId(value: unknown): string {
  assertId(value);
  return value;
}

/** Validates an explicit Date instance. */
function assertDate(value: unknown): asserts value is Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw secretaryFailure();
}

/** Validates an IANA timezone without using the process default. */
function assertTimeZone(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 255) throw secretaryFailure();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
  } catch {
    throw secretaryFailure();
  }
}

/** Parses a database timestamp only when it is an explicit Date or offset-bearing string. */
function parseDate(value: unknown): Date {
  if (value instanceof Date) {
    assertDate(value);
    return new Date(value.getTime());
  }
  if (typeof value === "string" && /(?:Z|[+-]\d{2}:?\d{2})$/u.test(value)) {
    const parsed = new Date(value);
    assertDate(parsed);
    return parsed;
  }
  throw secretaryFailure();
}

/** Decodes native or canonical PostgreSQL bytea before envelope validation. */
function readDatabaseBytes(value: unknown): string {
  if (value instanceof Uint8Array) return textDecoder.decode(value);
  if (typeof value === "string" && /^\\x[0-9a-f]*$/iu.test(value)) {
    const bytes = new Uint8Array((value.length - 2) / 2);
    for (let index = 2; index < value.length; index += 2) bytes[(index - 2) / 2] = Number.parseInt(value.slice(index, index + 2), 16);
    return textDecoder.decode(bytes);
  }
  throw secretaryFailure();
}

/** Parses one bounded serialized cipher envelope after the database bytea decode. */
function parseEnvelope(value: string): CipherEnvelope {
  try {
    return parseCipherEnvelope(value);
  } catch {
    throw secretaryFailure();
  }
}

/** Serializes the validated protected-field envelope as bounded bytea text. */
function encodeEnvelope(envelope: CipherEnvelope | null): string {
  if (envelope === null) throw secretaryFailure();
  return serializeCipherEnvelope(envelope);
}

/** Converts a planning-only event row into the provider-neutral scheduling block. */
function planningEventFromRow(row: Record<string, unknown>) {
  const id = readId(row.id);
  const startsAt = parseDate(row.startsAt).toISOString();
  const endsAt = parseDate(row.endsAt).toISOString();
  const status = row.status === "confirmed" || row.status === "tentative" || row.status === "cancelled" ? row.status : undefined;
  if (endsAt <= startsAt || typeof row.timeZone !== "string" || typeof row.busy !== "boolean" || !status) throw secretaryFailure();
  return {
    id,
    title: "Calendar event",
    startsAt,
    endsAt,
    timeZone: row.timeZone,
    busy: row.busy,
    status,
    sourceFactId: `event:${id}`,
  } as const;
}

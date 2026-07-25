/** Reads owner-scoped operational facts and decrypts only authorized event display fields. */
import { sql } from "drizzle-orm";
import {
  MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS,
  parseCipherEnvelope,
  type CipherEnvelope,
} from "../../crypto/envelope";
import type { KeyProvider } from "../../crypto/key-provider";
import { decryptProtectedFields } from "../../crypto/protected-fields";
import { getChicagoBudgetMonth } from "../../domain/budget/ai-budget";
import type { Domain } from "../../domain/categorization/category";
import type {
  DiagnosticCheckpointStatus,
  DiagnosticSafeErrorCode,
  FoundationHealthFacts,
} from "../../domain/operations/health";
import type { VisionDatabase } from "../db";

/** Safe event display shape returned after owner authorization and title decryption. */
export interface DiagnosticEvent {
  readonly id: string;
  readonly title: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timeZone: string;
  readonly status: "confirmed" | "tentative" | "cancelled";
  readonly domain: Domain;
  readonly domainState: "confirmed" | "inferred" | "unresolved";
  readonly categoryProvenance: "provider" | "user" | "system" | "model";
}

/** Safe explicit category result retained only inside Vision. */
export interface DiagnosticCategoryCorrection {
  readonly id: string;
  readonly domain: "school" | "work" | "personal";
  readonly domainState: "confirmed";
  readonly categoryProvenance: "user";
  readonly assignedAt: string;
  readonly version: number;
}

/** Owner-scoped persistence operations available to authenticated diagnostic routes. */
export interface DiagnosticRepositoryPort {
  readFoundationFacts(now: Date): Promise<FoundationHealthFacts>;
  listEvents(): Promise<readonly DiagnosticEvent[]>;
  correctCategory(
    eventId: string,
    domain: "school" | "work" | "personal",
    assignedAt: Date,
  ): Promise<DiagnosticCategoryCorrection | undefined>;
}

/** Usage warnings supplied by release monitoring without exposing provider metrics. */
export interface DiagnosticUsageWarnings {
  readonly databaseUsageWarning: boolean;
  readonly r2UsageWarning: boolean;
}

type DatabaseRow = Record<string, unknown>;
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const CONCRETE_DOMAINS = ["school", "work", "personal"] as const;
const CHECKPOINT_STATUSES = [
  "pending",
  "connected",
  "disconnected",
  "action_required",
  "rebuild_required",
  "retry_scheduled",
] as const;
const SAFE_ERROR_CODES = [
  "authorization",
  "concurrency",
  "database",
  "provider",
  "payload_too_large",
  "quota",
  "schema",
  "sync_token_invalid",
  "transient",
] as const;

/** PostgreSQL implementation whose constructor fixes the only readable owner. */
class DiagnosticRepository implements DiagnosticRepositoryPort {
  constructor(
    private readonly database: VisionDatabase,
    private readonly keyProvider: KeyProvider,
    private readonly ownerId: string,
    private readonly usageWarnings: DiagnosticUsageWarnings,
  ) {}

  /** Aggregates content-free status facts for the authenticated owner and current Chicago month. */
  async readFoundationFacts(now: Date): Promise<FoundationHealthFacts> {
    assertDate(now);
    const budgetMonth = getChicagoBudgetMonth(now);
    const result = await this.database.execute<DatabaseRow>(sql`
      select
        case
          when not exists (
            select 1 from google_oauth_tokens token
            where token.owner_id = ${this.ownerId}
          ) then 'missing'
          when coalesce((
            select checkpoint.status
            from sync_checkpoints checkpoint
            where checkpoint.owner_id = ${this.ownerId}
              and checkpoint.provider = 'google-calendar'
            order by checkpoint.updated_at desc, checkpoint.id
            limit 1
          ), 'pending') = 'disconnected'
            or (
              select checkpoint.last_error_category
              from sync_checkpoints checkpoint
              where checkpoint.owner_id = ${this.ownerId}
                and checkpoint.provider = 'google-calendar'
              order by checkpoint.updated_at desc, checkpoint.id
              limit 1
            ) = 'authorization'
          then 'revoked'
          else 'connected'
        end as "authorizationState",
        coalesce((
          select checkpoint.status
          from sync_checkpoints checkpoint
          where checkpoint.owner_id = ${this.ownerId}
            and checkpoint.provider = 'google-calendar'
          order by checkpoint.updated_at desc, checkpoint.id
          limit 1
        ), 'pending') as "checkpointStatus",
        (
          select max(run.completed_at)
          from sync_runs run
          where run.owner_id = ${this.ownerId}
            and run.provider = 'google-calendar'
        ) as "lastSuccessfulSyncAt",
        (
          select min(job.created_at)
          from calendar_sync_jobs job
          where job.owner_id = ${this.ownerId}
            and job.provider = 'google-calendar'
            and job.status in (
              'pending_enqueue', 'enqueued', 'in_progress', 'retry_scheduled'
            )
        ) as "oldestQueuedJobAt",
        coalesce((
          select max(job.attempts)
          from calendar_sync_jobs job
          where job.owner_id = ${this.ownerId}
            and job.provider = 'google-calendar'
            and job.status in (
              'pending_enqueue', 'enqueued', 'in_progress', 'retry_scheduled'
            )
        ), 0) as "queueRetryCount",
        (
          select count(*)
          from calendar_sync_jobs job
          where job.owner_id = ${this.ownerId}
            and job.provider = 'google-calendar'
            and job.status = 'failed'
        ) as "failedJobCount",
        (
          select max(channel.expires_at)
          from sync_channels channel
          where channel.owner_id = ${this.ownerId}
            and channel.provider = 'google-calendar'
            and channel.lifecycle = 'active'
        ) as "channelExpiresAt",
        coalesce((
          select month.settled_cents + month.reserved_cents
          from ai_usage_months month
          where month.owner_id = ${this.ownerId}
            and month.budget_month = ${budgetMonth}
        ), 0) as "aiMonthlyCents",
        (
          select checkpoint.last_error_category
          from sync_checkpoints checkpoint
          where checkpoint.owner_id = ${this.ownerId}
            and checkpoint.provider = 'google-calendar'
          order by checkpoint.updated_at desc, checkpoint.id
          limit 1
        ) as "safeErrorCode"
    `);
    const row = result.rows[0];
    if (!row) throw new Error("Diagnostic facts were unavailable.");
    return {
      authorizationState: decodeEnum(
        row.authorizationState,
        ["connected", "missing", "revoked"] as const,
      ),
      checkpointStatus: decodeEnum(
        row.checkpointStatus,
        CHECKPOINT_STATUSES,
      ) as DiagnosticCheckpointStatus,
      lastSuccessfulSyncAt: decodeNullableDate(row.lastSuccessfulSyncAt),
      oldestQueuedJobAt: decodeNullableDate(row.oldestQueuedJobAt),
      queueRetryCount: decodeNonnegativeInteger(row.queueRetryCount),
      failedJobCount: decodeNonnegativeInteger(row.failedJobCount),
      channelExpiresAt: decodeNullableDate(row.channelExpiresAt),
      databaseAvailable: true,
      databaseUsageWarning: this.usageWarnings.databaseUsageWarning,
      r2UsageWarning: this.usageWarnings.r2UsageWarning,
      aiMonthlyCents: decodeNonnegativeInteger(row.aiMonthlyCents),
      safeErrorCode:
        row.safeErrorCode === null || row.safeErrorCode === undefined
          ? null
          : (decodeEnum(
              row.safeErrorCode,
              SAFE_ERROR_CODES,
            ) as DiagnosticSafeErrorCode),
    };
  }

  /** Decrypts only event titles selected inside the fixed authenticated owner scope. */
  async listEvents(): Promise<readonly DiagnosticEvent[]> {
    const result = await this.database.execute<DatabaseRow>(sql`
      select
        node.id,
        event.title_envelope as "titleEnvelope",
        event.protected_key_version as "protectedKeyVersion",
        event.starts_at as "startsAt",
        event.ends_at as "endsAt",
        event.time_zone as "timeZone",
        event.status,
        node.domain,
        node.domain_state as "domainState",
        coalesce(assignment.provenance, node.provenance) as "categoryProvenance"
      from nodes node
      inner join events event
        on event.node_id = node.id and event.owner_id = node.owner_id
      left join node_category_assignments assignment
        on assignment.node_id = node.id and assignment.owner_id = node.owner_id
      where node.owner_id = ${this.ownerId}
        and node.node_type = 'event'
        and node.lifecycle = 'active'
      order by event.starts_at, node.id
      limit 200
    `);
    return Object.freeze(
      await Promise.all(result.rows.map((row) => this.decodeEvent(row))),
    );
  }

  /** Atomically overwrites weaker inference with a user-confirmed Vision-only category fact. */
  async correctCategory(
    eventId: string,
    domain: "school" | "work" | "personal",
    assignedAt: Date,
  ): Promise<DiagnosticCategoryCorrection | undefined> {
    validateEventId(eventId);
    if (!CONCRETE_DOMAINS.includes(domain)) {
      throw new Error("Invalid category correction.");
    }
    assertDate(assignedAt);
    const result = await this.database.execute<DatabaseRow>(sql`
      with updated as (
        update nodes
        set
          domain = ${domain},
          domain_state = 'confirmed',
          provenance = 'user',
          model_confidence = null,
          updated_at = greatest(updated_at, ${assignedAt}),
          version = version + 1
        where id = ${eventId}
          and owner_id = ${this.ownerId}
          and node_type = 'event'
          and lifecycle = 'active'
        returning id, owner_id, domain, version
      ),
      assigned as (
        insert into node_category_assignments (
          node_id, owner_id, domain, domain_state, provenance, assigned_at,
          version
        )
        select
          updated.id, updated.owner_id, updated.domain, 'confirmed', 'user',
          ${assignedAt}, updated.version
        from updated
        on conflict (node_id) do update set
          owner_id = excluded.owner_id,
          domain = excluded.domain,
          domain_state = 'confirmed',
          provenance = 'user',
          assigned_at = excluded.assigned_at,
          version = excluded.version
        where node_category_assignments.owner_id = excluded.owner_id
        returning node_id as id, domain, assigned_at as "assignedAt", version
      )
      select * from assigned
    `);
    const row = result.rows[0];
    if (!row) return undefined;
    return Object.freeze({
      id: decodeText(row.id, 128),
      domain: decodeEnum(row.domain, CONCRETE_DOMAINS),
      domainState: "confirmed",
      categoryProvenance: "user",
      assignedAt: decodeDate(row.assignedAt).toISOString(),
      version: decodePositiveInteger(row.version),
    });
  }

  /** Validates one selected row before decrypting its title with exact row key metadata. */
  private async decodeEvent(row: DatabaseRow): Promise<DiagnosticEvent> {
    const id = decodeText(row.id, 128);
    const domain = decodeEnum(
      row.domain,
      ["school", "work", "personal", "unresolved"] as const,
    );
    const protectedKeyVersion = decodePositiveInteger(row.protectedKeyVersion);
    const titleEnvelope =
      row.titleEnvelope === null
        ? null
        : parseCipherEnvelope(
            textDecoder.decode(decodeBytea(row.titleEnvelope)),
          );
    if (
      titleEnvelope !== null &&
      titleEnvelope.keyVersion !== protectedKeyVersion
    ) {
      throw new Error("Protected event key metadata is inconsistent.");
    }
    const decrypted =
      titleEnvelope === null
        ? { title: null }
        : await decryptProtectedFields(
            this.keyProvider,
            { ownerId: this.ownerId, nodeId: id, domain },
            { title: titleEnvelope },
          );
    return Object.freeze({
      id,
      title: decrypted.title,
      startsAt: decodeDate(row.startsAt).toISOString(),
      endsAt: decodeDate(row.endsAt).toISOString(),
      timeZone: decodeText(row.timeZone, 255),
      status: decodeEnum(
        row.status,
        ["confirmed", "tentative", "cancelled"] as const,
      ),
      domain,
      domainState: decodeEnum(
        row.domainState,
        ["confirmed", "inferred", "unresolved"] as const,
      ),
      categoryProvenance: decodeEnum(
        row.categoryProvenance,
        ["provider", "user", "system", "model"] as const,
      ),
    });
  }
}

/** Creates an authenticated-owner repository with externally measured warning flags. */
export function createDiagnosticRepository(
  database: VisionDatabase,
  keyProvider: KeyProvider,
  ownerId: string,
  usageWarnings: DiagnosticUsageWarnings,
): DiagnosticRepositoryPort {
  if (
    typeof ownerId !== "string" ||
    ownerId.length === 0 ||
    ownerId.length > 128 ||
    typeof usageWarnings.databaseUsageWarning !== "boolean" ||
    typeof usageWarnings.r2UsageWarning !== "boolean"
  ) {
    throw new Error("Invalid diagnostic repository scope.");
  }
  return new DiagnosticRepository(
    database,
    keyProvider,
    ownerId,
    Object.freeze({ ...usageWarnings }),
  );
}

/** Reads one bounded enum database cell without coercion. */
function decodeEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error("Invalid diagnostic database row.");
  }
  return value as T[number];
}

/** Reads one bounded non-empty text database cell. */
function decodeText(value: unknown, maximum: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximum
  ) {
    throw new Error("Invalid diagnostic database row.");
  }
  return value;
}

/** Reads one timezone-aware database date without accepting invalid values. */
function decodeDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }
  if (
    typeof value !== "string" ||
    !/(?:z|[+-]\d{2}(?::\d{2})?)$/iu.test(value)
  ) {
    throw new Error("Invalid diagnostic database row.");
  }
  const normalized = /[+-]\d{2}$/u.test(value) ? `${value}:00` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid diagnostic database row.");
  }
  return parsed;
}

/** Reads a nullable timezone-aware database date. */
function decodeNullableDate(value: unknown): Date | null {
  return value === null || value === undefined ? null : decodeDate(value);
}

/** Reads one nonnegative aggregate count or cent value. */
function decodeNonnegativeInteger(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "bigint"
        ? Number(value)
        : typeof value === "string" && /^(?:0|[1-9]\d*)$/u.test(value)
          ? Number(value)
          : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Invalid diagnostic database row.");
  }
  return parsed;
}

/** Reads one positive version or key integer. */
function decodePositiveInteger(value: unknown): number {
  const parsed = decodeNonnegativeInteger(value);
  if (parsed <= 0) throw new Error("Invalid diagnostic database row.");
  return parsed;
}

/** Reads canonical PostgreSQL bytea or copies an already-decoded byte array. */
function decodeBytea(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    if (
      value.byteLength === 0 ||
      value.byteLength > MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS
    ) {
      throw new Error("Invalid diagnostic database row.");
    }
    return value.slice();
  }
  if (
    typeof value !== "string" ||
    !/^\\x(?:[0-9a-f]{2})+$/u.test(value) ||
    (value.length - 2) / 2 > MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS
  ) {
    throw new Error("Invalid diagnostic database row.");
  }
  const bytes = new Uint8Array((value.length - 2) / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(
      value.slice(2 + index * 2, 4 + index * 2),
      16,
    );
  }
  return bytes;
}

/** Validates a finite Date used as a consistency timestamp. */
function assertDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("Invalid diagnostic timestamp.");
  }
}

/** Validates one bounded opaque route identity before a parameterized query. */
function validateEventId(eventId: string): void {
  if (
    typeof eventId !== "string" ||
    eventId.length === 0 ||
    eventId.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(eventId)
  ) {
    throw new Error("Invalid category correction.");
  }
}

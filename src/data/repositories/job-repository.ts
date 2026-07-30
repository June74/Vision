/** Persists verified Google notification jobs and provides atomic at-least-once claims. */
import { sql } from "drizzle-orm";
import type { VisionDatabase } from "../db";
import type { CalendarSyncMessage } from "../../jobs/queue-message";
import type {
  SyncCalendarErrorCategory,
  SyncFailureState,
  SyncResult,
} from "../../jobs/sync-calendar";

const NOTIFICATION_JOB_IDENTITY_CONFLICT =
  "Notification job identity conflict.";

/** Queryable, content-free Google channel facts required to authenticate a notification. */
export interface GoogleWebhookChannel {
  readonly ownerId: string;
  readonly calendarId: string;
  readonly providerChannelId: string;
  readonly providerResourceId: string | null;
  readonly verificationTokenHash: string;
  readonly expiresAt: Date;
  readonly lifecycle: "pending" | "active";
}

/** Indicates whether a durable webhook job still needs its first queue send. */
export interface ReserveWebhookJobResult {
  readonly message: CalendarSyncMessage;
  readonly shouldEnqueue: boolean;
}

/** Exact lease returned by one successful durable job claim. */
export interface ClaimedCalendarJob {
  readonly message: CalendarSyncMessage;
  readonly claimId: string;
  readonly attempt: number;
  readonly checkpointVersion: number;
}

/** One claim-bound job and checkpoint failure transition. */
export interface ClaimedFailureTransition {
  readonly jobId: string;
  readonly claimId: string;
  readonly expectedCheckpointVersion: number;
  readonly status: "retry_scheduled" | "failed";
  readonly category: SyncCalendarErrorCategory;
  readonly state: SyncFailureState;
  readonly now: Date;
}

/** Safe result of attempting to claim an at-least-once queue delivery. */
export type ClaimCalendarJobResult =
  | { readonly outcome: "claimed"; readonly job: ClaimedCalendarJob }
  | { readonly outcome: "duplicate" }
  | { readonly outcome: "missing" };

/** Persistence surface shared by the webhook and queue consumer. */
export interface CalendarJobRepository {
  findGoogleChannel(
    providerChannelId: string,
    verificationTokenHash: string,
  ): Promise<GoogleWebhookChannel | undefined>;
  bindPendingGoogleChannelResource(
    providerChannelId: string,
    verificationTokenHash: string,
    providerResourceId: string,
  ): Promise<GoogleWebhookChannel | undefined>;
  inspectWebhookReplay(
    message: CalendarSyncMessage,
  ): Promise<"new" | "replay">;
  reserveWebhookJob(
    message: CalendarSyncMessage,
    now?: Date,
  ): Promise<ReserveWebhookJobResult>;
  markEnqueued(jobId: string, now?: Date): Promise<void>;
  claimJob(
    message: CalendarSyncMessage,
    deliveryAttempt: number,
    claimId: string,
    now: Date,
  ): Promise<ClaimCalendarJobResult>;
  completeJob(
    jobId: string,
    claimId: string,
    result: SyncResult,
    now: Date,
  ): Promise<boolean>;
  scheduleRetry(
    jobId: string,
    claimId: string,
    category: SyncCalendarErrorCategory,
    now: Date,
  ): Promise<boolean>;
  failJob(
    jobId: string,
    claimId: string,
    category: SyncCalendarErrorCategory,
    actionRequired: boolean,
    now: Date,
  ): Promise<boolean>;
  finishClaimedFailure(transition: ClaimedFailureTransition): Promise<boolean>;
}

/** PostgreSQL implementation whose state transitions are guarded by exact claim leases. */
class DrizzleCalendarJobRepository implements CalendarJobRepository {
  /** Binds job and channel operations to Vision's authoritative database. */
  constructor(private readonly database: VisionDatabase) {}

  /** Resolves one Google channel by both its public ID and fixed-size secret-token digest. */
  async findGoogleChannel(
    providerChannelId: string,
    verificationTokenHash: string,
  ): Promise<GoogleWebhookChannel | undefined> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        channel.owner_id as "ownerId",
        channel.provider_calendar_id as "calendarId",
        channel.provider_channel_id as "providerChannelId",
        channel.provider_resource_id as "providerResourceId",
        channel.verification_token_hash as "verificationTokenHash",
        channel.expires_at as "expiresAt",
        channel.lifecycle as "lifecycle"
      from sync_channels as channel
      inner join sync_checkpoints as checkpoint
        on checkpoint.owner_id = channel.owner_id
       and checkpoint.provider = channel.provider
       and checkpoint.provider_calendar_id = channel.provider_calendar_id
       and checkpoint.status = 'connected'
      where channel.provider = 'google-calendar'
        and channel.provider_channel_id = ${providerChannelId}
        and channel.verification_token_hash = ${verificationTokenHash}
        and channel.lifecycle in ('pending', 'active')
      limit 1
    `);
    return result.rows[0] ? decodeChannel(result.rows[0]) : undefined;
  }

  /** Atomically binds Google's early sync resource to a pre-registered pending channel. */
  async bindPendingGoogleChannelResource(
    providerChannelId: string,
    verificationTokenHash: string,
    providerResourceId: string,
  ): Promise<GoogleWebhookChannel | undefined> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      update sync_channels as channel
      set provider_resource_id = ${providerResourceId}
      from sync_checkpoints as checkpoint
      where channel.provider = 'google-calendar'
        and channel.provider_channel_id = ${providerChannelId}
        and channel.verification_token_hash = ${verificationTokenHash}
        and channel.lifecycle = 'pending'
        and channel.provider_resource_id is null
        and checkpoint.owner_id = channel.owner_id
        and checkpoint.provider = channel.provider
        and checkpoint.provider_calendar_id = channel.provider_calendar_id
        and checkpoint.status = 'connected'
      returning
        channel.owner_id as "ownerId",
        channel.provider_calendar_id as "calendarId",
        channel.provider_channel_id as "providerChannelId",
        channel.provider_resource_id as "providerResourceId",
        channel.verification_token_hash as "verificationTokenHash",
        channel.expires_at as "expiresAt",
        channel.lifecycle as "lifecycle"
    `);
    return result.rows[0] ? decodeChannel(result.rows[0]) : undefined;
  }

  /** Reads one opaque job identity without inserting or updating durable state. */
  async inspectWebhookReplay(
    message: CalendarSyncMessage,
  ): Promise<"new" | "replay"> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        owner_id as "ownerId",
        provider,
        provider_calendar_id as "calendarId",
        reason
      from calendar_sync_jobs
      where job_id = ${message.jobId}
      limit 1
    `);
    const existing = result.rows[0];
    if (!existing) return "new";
    if (
      existing.ownerId !== message.ownerId ||
      existing.provider !== "google-calendar" ||
      existing.calendarId !== message.calendarId ||
      existing.reason !== message.reason
    ) {
      throw new Error(NOTIFICATION_JOB_IDENTITY_CONFLICT);
    }
    return "replay";
  }

  /** Inserts one stable notification job or returns its exact existing winner. */
  async reserveWebhookJob(
    message: CalendarSyncMessage,
    now: Date = new Date(),
  ): Promise<ReserveWebhookJobResult> {
    assertDate(now);
    const inserted = await this.database.execute<Record<string, unknown>>(sql`
      insert into calendar_sync_jobs (
        job_id, owner_id, provider, provider_calendar_id, reason,
        status, attempts, action_required, created_at, updated_at
      ) values (
        ${message.jobId}, ${message.ownerId}, 'google-calendar',
        ${message.calendarId}, ${message.reason}, 'pending_enqueue',
        0, false, ${now}, ${now}
      )
      on conflict (job_id) do nothing
      returning job_id as "jobId"
    `);
    if (inserted.rows[0]) {
      return { message, shouldEnqueue: true };
    }
    const existing = await this.database.execute<Record<string, unknown>>(sql`
      select
        job_id as "jobId",
        owner_id as "ownerId",
        provider_calendar_id as "calendarId",
        reason,
        status
      from calendar_sync_jobs
      where job_id = ${message.jobId}
        and owner_id = ${message.ownerId}
        and provider = 'google-calendar'
        and provider_calendar_id = ${message.calendarId}
        and reason = ${message.reason}
      limit 1
    `);
    if (!existing.rows[0]) {
      throw new Error(NOTIFICATION_JOB_IDENTITY_CONFLICT);
    }
    const winner = decodeMessage(existing.rows[0]);
    return {
      message: winner,
      shouldEnqueue: readText(existing.rows[0].status) === "pending_enqueue",
    };
  }

  /** Marks a successfully sent first delivery without disturbing a consumer claim. */
  async markEnqueued(jobId: string, now: Date = new Date()): Promise<void> {
    assertDate(now);
    await this.database.execute(sql`
      update calendar_sync_jobs
      set status = 'enqueued', updated_at = ${now}
      where job_id = ${jobId} and status = 'pending_enqueue'
    `);
  }

  /** Claims one exact message, reconciling a prior committed sync before any replay. */
  async claimJob(
    message: CalendarSyncMessage,
    deliveryAttempt: number,
    claimId: string,
    now: Date,
  ): Promise<ClaimCalendarJobResult> {
    assertAttempt(deliveryAttempt);
    assertClaimId(claimId);
    assertDate(now);
    const result = await this.database.execute<Record<string, unknown>>(sql`
      with reconciled as (
        update calendar_sync_jobs as job
        set
          status = 'succeeded',
          completed_at = run.completed_at,
          checkpoint_version = run.checkpoint_version,
          page_count = run.page_count,
          staged_count = run.staged_count,
          upserted_count = run.upserted_count,
          deleted_count = run.deleted_count,
          unchanged_count = run.unchanged_count,
          claim_id = null,
          last_error_category = null,
          action_required = false,
          updated_at = ${now}
        from sync_runs as run
        where job.job_id = ${message.jobId}
          and run.job_id = job.job_id
          and job.status not in ('succeeded', 'failed')
        returning job.job_id
      ),
      claimed as (
        update calendar_sync_jobs as job
        set
          status = 'in_progress',
          attempts = greatest(job.attempts + 1, ${deliveryAttempt}),
          claim_id = ${claimId},
          claimed_at = ${now},
          updated_at = ${now}
        where job.job_id = ${message.jobId}
          and job.owner_id = ${message.ownerId}
          and job.provider = 'google-calendar'
          and job.provider_calendar_id = ${message.calendarId}
          and job.reason = ${message.reason}
          and not exists (select 1 from reconciled)
          and (
            job.status in ('pending_enqueue', 'enqueued', 'retry_scheduled')
            or (
              job.status = 'in_progress'
              and job.attempts < ${deliveryAttempt}
            )
          )
        returning job.attempts
      )
      select
        attempts,
        coalesce((
          select checkpoint.version
          from sync_checkpoints as checkpoint
          where checkpoint.owner_id = ${message.ownerId}
            and checkpoint.provider = 'google-calendar'
            and checkpoint.provider_calendar_id = ${message.calendarId}
          limit 1
        ), 0) as "checkpointVersion"
      from claimed
    `);
    if (result.rows[0]) {
      return {
        outcome: "claimed",
        job: {
          message,
          claimId,
          attempt: readPositiveInteger(result.rows[0].attempts),
          checkpointVersion: readNonNegativeInteger(
            result.rows[0].checkpointVersion,
          ),
        },
      };
    }
    const existing = await this.database.execute<Record<string, unknown>>(sql`
      select owner_id as "ownerId", provider_calendar_id as "calendarId", reason
      from calendar_sync_jobs
      where job_id = ${message.jobId} and provider = 'google-calendar'
      limit 1
    `);
    if (!existing.rows[0]) return { outcome: "missing" };
    const winner = decodeMessage({ ...existing.rows[0], jobId: message.jobId });
    return winner.ownerId === message.ownerId &&
      winner.calendarId === message.calendarId &&
      winner.reason === message.reason
      ? { outcome: "duplicate" }
      : { outcome: "missing" };
  }

  /** Completes only the currently leased job and stores content-free sync metrics. */
  async completeJob(
    jobId: string,
    claimId: string,
    result: SyncResult,
    now: Date,
  ): Promise<boolean> {
    assertClaimId(claimId);
    assertDate(now);
    const updated = await this.database.execute<Record<string, unknown>>(sql`
      update calendar_sync_jobs
      set
        status = 'succeeded',
        checkpoint_version = ${result.checkpointVersion},
        page_count = ${result.pages},
        staged_count = ${result.staged},
        upserted_count = ${result.upserted},
        deleted_count = ${result.deleted},
        unchanged_count = ${result.unchanged},
        completed_at = ${now},
        claim_id = null,
        last_error_category = null,
        action_required = false,
        updated_at = ${now}
      where job_id = ${jobId}
        and status = 'in_progress'
        and claim_id = ${claimId}
      returning job_id as "jobId"
    `);
    return updated.rows.length === 1;
  }

  /** Releases one current lease for bounded queue redelivery. */
  async scheduleRetry(
    jobId: string,
    claimId: string,
    category: SyncCalendarErrorCategory,
    now: Date,
  ): Promise<boolean> {
    return this.finishFailure(
      jobId,
      claimId,
      "retry_scheduled",
      category,
      false,
      now,
    );
  }

  /** Persists one permanent or retry-exhausted safe failure classification. */
  async failJob(
    jobId: string,
    claimId: string,
    category: SyncCalendarErrorCategory,
    actionRequired: boolean,
    now: Date,
  ): Promise<boolean> {
    return this.finishFailure(
      jobId,
      claimId,
      "failed",
      category,
      actionRequired,
      now,
    );
  }

  /** Atomically changes checkpoint health and job disposition only for the current exact lease. */
  async finishClaimedFailure(
    transition: ClaimedFailureTransition,
  ): Promise<boolean> {
    assertClaimId(transition.claimId);
    assertDate(transition.now);
    if (
      !Number.isSafeInteger(transition.expectedCheckpointVersion) ||
      transition.expectedCheckpointVersion < 0
    ) {
      throw new Error("Invalid checkpoint version.");
    }
    const actionRequired = transition.state === "action_required";
    const updated = await this.database.execute<Record<string, unknown>>(sql`
      with active_claim as materialized (
        select owner_id, provider_calendar_id
        from calendar_sync_jobs
        where job_id = ${transition.jobId}
          and status = 'in_progress'
          and claim_id = ${transition.claimId}
        for update
      ),
      checkpoint_failure as (
        update sync_checkpoints as checkpoint
        set
          status = ${transition.state},
          last_error_category = ${transition.category},
          updated_at = ${transition.now}
        where checkpoint.provider = 'google-calendar'
          and checkpoint.version = ${transition.expectedCheckpointVersion}
          and exists (
            select 1
            from active_claim
            where owner_id = checkpoint.owner_id
              and provider_calendar_id = checkpoint.provider_calendar_id
          )
        returning checkpoint.id
      ),
      job_failure as (
        update calendar_sync_jobs as job
        set
          status = ${transition.status},
          last_error_category = ${transition.category},
          action_required = ${actionRequired},
          completed_at = case
            when ${transition.status} = 'failed'
            then ${transition.now}::timestamptz
            else null
          end,
          claim_id = null,
          updated_at = ${transition.now}
        where job.job_id = ${transition.jobId}
          and job.status = 'in_progress'
          and job.claim_id = ${transition.claimId}
          and exists (select 1 from active_claim)
        returning job.job_id as "jobId"
      )
      select "jobId" from job_failure
    `);
    return updated.rows.length === 1;
  }

  /** Applies a claim-guarded failure transition without retaining exception text. */
  private async finishFailure(
    jobId: string,
    claimId: string,
    status: "retry_scheduled" | "failed",
    category: SyncCalendarErrorCategory,
    actionRequired: boolean,
    now: Date,
  ): Promise<boolean> {
    assertClaimId(claimId);
    assertDate(now);
    const updated = await this.database.execute<Record<string, unknown>>(sql`
      update calendar_sync_jobs
      set
        status = ${status},
        last_error_category = ${category},
        action_required = ${actionRequired},
        completed_at = case when ${status} = 'failed' then ${now}::timestamptz else null end,
        claim_id = null,
        updated_at = ${now}
      where job_id = ${jobId}
        and status = 'in_progress'
        and claim_id = ${claimId}
      returning job_id as "jobId"
    `);
    return updated.rows.length === 1;
  }
}

/** Creates the production calendar job repository over a typed database. */
export function createCalendarJobRepository(
  database: VisionDatabase,
): CalendarJobRepository {
  return new DrizzleCalendarJobRepository(database);
}

/** Decodes one channel row without ever retaining its encrypted recovery token. */
function decodeChannel(row: Record<string, unknown>): GoogleWebhookChannel {
  const expiresAt = readDate(row.expiresAt);
  return {
    ownerId: readText(row.ownerId),
    calendarId: readText(row.calendarId),
    providerChannelId: readText(row.providerChannelId),
    providerResourceId:
      row.providerResourceId === null ? null : readText(row.providerResourceId),
    verificationTokenHash: readHash(row.verificationTokenHash),
    expiresAt,
    lifecycle: readChannelLifecycle(row.lifecycle),
  };
}

/** Accepts only a notification-verifiable channel lifecycle. */
function readChannelLifecycle(value: unknown): "pending" | "active" {
  if (value !== "pending" && value !== "active") {
    throw new Error("Invalid Google channel row.");
  }
  return value;
}

/** Decodes only the four opaque fields permitted in a queue message. */
function decodeMessage(row: Record<string, unknown>): CalendarSyncMessage {
  const reason = readText(row.reason);
  if (!["initial", "manual", "push", "rebuild", "repair"].includes(reason)) {
    throw new Error("Invalid calendar job row.");
  }
  return {
    jobId: readText(row.jobId),
    ownerId: readText(row.ownerId),
    calendarId: readText(row.calendarId),
    reason: reason as CalendarSyncMessage["reason"],
  };
}

/** Reads one non-empty database text value. */
function readText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Invalid calendar job row.");
  }
  return value;
}

/** Reads one canonical SHA-256 base64url digest. */
function readHash(value: unknown): string {
  const hash = readText(value);
  if (!/^[A-Za-z0-9_-]{43}$/u.test(hash)) {
    throw new Error("Invalid calendar channel digest.");
  }
  return hash;
}

/** Reads a positive safe database integer or decimal representation. */
function readPositiveInteger(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^[1-9]\d*$/u.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid calendar job row.");
  }
  return parsed;
}

/** Reads a non-negative safe database integer or decimal representation. */
function readNonNegativeInteger(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^(?:0|[1-9]\d*)$/u.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Invalid calendar job row.");
  }
  return parsed;
}

/** Reads a genuine or offset-bearing database timestamp. */
function readDate(value: unknown): Date {
  const parsed =
    value instanceof Date
      ? new Date(Date.prototype.getTime.call(value))
      : typeof value === "string" && /(?:z|[+-]\d{2}(?::?\d{2})?)$/iu.test(value)
        ? new Date(value)
        : new Date(Number.NaN);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid calendar job row.");
  return parsed;
}

/** Validates a queue delivery attempt before it enters SQL state transitions. */
function assertAttempt(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1_000) {
    throw new Error("Invalid calendar queue attempt.");
  }
}

/** Validates a content-free lease identifier. */
function assertClaimId(value: string): void {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    throw new Error("Invalid calendar job claim.");
  }
}

/** Validates repository timestamps through the trusted Date intrinsic. */
function assertDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(Date.prototype.getTime.call(value))) {
    throw new Error("Invalid calendar job timestamp.");
  }
}

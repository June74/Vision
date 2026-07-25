/** Persists race-safe Google channel lifecycle and scheduled repair reservations. */
import { sql } from "drizzle-orm";
import type { VisionDatabase } from "../db";
import type {
  ActiveGoogleChannel,
  ChannelLifecycleRepository,
  RenewalCandidate,
} from "../../jobs/renew-google-channels";
import type {
  RepairCalendar,
  RepairRepository,
} from "../../jobs/repair-calendar-sync";
import type { CalendarSyncMessage } from "../../jobs/queue-message";
import {
  createCalendarJobRepository,
  type CalendarJobRepository,
  type ReserveWebhookJobResult,
} from "./job-repository";

const RENEWAL_WINDOW_MS = 24 * 60 * 60_000;
const PENDING_WINDOW_MS = 10 * 60_000;
const REPAIR_STALE_MS = 15 * 60_000;

/** SQL-backed maintenance repository scoped to connected private Google calendars. */
export class ChannelMaintenanceRepository
  implements ChannelLifecycleRepository, RepairRepository
{
  readonly #jobs: CalendarJobRepository;

  /** Binds lifecycle and repair selection to Vision's least-privileged database handle. */
  constructor(
    private readonly database: VisionDatabase,
    private readonly ownerId: string,
  ) {
    readText(ownerId);
    this.#jobs = createCalendarJobRepository(database);
  }

  /** Lists connected calendars with no usable channel or one inside the bounded renewal window. */
  async listRenewalCandidates(now: Date): Promise<readonly RenewalCandidate[]> {
    const renewBefore = new Date(now.getTime() + RENEWAL_WINDOW_MS);
    const pendingAfter = new Date(now.getTime() - PENDING_WINDOW_MS);
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        checkpoint.owner_id as "ownerId",
        checkpoint.provider_calendar_id as "calendarId",
        active.id as "rowId",
        active.provider_channel_id as "channelId",
        active.provider_resource_id as "resourceId",
        active.expires_at as "expiresAt",
        coalesce(active.failure_count, 0) as "failureCount"
      from sync_checkpoints as checkpoint
      left join lateral (
        select channel.*
        from sync_channels as channel
        where channel.owner_id = checkpoint.owner_id
          and channel.provider = checkpoint.provider
          and channel.provider_calendar_id = checkpoint.provider_calendar_id
          and channel.lifecycle = 'active'
        order by channel.activated_at desc, channel.created_at desc
        limit 1
      ) as active on true
      where checkpoint.provider = 'google-calendar'
        and checkpoint.owner_id = ${this.ownerId}
        and checkpoint.status = 'connected'
        and (active.id is null or active.expires_at <= ${renewBefore})
        and not exists (
          select 1
          from sync_channels as pending
          where pending.owner_id = checkpoint.owner_id
            and pending.provider = checkpoint.provider
            and pending.provider_calendar_id = checkpoint.provider_calendar_id
            and pending.lifecycle = 'pending'
            and pending.created_at >= ${pendingAfter}
        )
      order by checkpoint.owner_id, checkpoint.provider_calendar_id
    `);
    return Object.freeze(result.rows.map(decodeRenewalCandidate));
  }

  /** Inserts the digest-backed pending row before the external watch request can emit sync. */
  async preRegister(input: {
    rowId: string;
    ownerId: string;
    calendarId: string;
    channelId: string;
    tokenHash: string;
    tokenEnvelope: Uint8Array;
    createdAt: Date;
  }): Promise<void> {
    this.assertOwner(input.ownerId);
    const provisionalExpiry = new Date(input.createdAt.getTime() + PENDING_WINDOW_MS);
    await this.database.execute(sql`
      insert into sync_channels (
        id, owner_id, provider, provider_calendar_id, provider_channel_id,
        provider_resource_id, verification_token_envelope,
        verification_token_hash, expires_at, lifecycle, created_at,
        failure_count
      ) values (
        ${input.rowId}, ${input.ownerId}, 'google-calendar',
        ${input.calendarId}, ${input.channelId}, null,
        ${input.tokenEnvelope}, ${input.tokenHash}, ${provisionalExpiry},
        'pending', ${input.createdAt}, 0
      )
    `);
  }

  /** Activates only the same pending row and accepts an identical early-bound resource. */
  async activate(input: {
    rowId: string;
    resourceId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean> {
    const result = await this.database.execute(sql`
      update sync_channels
      set provider_resource_id = ${input.resourceId},
          expires_at = ${input.expiresAt},
          lifecycle = 'active',
          activated_at = ${input.now},
          retired_at = null,
          failure_count = 0,
          last_failure_at = null
      where id = ${input.rowId}
        and lifecycle = 'pending'
        and (
          provider_resource_id is null
          or provider_resource_id = ${input.resourceId}
        )
      returning id
    `);
    return result.rows.length === 1;
  }

  /** Retires only the exact old row after provider stop succeeds. */
  async retire(rowId: string, now: Date): Promise<boolean> {
    const result = await this.database.execute(sql`
      update sync_channels
      set lifecycle = 'retired', retired_at = ${now}
      where id = ${rowId} and lifecycle = 'active'
      returning id
    `);
    return result.rows.length === 1;
  }

  /** Records safe failure counters and exposes prolonged renewal failure on the checkpoint. */
  async recordFailure(input: {
    ownerId: string;
    calendarId: string;
    rowId: string;
    actionRequired: boolean;
    now: Date;
  }): Promise<void> {
    this.assertOwner(input.ownerId);
    await this.database.execute(sql`
      with failed_channel as (
        update sync_channels
        set failure_count = failure_count + 1,
            last_failure_at = ${input.now},
            lifecycle = case when lifecycle = 'pending' then 'failed' else lifecycle end
        where id = ${input.rowId}
          and owner_id = ${input.ownerId}
          and provider = 'google-calendar'
          and provider_calendar_id = ${input.calendarId}
        returning id
      )
      update sync_checkpoints
      set status = case when ${input.actionRequired} then 'action_required' else status end,
          last_error_category = case when ${input.actionRequired} then 'provider' else last_error_category end,
          updated_at = ${input.now}
      where ${input.actionRequired}
        and owner_id = ${input.ownerId}
        and provider = 'google-calendar'
        and provider_calendar_id = ${input.calendarId}
        and exists (select 1 from failed_channel)
    `);
  }

  /** Selects connected calendars with no successful sync in the last fifteen minutes. */
  async listRepairCandidates(now: Date): Promise<readonly RepairCalendar[]> {
    const staleBefore = new Date(now.getTime() - REPAIR_STALE_MS);
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        checkpoint.owner_id as "ownerId",
        checkpoint.provider_calendar_id as "calendarId",
        checkpoint.version as "checkpointVersion"
      from sync_checkpoints as checkpoint
      left join lateral (
        select max(run.completed_at) as completed_at
        from sync_runs as run
        where run.owner_id = checkpoint.owner_id
          and run.provider = checkpoint.provider
          and run.provider_calendar_id = checkpoint.provider_calendar_id
      ) as latest on true
      where checkpoint.provider = 'google-calendar'
        and checkpoint.owner_id = ${this.ownerId}
        and checkpoint.status = 'connected'
        and checkpoint.version > 0
        and (latest.completed_at is null or latest.completed_at <= ${staleBefore})
      order by checkpoint.owner_id, checkpoint.provider_calendar_id
    `);
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          ownerId: readText(row.ownerId),
          calendarId: readText(row.calendarId),
          checkpointVersion: readPositiveInteger(row.checkpointVersion),
        }),
      ),
    );
  }

  /** Delegates deterministic repair reservation to the same durable job state machine as webhooks. */
  reserveRepairJob(
    message: CalendarSyncMessage,
    now: Date,
  ): Promise<ReserveWebhookJobResult> {
    this.assertOwner(message.ownerId);
    return this.#jobs.reserveWebhookJob(message, now);
  }

  /** Marks the durable reservation only after the opaque Queue send succeeds. */
  markEnqueued(jobId: string, now: Date): Promise<void> {
    return this.#jobs.markEnqueued(jobId, now);
  }

  /** Rejects cross-owner maintenance before it can reach provider or SQL boundaries. */
  private assertOwner(ownerId: string): void {
    if (ownerId !== this.ownerId) {
      throw new Error("Calendar maintenance owner mismatch.");
    }
  }
}

/** Creates the production maintenance repository. */
export function createChannelMaintenanceRepository(
  database: VisionDatabase,
  ownerId: string,
): ChannelMaintenanceRepository {
  return new ChannelMaintenanceRepository(database, ownerId);
}

/** Strictly decodes one connected calendar plus its optional active channel. */
function decodeRenewalCandidate(row: Record<string, unknown>): RenewalCandidate {
  const previous: ActiveGoogleChannel | undefined =
    row.rowId === null
      ? undefined
      : Object.freeze({
          rowId: readText(row.rowId),
          channelId: readText(row.channelId),
          resourceId: readText(row.resourceId),
          expiresAt: readDate(row.expiresAt),
        });
  return Object.freeze({
    ownerId: readText(row.ownerId),
    calendarId: readText(row.calendarId),
    previous,
    consecutiveFailures: readNonNegativeInteger(row.failureCount),
  });
}

/** Reads one bounded nonempty identifier. */
function readText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048) {
    throw new Error("Invalid calendar maintenance row.");
  }
  return value;
}

/** Reads one database timestamp without broad coercion. */
function readDate(value: unknown): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Invalid calendar maintenance row.");
  return date;
}

/** Reads a non-negative integer. */
function readNonNegativeInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Invalid calendar maintenance row.");
  }
  return parsed;
}

/** Reads a positive integer. */
function readPositiveInteger(value: unknown): number {
  const parsed = readNonNegativeInteger(value);
  if (parsed === 0) throw new Error("Invalid calendar maintenance row.");
  return parsed;
}

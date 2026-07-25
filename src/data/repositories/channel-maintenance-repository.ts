/** Persists canonical sync bootstrap, renewal election, failure state, and scheduled repair. */
import { sql } from "drizzle-orm";
import { encodeBase64Url } from "../../crypto/envelope";
import type { VisionDatabase } from "../db";
import type {
  ActiveGoogleChannel,
  ChannelLifecycleRepository,
  RenewalCandidate,
} from "../../jobs/renew-google-channels";
import type {
  BootstrapRepairResult,
  RepairCalendar,
  RepairRepository,
} from "../../jobs/repair-calendar-sync";
import type { CalendarSyncMessage } from "../../jobs/queue-message";
import type { SyncCalendarError } from "../../jobs/sync-calendar";
import {
  createCalendarJobRepository,
  type CalendarJobRepository,
  type ReserveWebhookJobResult,
} from "./job-repository";

const RENEWAL_WINDOW_MS = 24 * 60 * 60_000;
const RENEWAL_LEASE_MS = 2 * 60_000;
const PENDING_WINDOW_MS = 10 * 60_000;
const REPAIR_STALE_MS = 15 * 60_000;
const ACTION_REQUIRED_FAILURES = 6;

/** SQL-backed maintenance repository scoped to one canonical private owner. */
export class ChannelMaintenanceRepository
  implements ChannelLifecycleRepository, RepairRepository
{
  readonly #jobs: CalendarJobRepository;

  /** Binds every maintenance mutation to one private owner. */
  constructor(
    private readonly database: VisionDatabase,
    private readonly ownerId: string,
  ) {
    readText(ownerId);
    this.#jobs = createCalendarJobRepository(database);
  }

  /** Atomically establishes version-zero sync state and one deterministic initial job. */
  async bootstrapConnectedCalendars(now: Date): Promise<readonly BootstrapRepairResult[]> {
    const canonical = await this.database.execute<Record<string, unknown>>(sql`
      select
        connection.provider_calendar_id as "calendarId",
        setup.setup_version as "connectionVersion"
      from vision_calendar_connections as connection
      inner join calendar_setup_states as setup
        on setup.owner_id = connection.owner_id
       and setup.google_subject = connection.google_subject
       and setup.status = 'connected'
      where connection.owner_id = ${this.ownerId}
        and connection.summary = 'Vision'
        and connection.ownership_access_role = 'owner'
      limit 1
    `);
    if (!canonical.rows[0]) return [];
    const calendarId = readText(canonical.rows[0].calendarId);
    const connectionVersion = readPositiveInteger(canonical.rows[0].connectionVersion);
    const checkpointId = await stableId("checkpoint", [
      this.ownerId,
      calendarId,
    ]);
    const jobId = await stableId("initial", [
      this.ownerId,
      calendarId,
      connectionVersion,
    ]);
    const result = await this.database.execute<Record<string, unknown>>(sql`
      with canonical as materialized (
        select connection.owner_id, connection.provider_calendar_id, setup.setup_version
        from vision_calendar_connections as connection
        inner join calendar_setup_states as setup
          on setup.owner_id = connection.owner_id
         and setup.google_subject = connection.google_subject
         and setup.status = 'connected'
        where connection.owner_id = ${this.ownerId}
          and connection.provider_calendar_id = ${calendarId}
          and setup.setup_version = ${connectionVersion}
          and connection.summary = 'Vision'
          and connection.ownership_access_role = 'owner'
      ),
      checkpoint as (
        insert into sync_checkpoints (
          id, owner_id, provider, provider_calendar_id,
          sync_token_envelope, key_version, committed_at, version,
          status, last_error_category, updated_at
        )
        select
          ${checkpointId}, owner_id, 'google-calendar',
          provider_calendar_id, null, null, ${now}, 0,
          'connected', null, ${now}
        from canonical
        on conflict (owner_id, provider, provider_calendar_id) do update set
          id = sync_checkpoints.id
        returning owner_id, provider_calendar_id, version, status
      ),
      maintenance as (
        insert into calendar_sync_maintenance (
          owner_id, provider, provider_calendar_id, connection_version,
          checkpoint_version, renewal_generation, renewal_failures,
          current_channel_row_id, created_at, updated_at
        )
        select
          canonical.owner_id, 'google-calendar',
          canonical.provider_calendar_id, canonical.setup_version,
          checkpoint.version, 0, 0,
          (
            select channel.id
            from sync_channels as channel
            where channel.owner_id = canonical.owner_id
              and channel.provider = 'google-calendar'
              and channel.provider_calendar_id = canonical.provider_calendar_id
              and channel.lifecycle = 'active'
            order by channel.activated_at desc, channel.created_at desc
            limit 1
          ),
          ${now}, ${now}
        from canonical
        inner join checkpoint
          on checkpoint.owner_id = canonical.owner_id
         and checkpoint.provider_calendar_id = canonical.provider_calendar_id
         and checkpoint.status = 'connected'
        on conflict (owner_id, provider, provider_calendar_id) do update set
          connection_version = excluded.connection_version,
          checkpoint_version = excluded.checkpoint_version,
          credential_failure_checkpoint_version = case
            when calendar_sync_maintenance.checkpoint_version = excluded.checkpoint_version
              then calendar_sync_maintenance.credential_failure_checkpoint_version
            else null
          end,
          credential_failure_category = case
            when calendar_sync_maintenance.checkpoint_version = excluded.checkpoint_version
              then calendar_sync_maintenance.credential_failure_category
            else null
          end,
          credential_failure_recorded_at = case
            when calendar_sync_maintenance.checkpoint_version = excluded.checkpoint_version
              then calendar_sync_maintenance.credential_failure_recorded_at
            else null
          end,
          updated_at = excluded.updated_at
        where calendar_sync_maintenance.renewal_lease_id is null
        returning owner_id
      ),
      initial_job as (
        insert into calendar_sync_jobs (
          job_id, owner_id, provider, provider_calendar_id, reason,
          status, attempts, action_required, created_at, updated_at
        )
        select
          ${jobId}, canonical.owner_id, 'google-calendar',
          canonical.provider_calendar_id, 'initial',
          'pending_enqueue', 0, false, ${now}, ${now}
        from canonical
        inner join checkpoint
          on checkpoint.owner_id = canonical.owner_id
         and checkpoint.provider_calendar_id = canonical.provider_calendar_id
         and checkpoint.status = 'connected'
         and checkpoint.version = 0
        where exists (select 1 from maintenance)
        on conflict (job_id) do nothing
        returning job_id
      )
      select
        ${jobId} as "jobId",
        ${calendarId} as "calendarId",
        exists (select 1 from initial_job) as "inserted",
        (
          exists (select 1 from initial_job) or coalesce((
            select status = 'pending_enqueue'
            from calendar_sync_jobs
            where job_id = ${jobId}
          ), false)
        ) and exists (
          select 1
          from checkpoint
          where owner_id = ${this.ownerId}
            and provider_calendar_id = ${calendarId}
            and status = 'connected'
        ) as "shouldEnqueue"
      where exists (select 1 from canonical)
    `);
    if (!result.rows[0]) return [];
    const message: CalendarSyncMessage = Object.freeze({
      jobId,
      ownerId: this.ownerId,
      calendarId,
      reason: "initial",
    });
    return Object.freeze([
      {
        message,
        shouldEnqueue: readBoolean(result.rows[0].shouldEnqueue),
      },
    ]);
  }

  /** Lists canonical connected calendars whose current channel is missing or near expiry. */
  async listRenewalCandidates(now: Date): Promise<readonly RenewalCandidate[]> {
    const renewBefore = new Date(now.getTime() + RENEWAL_WINDOW_MS);
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        maintenance.owner_id as "ownerId",
        maintenance.provider_calendar_id as "calendarId",
        maintenance.connection_version as "connectionVersion",
        checkpoint.version as "checkpointVersion",
        current.id as "rowId",
        current.provider_channel_id as "channelId",
        current.provider_resource_id as "resourceId",
        current.expires_at as "expiresAt"
      from calendar_sync_maintenance as maintenance
      inner join calendar_setup_states as setup
        on setup.owner_id = maintenance.owner_id
       and setup.setup_version = maintenance.connection_version
       and setup.status = 'connected'
      inner join vision_calendar_connections as connection
        on connection.owner_id = maintenance.owner_id
       and connection.provider_calendar_id = maintenance.provider_calendar_id
       and connection.google_subject = setup.google_subject
       and connection.summary = 'Vision'
       and connection.ownership_access_role = 'owner'
      inner join sync_checkpoints as checkpoint
        on checkpoint.owner_id = maintenance.owner_id
       and checkpoint.provider = maintenance.provider
       and checkpoint.provider_calendar_id = maintenance.provider_calendar_id
       and checkpoint.status = 'connected'
      left join sync_channels as current
        on current.id = maintenance.current_channel_row_id
       and current.owner_id = maintenance.owner_id
       and current.provider = maintenance.provider
       and current.provider_calendar_id = maintenance.provider_calendar_id
       and current.lifecycle = 'active'
      where maintenance.owner_id = ${this.ownerId}
        and maintenance.provider = 'google-calendar'
        and (
          maintenance.renewal_lease_id is null
          or maintenance.renewal_lease_expires_at <= ${now}
        )
        and (current.id is null or current.expires_at <= ${renewBefore})
      order by maintenance.provider_calendar_id
    `);
    return Object.freeze(result.rows.map(decodeRenewalCandidate));
  }

  /** Atomically elects one lease winner and inserts its single pending channel row. */
  async preRegister(input: {
    rowId: string;
    ownerId: string;
    calendarId: string;
    channelId: string;
    tokenHash: string;
    tokenEnvelope: Uint8Array;
    leaseId: string;
    expectedConnectionVersion: number;
    expectedCheckpointVersion: number;
    createdAt: Date;
  }): Promise<boolean> {
    this.assertOwner(input.ownerId);
    const provisionalExpiry = new Date(input.createdAt.getTime() + PENDING_WINDOW_MS);
    const leaseExpiry = new Date(input.createdAt.getTime() + RENEWAL_LEASE_MS);
    const result = await this.database.execute(sql`
      with canonical as materialized (
        select
          maintenance.owner_id,
          maintenance.provider_calendar_id,
          maintenance.renewal_lease_id as old_lease_id
        from calendar_sync_maintenance as maintenance
        inner join calendar_setup_states as setup
          on setup.owner_id = maintenance.owner_id
         and setup.setup_version = ${input.expectedConnectionVersion}
         and setup.status = 'connected'
        inner join vision_calendar_connections as connection
          on connection.owner_id = maintenance.owner_id
         and connection.provider_calendar_id = maintenance.provider_calendar_id
         and connection.google_subject = setup.google_subject
         and connection.summary = 'Vision'
         and connection.ownership_access_role = 'owner'
        inner join sync_checkpoints as checkpoint
          on checkpoint.owner_id = maintenance.owner_id
         and checkpoint.provider = maintenance.provider
         and checkpoint.provider_calendar_id = maintenance.provider_calendar_id
         and checkpoint.version = ${input.expectedCheckpointVersion}
         and checkpoint.status = 'connected'
        where maintenance.owner_id = ${input.ownerId}
          and maintenance.provider = 'google-calendar'
          and maintenance.provider_calendar_id = ${input.calendarId}
          and maintenance.connection_version = ${input.expectedConnectionVersion}
          and (
            maintenance.renewal_lease_id is null
            or maintenance.renewal_lease_expires_at <= ${input.createdAt}
          )
        for update
      ),
      stale_pending as (
        update sync_channels as channel
        set lifecycle = 'failed',
            failure_count = channel.failure_count + 1,
            last_failure_at = ${input.createdAt},
            cleanup_required = channel.provider_resource_id is not null
        where channel.owner_id = ${input.ownerId}
          and channel.provider = 'google-calendar'
          and channel.provider_calendar_id = ${input.calendarId}
          and channel.lifecycle = 'pending'
          and channel.renewal_lease_id = (
            select old_lease_id from canonical
          )
          and (select old_lease_id from canonical) is not null
        returning channel.id
      ),
      takeover_ready as materialized (
        select canonical.owner_id, canonical.provider_calendar_id
        from canonical
        left join stale_pending on true
        group by canonical.owner_id, canonical.provider_calendar_id
      ),
      elected as (
        update calendar_sync_maintenance as maintenance
        set renewal_generation = maintenance.renewal_generation + 1,
            renewal_lease_id = ${input.leaseId},
            renewal_lease_expires_at = ${leaseExpiry},
            checkpoint_version = ${input.expectedCheckpointVersion},
            updated_at = ${input.createdAt}
        where maintenance.owner_id = ${input.ownerId}
          and maintenance.provider = 'google-calendar'
          and maintenance.provider_calendar_id = ${input.calendarId}
          and exists (select 1 from takeover_ready)
        returning maintenance.renewal_generation
      ),
      pending as (
        insert into sync_channels (
          id, owner_id, provider, provider_calendar_id, provider_channel_id,
          provider_resource_id, verification_token_envelope,
          verification_token_hash, expires_at, lifecycle, created_at,
          activated_at, failure_count, renewal_generation, renewal_lease_id,
          cleanup_required
        )
        select
          ${input.rowId}, ${input.ownerId}, 'google-calendar',
          ${input.calendarId}, ${input.channelId}, null,
          ${input.tokenEnvelope}, ${input.tokenHash}, ${provisionalExpiry},
          'pending', ${input.createdAt}, null, 0,
          elected.renewal_generation, ${input.leaseId}, false
        from elected
        returning id
      )
      select id from pending
    `);
    return result.rows.length === 1;
  }

  /** Persists the exact watched resource before activation so crash cleanup can recover it. */
  async bindWatchedResource(input: {
    rowId: string;
    ownerId: string;
    calendarId: string;
    leaseId: string;
    resourceId: string;
  }): Promise<boolean> {
    this.assertOwner(input.ownerId);
    const result = await this.database.execute(sql`
      update sync_channels
      set provider_resource_id = ${input.resourceId}
      where id = ${input.rowId}
        and owner_id = ${input.ownerId}
        and provider = 'google-calendar'
        and provider_calendar_id = ${input.calendarId}
        and lifecycle = 'pending'
        and renewal_lease_id = ${input.leaseId}
        and (
          provider_resource_id is null
          or provider_resource_id = ${input.resourceId}
        )
      returning id
    `);
    return result.rows.length === 1;
  }

  /** Activates only the elected lease while canonical connection and checkpoint generation remain current. */
  async activate(input: {
    rowId: string;
    ownerId: string;
    calendarId: string;
    leaseId: string;
    expectedConnectionVersion: number;
    expectedCheckpointVersion: number;
    resourceId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean> {
    this.assertOwner(input.ownerId);
    const result = await this.database.execute(sql`
      with eligible as materialized (
        select maintenance.renewal_generation
        from calendar_sync_maintenance as maintenance
        inner join calendar_setup_states as setup
          on setup.owner_id = maintenance.owner_id
         and setup.setup_version = ${input.expectedConnectionVersion}
         and setup.status = 'connected'
        inner join vision_calendar_connections as connection
          on connection.owner_id = maintenance.owner_id
         and connection.provider_calendar_id = maintenance.provider_calendar_id
         and connection.google_subject = setup.google_subject
         and connection.summary = 'Vision'
         and connection.ownership_access_role = 'owner'
        inner join sync_checkpoints as checkpoint
          on checkpoint.owner_id = maintenance.owner_id
         and checkpoint.provider = maintenance.provider
         and checkpoint.provider_calendar_id = maintenance.provider_calendar_id
         and checkpoint.version = ${input.expectedCheckpointVersion}
         and checkpoint.status = 'connected'
        where maintenance.owner_id = ${input.ownerId}
          and maintenance.provider = 'google-calendar'
          and maintenance.provider_calendar_id = ${input.calendarId}
          and maintenance.connection_version = ${input.expectedConnectionVersion}
          and maintenance.renewal_lease_id = ${input.leaseId}
          and maintenance.renewal_lease_expires_at > ${input.now}
        for update
      ),
      activated as (
        update sync_channels as channel
        set provider_resource_id = ${input.resourceId},
            expires_at = ${input.expiresAt},
            lifecycle = 'active',
            activated_at = ${input.now},
            retired_at = null,
            failure_count = 0,
            last_failure_at = null,
            renewal_lease_id = null,
            cleanup_required = false
        where channel.id = ${input.rowId}
          and channel.owner_id = ${input.ownerId}
          and channel.provider = 'google-calendar'
          and channel.provider_calendar_id = ${input.calendarId}
          and channel.lifecycle = 'pending'
          and channel.renewal_lease_id = ${input.leaseId}
          and channel.renewal_generation = (select renewal_generation from eligible)
          and (
            channel.provider_resource_id is null
            or channel.provider_resource_id = ${input.resourceId}
          )
        returning channel.id
      ),
      advanced as (
        update calendar_sync_maintenance as maintenance
        set current_channel_row_id = ${input.rowId},
            renewal_failures = 0,
            renewal_lease_id = null,
            renewal_lease_expires_at = null,
            checkpoint_version = ${input.expectedCheckpointVersion},
            updated_at = ${input.now}
        where maintenance.owner_id = ${input.ownerId}
          and maintenance.provider = 'google-calendar'
          and maintenance.provider_calendar_id = ${input.calendarId}
          and maintenance.renewal_lease_id = ${input.leaseId}
          and exists (select 1 from activated)
        returning maintenance.owner_id
      )
      select owner_id from advanced
    `);
    return result.rows.length === 1;
  }

  /** Accumulates calendar-level failure state for the exact active renewal lease. */
  async recordFailure(input: {
    ownerId: string;
    calendarId: string;
    rowId: string;
    leaseId: string;
    expectedCheckpointVersion: number;
    resourceId?: string;
    providerStop: "not_attempted" | "succeeded" | "failed";
    now: Date;
  }): Promise<void> {
    this.assertOwner(input.ownerId);
    await this.database.execute(sql`
      with failed_channel as (
        update sync_channels
        set failure_count = failure_count + 1,
            last_failure_at = ${input.now},
            lifecycle = case when lifecycle = 'pending' then 'failed' else lifecycle end,
            provider_resource_id = case
              when ${input.providerStop} = 'succeeded' then null
              when ${input.providerStop} = 'failed' then
                coalesce(${input.resourceId ?? null}, provider_resource_id)
              else provider_resource_id
            end,
            cleanup_required = case
              when ${input.providerStop} = 'succeeded' then false
              when ${input.providerStop} = 'failed' then
                coalesce(${input.resourceId ?? null}, provider_resource_id) is not null
              else provider_resource_id is not null
            end
        where id = ${input.rowId}
          and owner_id = ${input.ownerId}
          and provider = 'google-calendar'
          and provider_calendar_id = ${input.calendarId}
          and renewal_lease_id = ${input.leaseId}
        returning id
      ),
      failed_maintenance as (
        update calendar_sync_maintenance as maintenance
        set renewal_failures = maintenance.renewal_failures + 1,
            renewal_lease_id = null,
            renewal_lease_expires_at = null,
            updated_at = ${input.now}
        where maintenance.owner_id = ${input.ownerId}
          and maintenance.provider = 'google-calendar'
          and maintenance.provider_calendar_id = ${input.calendarId}
          and maintenance.renewal_lease_id = ${input.leaseId}
          and maintenance.checkpoint_version = ${input.expectedCheckpointVersion}
          and exists (select 1 from failed_channel)
        returning
          maintenance.renewal_failures,
          maintenance.current_channel_row_id
      ),
      disposition as (
        select
          failed_maintenance.renewal_failures >= ${ACTION_REQUIRED_FAILURES}
          or (
            current.id is not null
            and current.expires_at <= ${input.now}
          ) as action_required
        from failed_maintenance
        left join sync_channels as current
          on current.id = failed_maintenance.current_channel_row_id
      )
      update sync_checkpoints as checkpoint
      set status = case
            when disposition.action_required then 'action_required'
            else checkpoint.status
          end,
          last_error_category = case
            when disposition.action_required then 'provider'
            else checkpoint.last_error_category
          end,
          updated_at = ${input.now}
      from disposition
      where checkpoint.owner_id = ${input.ownerId}
        and checkpoint.provider = 'google-calendar'
        and checkpoint.provider_calendar_id = ${input.calendarId}
        and checkpoint.version = ${input.expectedCheckpointVersion}
        and checkpoint.status = 'connected'
    `);
  }

  /** Persists one scheduler credential disposition without adopting consumer-owned retry state. */
  async recordCredentialFailure(
    failure: SyncCalendarError,
    now: Date,
  ): Promise<boolean> {
    const result = await this.database.execute(sql`
      with eligible as materialized (
        select
          maintenance.owner_id,
          maintenance.provider_calendar_id,
          maintenance.checkpoint_version
        from calendar_sync_maintenance as maintenance
        inner join calendar_setup_states as setup
          on setup.owner_id = maintenance.owner_id
         and setup.setup_version = maintenance.connection_version
         and setup.status = 'connected'
        inner join vision_calendar_connections as connection
          on connection.owner_id = maintenance.owner_id
         and connection.provider_calendar_id = maintenance.provider_calendar_id
         and connection.google_subject = setup.google_subject
         and connection.summary = 'Vision'
         and connection.ownership_access_role = 'owner'
        inner join sync_checkpoints as checkpoint
          on checkpoint.owner_id = maintenance.owner_id
         and checkpoint.provider = maintenance.provider
         and checkpoint.provider_calendar_id = maintenance.provider_calendar_id
         and checkpoint.version = maintenance.checkpoint_version
         and (
           checkpoint.status = 'connected'
           or (
             checkpoint.status = 'retry_scheduled'
             and maintenance.credential_failure_checkpoint_version =
                 checkpoint.version
             and maintenance.credential_failure_category =
                 checkpoint.last_error_category
             and maintenance.credential_failure_recorded_at =
                 checkpoint.updated_at
           )
         )
        where maintenance.owner_id = ${this.ownerId}
          and maintenance.provider = 'google-calendar'
        for update of checkpoint
      ),
      disposed as (
        update sync_checkpoints as checkpoint
        set status = ${failure.state},
            last_error_category = ${failure.category},
            updated_at = ${now}
        from eligible
        where checkpoint.owner_id = eligible.owner_id
          and checkpoint.provider = 'google-calendar'
          and checkpoint.provider_calendar_id = eligible.provider_calendar_id
          and checkpoint.version = eligible.checkpoint_version
        returning
          checkpoint.owner_id,
          checkpoint.provider_calendar_id,
          checkpoint.version
      ),
      marked as (
        update calendar_sync_maintenance as maintenance
        set credential_failure_checkpoint_version = disposed.version,
            credential_failure_category = ${failure.category},
            credential_failure_recorded_at = ${now},
            updated_at = ${now}
        from disposed
        where maintenance.owner_id = disposed.owner_id
          and maintenance.provider = 'google-calendar'
          and maintenance.provider_calendar_id = disposed.provider_calendar_id
          and maintenance.checkpoint_version = disposed.version
        returning maintenance.owner_id
      )
      select owner_id from marked
    `);
    return result.rows.length === 1;
  }

  /** Clears only the exact scheduler-owned retry marker after credentials work again. */
  async clearCredentialRetry(now: Date): Promise<boolean> {
    const result = await this.database.execute(sql`
      with eligible as materialized (
        select
          maintenance.owner_id,
          maintenance.provider_calendar_id,
          maintenance.checkpoint_version,
          maintenance.credential_failure_category
        from calendar_sync_maintenance as maintenance
        inner join sync_checkpoints as checkpoint
          on checkpoint.owner_id = maintenance.owner_id
         and checkpoint.provider = maintenance.provider
         and checkpoint.provider_calendar_id = maintenance.provider_calendar_id
         and checkpoint.version = maintenance.checkpoint_version
         and checkpoint.status = 'retry_scheduled'
         and checkpoint.last_error_category = maintenance.credential_failure_category
         and checkpoint.updated_at = maintenance.credential_failure_recorded_at
        where maintenance.owner_id = ${this.ownerId}
          and maintenance.provider = 'google-calendar'
          and maintenance.credential_failure_checkpoint_version =
              maintenance.checkpoint_version
          and maintenance.credential_failure_category in ('transient', 'database')
        for update of checkpoint
      ),
      cleared as (
        update sync_checkpoints as checkpoint
        set status = 'connected',
            last_error_category = null,
            updated_at = ${now}
        from eligible
        where checkpoint.owner_id = eligible.owner_id
          and checkpoint.provider = 'google-calendar'
          and checkpoint.provider_calendar_id = eligible.provider_calendar_id
          and checkpoint.version = eligible.checkpoint_version
        returning
          checkpoint.owner_id,
          checkpoint.provider_calendar_id,
          checkpoint.version
      ),
      unmarked as (
        update calendar_sync_maintenance as maintenance
        set credential_failure_checkpoint_version = null,
            credential_failure_category = null,
            credential_failure_recorded_at = null,
            updated_at = ${now}
        from cleared
        where maintenance.owner_id = cleared.owner_id
          and maintenance.provider = 'google-calendar'
          and maintenance.provider_calendar_id = cleared.provider_calendar_id
          and maintenance.checkpoint_version = cleared.version
        returning maintenance.owner_id
      )
      select owner_id from unmarked
    `);
    return result.rows.length === 1;
  }

  /** Marks an old exact channel for later stop retry without changing the new current channel. */
  async markCleanupRequired(rowId: string, now: Date): Promise<void> {
    await this.database.execute(sql`
      update sync_channels
      set cleanup_required = true,
          failure_count = failure_count + 1,
          last_failure_at = ${now}
      where id = ${rowId}
        and owner_id = ${this.ownerId}
        and provider = 'google-calendar'
        and lifecycle = 'active'
    `);
  }

  /** Lists every active non-current channel for exact provider cleanup and retry. */
  async listSupersededChannels(): Promise<readonly ActiveGoogleChannel[]> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        channel.id as "rowId",
        channel.provider_channel_id as "channelId",
        channel.provider_resource_id as "resourceId",
        channel.expires_at as "expiresAt"
      from sync_channels as channel
      inner join calendar_sync_maintenance as maintenance
        on maintenance.owner_id = channel.owner_id
       and maintenance.provider = channel.provider
       and maintenance.provider_calendar_id = channel.provider_calendar_id
      where channel.owner_id = ${this.ownerId}
        and channel.provider = 'google-calendar'
        and channel.provider_resource_id is not null
        and (
          (
            channel.lifecycle = 'active'
            and channel.id <> maintenance.current_channel_row_id
          )
          or (
            channel.lifecycle = 'failed'
            and channel.cleanup_required
          )
        )
      order by channel.created_at
    `);
    return Object.freeze(result.rows.map(decodeActiveChannel));
  }

  /** Completes exact cleanup for a superseded active or failed provisional row. */
  async retire(rowId: string, now: Date): Promise<boolean> {
    const result = await this.database.execute(sql`
      update sync_channels
      set lifecycle = case
            when lifecycle = 'active' then 'retired'
            else lifecycle
          end,
          provider_resource_id = case
            when lifecycle = 'failed' then null
            else provider_resource_id
          end,
          retired_at = case
            when lifecycle = 'active' then ${now}
            else retired_at
          end,
          cleanup_required = false
      where id = ${rowId}
        and owner_id = ${this.ownerId}
        and provider = 'google-calendar'
        and (
          (
            lifecycle = 'active'
            and not exists (
              select 1
              from calendar_sync_maintenance
              where owner_id = ${this.ownerId}
                and provider = 'google-calendar'
                and current_channel_row_id = ${rowId}
            )
          )
          or (
            lifecycle = 'failed'
            and cleanup_required
            and provider_resource_id is not null
          )
        )
      returning id
    `);
    return result.rows.length === 1;
  }

  /** Selects connected calendars whose latest successful sync is missing or stale. */
  async listRepairCandidates(now: Date): Promise<readonly RepairCalendar[]> {
    const staleBefore = new Date(now.getTime() - REPAIR_STALE_MS);
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        checkpoint.owner_id as "ownerId",
        checkpoint.provider_calendar_id as "calendarId",
        checkpoint.version as "checkpointVersion"
      from sync_checkpoints as checkpoint
      inner join vision_calendar_connections as connection
        on connection.owner_id = checkpoint.owner_id
       and connection.provider_calendar_id = checkpoint.provider_calendar_id
      inner join calendar_setup_states as setup
        on setup.owner_id = connection.owner_id
       and setup.google_subject = connection.google_subject
       and setup.status = 'connected'
      left join lateral (
        select max(run.completed_at) as completed_at
        from sync_runs as run
        where run.owner_id = checkpoint.owner_id
          and run.provider = checkpoint.provider
          and run.provider_calendar_id = checkpoint.provider_calendar_id
      ) as latest on true
      where checkpoint.owner_id = ${this.ownerId}
        and checkpoint.provider = 'google-calendar'
        and checkpoint.status = 'connected'
        and checkpoint.version > 0
        and (latest.completed_at is null or latest.completed_at <= ${staleBefore})
        and not exists (
          select 1
          from calendar_sync_jobs as initial
          where initial.owner_id = checkpoint.owner_id
            and initial.provider = checkpoint.provider
            and initial.provider_calendar_id = checkpoint.provider_calendar_id
            and initial.reason = 'initial'
            and initial.status not in ('succeeded', 'failed')
        )
      order by checkpoint.provider_calendar_id
    `);
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          ownerId: readText(row.ownerId),
          calendarId: readText(row.calendarId),
          checkpointVersion: readNonNegativeInteger(row.checkpointVersion),
        }),
      ),
    );
  }

  /** Reserves repair through the same durable job state machine as webhooks. */
  reserveRepairJob(
    message: CalendarSyncMessage,
    now: Date,
  ): Promise<ReserveWebhookJobResult> {
    this.assertOwner(message.ownerId);
    return this.#jobs.reserveWebhookJob(message, now);
  }

  /** Marks a reservation only after its opaque Queue send succeeds. */
  markEnqueued(jobId: string, now: Date): Promise<void> {
    return this.#jobs.markEnqueued(jobId, now);
  }

  /** Rejects cross-owner maintenance before SQL or provider work. */
  private assertOwner(ownerId: string): void {
    if (ownerId !== this.ownerId) {
      throw new Error("Calendar maintenance owner mismatch.");
    }
  }
}

/** Creates one owner-scoped production maintenance repository. */
export function createChannelMaintenanceRepository(
  database: VisionDatabase,
  ownerId: string,
): ChannelMaintenanceRepository {
  return new ChannelMaintenanceRepository(database, ownerId);
}

/** Strictly decodes one canonical renewal candidate. */
function decodeRenewalCandidate(row: Record<string, unknown>): RenewalCandidate {
  return Object.freeze({
    ownerId: readText(row.ownerId),
    calendarId: readText(row.calendarId),
    connectionVersion: readPositiveInteger(row.connectionVersion),
    checkpointVersion: readNonNegativeInteger(row.checkpointVersion),
    previous: row.rowId === null ? undefined : decodeActiveChannel(row),
  });
}

/** Strictly decodes one exact provider channel identity. */
function decodeActiveChannel(row: Record<string, unknown>): ActiveGoogleChannel {
  return Object.freeze({
    rowId: readText(row.rowId),
    channelId: readText(row.channelId),
    resourceId: readText(row.resourceId),
    expiresAt: readDate(row.expiresAt),
  });
}

/** Creates a content-free deterministic identifier. */
async function stableId(prefix: string, parts: readonly unknown[]): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify([`vision-${prefix}`, 1, ...parts])),
    ),
  );
  return `${prefix}_${encodeBase64Url(digest)}`;
}

/** Reads bounded nonempty database text. */
function readText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048) {
    throw new Error("Invalid calendar maintenance row.");
  }
  return value;
}

/** Reads one database timestamp. */
function readDate(value: unknown): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Invalid calendar maintenance row.");
  return date;
}

/** Reads one non-negative safe integer. */
function readNonNegativeInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Invalid calendar maintenance row.");
  }
  return parsed;
}

/** Reads one positive safe integer. */
function readPositiveInteger(value: unknown): number {
  const parsed = readNonNegativeInteger(value);
  if (parsed === 0) throw new Error("Invalid calendar maintenance row.");
  return parsed;
}

/** Reads one strict database boolean. */
function readBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Invalid calendar maintenance row.");
  return value;
}

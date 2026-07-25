/** Persists encrypted Google event pages and their checkpoint in one CAS-guarded PostgreSQL statement. */
import { sql } from "drizzle-orm";
import {
  encodeBase64Url,
  parseCipherEnvelope,
  serializeCipherEnvelope,
  type CipherEnvelope,
} from "../../crypto/envelope";
import type { KeyProvider } from "../../crypto/key-provider";
import {
  decryptProtectedFields,
  encryptProtectedFields,
} from "../../crypto/protected-fields";
import type { ProviderEventChange, UpsertEvent } from "../../domain/sync/change";
import {
  SyncCheckpointSchema,
  type SyncCheckpoint,
} from "../../domain/sync/checkpoint";
import {
  SyncCalendarError,
  type SyncReason,
  type SyncApplyRequest,
  type SyncApplyResult,
  type SyncFailureRecord,
  type SyncRepository,
} from "../../jobs/sync-calendar";
import type { VisionDatabase } from "../db";
import {
  prepareStoredEventRow,
  type PlaintextEvent,
  type StoredEventRow,
} from "./event-repository";

const PROVIDER = "google-calendar";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

interface StoredCheckpointRow {
  readonly ownerId: string;
  readonly calendarId: string;
  readonly tokenEnvelope: Uint8Array | null;
  readonly keyVersion: number | null;
  readonly committedAt: Date;
  readonly version: number;
}

interface EventProjectionContext {
  readonly nodeId: string;
  readonly eventId: string;
  readonly domain: PlaintextEvent["domain"];
  readonly domainState: PlaintextEvent["domainState"];
  readonly privacy: PlaintextEvent["privacy"];
  readonly nodeVersion: number;
}

interface PreparedUpsert {
  readonly change: UpsertEvent;
  readonly event: StoredEventRow;
  readonly providerPayloadEnvelope: Uint8Array;
  readonly providerPayloadKeyVersion: number;
  readonly providerNodeId: string;
  readonly expectedExisting: boolean;
}

interface AtomicSyncCommit {
  readonly ownerId: string;
  readonly calendarId: string;
  readonly expectedCheckpointVersion: number;
  readonly nextCheckpoint: SyncCheckpoint;
  readonly checkpointEnvelope: Uint8Array;
  readonly checkpointKeyVersion: number;
  readonly changes: readonly PreparedDatabaseChange[];
  readonly jobId: string;
  readonly reason: SyncReason;
  readonly queueJobReason?: SyncReason;
  readonly pageCount: number;
  readonly startedAt: Date;
  readonly queueClaimId?: string;
  readonly replaceProjection: boolean;
  readonly rebuildGenerationId?: string;
}

interface QueueCommitAuthority {
  readonly jobId: string;
  readonly reason: SyncReason;
  readonly claimId: string;
}

type PreparedDatabaseChange =
  | {
      readonly kind: "delete";
      readonly sourceSystem: string;
      readonly calendarId: string;
      readonly eventId: string;
    }
  | {
      readonly kind: "upsert";
      readonly sourceSystem: string;
      readonly calendarId: string;
      readonly eventId: string;
      readonly providerNodeId: string;
      readonly nodeId: string;
      readonly providerVersion: string;
      readonly startsAt: string;
      readonly endsAt: string;
      readonly timeZone: string;
      readonly busy: boolean;
      readonly status: "confirmed" | "tentative";
      readonly recurrenceId: string | null;
      readonly domain: PlaintextEvent["domain"];
      readonly domainState: PlaintextEvent["domainState"];
      readonly privacy: PlaintextEvent["privacy"];
      readonly nodeVersion: number;
      readonly expectedExisting: boolean;
      readonly titleEnvelope: string | null;
      readonly descriptionEnvelope: string | null;
      readonly attendeesEnvelope: string;
      readonly locationEnvelope: string | null;
      readonly meetingLinkEnvelope: string | null;
      readonly protectedKeyVersion: number;
      readonly providerPayloadEnvelope: string;
      readonly providerPayloadKeyVersion: number;
    };

/** Low-level storage seam used by the encrypted owner-scoped repository. */
export interface AtomicSyncStore {
  loadCheckpoint(
    ownerId: string,
    calendarId: string,
    queueAuthority?: QueueCommitAuthority,
  ): Promise<StoredCheckpointRow | undefined>;
  loadProjectionContexts(ownerId: string, calendarId: string): Promise<readonly EventProjectionContext[]>;
  applyAtomic(commit: AtomicSyncCommit): Promise<SyncApplyResult>;
  recordFailure(record: SyncFailureRecord): Promise<void>;
}

/** Neon HTTP adapter whose event and checkpoint mutation is one PostgreSQL statement. */
export class DrizzleAtomicSyncStore implements AtomicSyncStore {
  /** Binds the synchronization transaction to Vision's least-privileged database handle. */
  constructor(private readonly database: VisionDatabase) {}

  /** Creates the non-secret version-zero CAS row if needed and returns its strict current state. */
  async loadCheckpoint(
    ownerId: string,
    calendarId: string,
    queueAuthority?: QueueCommitAuthority,
  ): Promise<StoredCheckpointRow | undefined> {
    const id = checkpointId(ownerId, calendarId);
    const now = new Date();
    if (queueAuthority !== undefined) {
      const guarded = await this.database.execute<Record<string, unknown>>(sql`
        with active_claim as materialized (
          select job.job_id
          from calendar_sync_jobs as job
          where job.job_id = ${queueAuthority.jobId}
            and job.owner_id = ${ownerId}
            and job.provider = ${PROVIDER}
            and job.provider_calendar_id = ${calendarId}
            and job.reason = ${queueAuthority.reason}
            and job.status = 'in_progress'
            and job.claim_id = ${queueAuthority.claimId}
          for update
        ),
        existing as materialized (
          select
            checkpoint.owner_id as "ownerId",
            checkpoint.provider_calendar_id as "calendarId",
            checkpoint.sync_token_envelope as "tokenEnvelope",
            checkpoint.key_version as "keyVersion",
            checkpoint.committed_at as "committedAt",
            checkpoint.version
          from sync_checkpoints as checkpoint
          cross join active_claim
          where checkpoint.owner_id = ${ownerId}
            and checkpoint.provider = ${PROVIDER}
            and checkpoint.provider_calendar_id = ${calendarId}
        ),
        seeded as (
          insert into sync_checkpoints (
            id, owner_id, provider, provider_calendar_id,
            sync_token_envelope, key_version, committed_at,
            version, status, updated_at
          )
          select
            ${id}, ${ownerId}, ${PROVIDER}, ${calendarId},
            null, null, ${now}, 0, 'pending', ${now}
          from active_claim
          where not exists (select 1 from existing)
          on conflict (owner_id, provider, provider_calendar_id) do nothing
          returning
            owner_id as "ownerId",
            provider_calendar_id as "calendarId",
            sync_token_envelope as "tokenEnvelope",
            key_version as "keyVersion",
            committed_at as "committedAt",
            version
        )
        select * from existing
        union all
        select * from seeded
        limit 1
      `);
      return guarded.rows[0]
        ? decodeCheckpointRow(guarded.rows[0])
        : undefined;
    }
    await this.database.execute(sql`
      insert into sync_checkpoints (
        id, owner_id, provider, provider_calendar_id,
        sync_token_envelope, key_version, committed_at,
        version, status, updated_at
      ) values (
        ${id}, ${ownerId}, ${PROVIDER}, ${calendarId},
        null, null, ${now}, 0, 'pending', ${now}
      )
      on conflict (owner_id, provider, provider_calendar_id) do nothing
    `);
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        owner_id as "ownerId",
        provider_calendar_id as "calendarId",
        sync_token_envelope as "tokenEnvelope",
        key_version as "keyVersion",
        committed_at as "committedAt",
        version
      from sync_checkpoints
      where owner_id = ${ownerId}
        and provider = ${PROVIDER}
        and provider_calendar_id = ${calendarId}
      limit 1
    `);
    if (!result.rows[0]) throw new Error("Synchronization checkpoint is unavailable.");
    return decodeCheckpointRow(result.rows[0]);
  }

  /** Reads planning-only node context needed to preserve category, privacy, and encryption partition. */
  async loadProjectionContexts(
    ownerId: string,
    calendarId: string,
  ): Promise<readonly EventProjectionContext[]> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        event.provider_event_id as "eventId",
        event.node_id as "nodeId",
        node.domain,
        node.domain_state as "domainState",
        node.privacy,
        node.version as "nodeVersion"
      from events event
      inner join nodes node
        on node.id = event.node_id and node.owner_id = event.owner_id
      where event.owner_id = ${ownerId}
        and event.provider = ${PROVIDER}
        and event.provider_calendar_id = ${calendarId}
    `);
    return result.rows.map(decodeProjectionContext);
  }

  /** Executes all staged mutations, derived invalidations, safe metrics, and checkpoint CAS atomically. */
  async applyAtomic(commit: AtomicSyncCommit): Promise<SyncApplyResult> {
    const serializedChanges = JSON.stringify(commit.changes);
    const queueAuthorization =
      commit.queueClaimId === undefined
        ? sql`
            commit_authorized as materialized (
              select true as valid
            ),
          `
        : sql`
            active_claim as materialized (
              select job.job_id
              from calendar_sync_jobs as job
              where job.job_id = ${commit.jobId}
                and job.owner_id = ${commit.ownerId}
                and job.provider = ${PROVIDER}
                and job.provider_calendar_id = ${commit.calendarId}
                and job.reason = ${commit.queueJobReason ?? commit.reason}
                and job.status = 'in_progress'
                and job.claim_id = ${commit.queueClaimId}
              for update
            ),
            commit_authorized as materialized (
              select exists (select 1 from active_claim) as valid
            ),
          `;
    const rebuildAuthorization =
      commit.rebuildGenerationId === undefined
        ? sql`
            rebuild_authorized as materialized (
              select true as valid
            ),
          `
        : sql`
            rebuild_generation as materialized (
              select generation.id
              from projection_rebuild_generations generation
              where generation.id = ${commit.rebuildGenerationId}
                and generation.owner_id = ${commit.ownerId}
                and generation.provider = ${PROVIDER}
                and generation.provider_calendar_id = ${commit.calendarId}
                and generation.job_id = ${commit.jobId}
                and generation.base_checkpoint_version = ${commit.expectedCheckpointVersion}
                and generation.queue_claim_id is not distinct from ${commit.queueClaimId ?? null}
                and generation.status = 'ready'
              for update
            ),
            rebuild_authorized as materialized (
              select exists (select 1 from rebuild_generation) as valid
            ),
          `;
    const generationActivation =
      commit.rebuildGenerationId === undefined
        ? sql`
            generation_activation as materialized (
              select null::text as id
              where false
            ),
          `
        : sql`
            generation_activation as (
              update projection_rebuild_generations generation
              set
                status = 'activated',
                updated_at = clock_timestamp(),
                activated_at = clock_timestamp()
              from checkpoint_write
              where generation.id = ${commit.rebuildGenerationId}
                and generation.owner_id = ${commit.ownerId}
                and generation.status = 'ready'
              returning generation.id
            ),
          `;
    const rebuildCleanup =
      commit.rebuildGenerationId === undefined
        ? sql`
            cleared_rebuild_changes as materialized (
              select null::text as generation_id
              where false
            ),
          `
        : sql`
            cleared_rebuild_changes as (
              delete from projection_rebuild_changes change
              using generation_activation generation
              where change.generation_id = generation.id
              returning change.generation_id
            ),
          `;
    const result = await this.database.execute<Record<string, unknown>>(sql`
      with incoming as materialized (
        select *
        from jsonb_to_recordset(${serializedChanges}::jsonb) as change (
          kind text,
          "sourceSystem" text,
          "calendarId" text,
          "eventId" text,
          "providerNodeId" text,
          "nodeId" text,
          "providerVersion" text,
          "startsAt" timestamptz,
          "endsAt" timestamptz,
          "timeZone" text,
          busy boolean,
          status text,
          "recurrenceId" text,
          domain text,
          "domainState" text,
          privacy text,
          "nodeVersion" integer,
          "expectedExisting" boolean,
          "titleEnvelope" text,
          "descriptionEnvelope" text,
          "attendeesEnvelope" text,
          "locationEnvelope" text,
          "meetingLinkEnvelope" text,
          "protectedKeyVersion" integer,
          "providerPayloadEnvelope" text,
          "providerPayloadKeyVersion" integer
        )
      ),
      context_valid as materialized (
        select not exists (
          select 1
          from incoming change
          left join events event
            on event.owner_id = ${commit.ownerId}
            and event.provider = change."sourceSystem"
            and event.provider_calendar_id = change."calendarId"
            and event.provider_event_id = change."eventId"
          left join nodes node
            on node.id = event.node_id and node.owner_id = event.owner_id
          where change.kind = 'upsert'
            and (
              (change."expectedExisting" and (
                event.node_id is null
                or event.node_id <> change."nodeId"
                or node.domain <> change.domain
                or node.domain_state <> change."domainState"
                or node.privacy <> change.privacy
                or node.version <> change."nodeVersion"
              ))
              or
              (not change."expectedExisting" and event.node_id is not null)
            )
        ) as valid
      ),
      ${queueAuthorization}
      ${rebuildAuthorization}
      checkpoint_write as (
        update sync_checkpoints
        set
          sync_token_envelope = ${commit.checkpointEnvelope}::bytea,
          key_version = ${commit.checkpointKeyVersion},
          committed_at = ${new Date(commit.nextCheckpoint.committedAt)},
          version = ${commit.nextCheckpoint.version},
          status = 'connected',
          last_error_category = null,
          updated_at = clock_timestamp()
        where owner_id = ${commit.ownerId}
          and provider = ${PROVIDER}
          and provider_calendar_id = ${commit.calendarId}
          and version = ${commit.expectedCheckpointVersion}
          and (select valid from context_valid)
          and (select valid from commit_authorized)
          and (select valid from rebuild_authorized)
        returning version
      ),
      eligible_upserts as materialized (
        select change.*
        from incoming change
        cross join checkpoint_write
        left join events persisted
          on persisted.owner_id = ${commit.ownerId}
          and persisted.provider = change."sourceSystem"
          and persisted.provider_calendar_id = change."calendarId"
          and persisted.provider_event_id = change."eventId"
        left join nodes persisted_node
          on persisted_node.id = persisted.node_id
          and persisted_node.owner_id = persisted.owner_id
        where change.kind = 'upsert'
          and (
            persisted.node_id is null
            or persisted.provider_version < change."providerVersion"
            or (
              ${commit.replaceProjection}
              and persisted.provider_version = change."providerVersion"
              and (
                persisted.status = 'cancelled'
                or persisted_node.lifecycle = 'deleted'
              )
            )
          )
      ),
      node_writes as (
        insert into nodes as persisted (
          id, owner_id, identity_kind, provider, provider_node_id, node_type,
          domain, domain_state, privacy, provenance, lifecycle,
          created_at, updated_at, valid_from, valid_to, version, model_confidence
        )
        select
          change."nodeId", ${commit.ownerId}, 'provider',
          change."sourceSystem", change."providerNodeId", 'event',
          change.domain, change."domainState", change.privacy,
          'provider', 'active',
          clock_timestamp(), clock_timestamp(), clock_timestamp(), null,
          change."nodeVersion", null
        from eligible_upserts change
        on conflict (owner_id, provider, provider_node_id) do update set
          lifecycle = 'active',
          updated_at = clock_timestamp(),
          valid_to = null
        where persisted.id = excluded.id
          and persisted.domain = excluded.domain
          and persisted.domain_state = excluded.domain_state
          and persisted.privacy = excluded.privacy
          and persisted.version = excluded.version
        returning persisted.id
      ),
      event_writes as (
        insert into events as persisted (
          node_id, owner_id, provider, provider_calendar_id, provider_event_id,
          provider_version, starts_at, ends_at, time_zone, busy, status,
          recurrence_id, title_envelope, description_envelope,
          attendees_envelope, location_envelope, meeting_link_envelope,
          protected_key_version
        )
        select
          change."nodeId", ${commit.ownerId}, change."sourceSystem",
          change."calendarId", change."eventId", change."providerVersion",
          change."startsAt", change."endsAt", change."timeZone",
          change.busy, change.status, change."recurrenceId",
          case when change."titleEnvelope" is null then null else decode(change."titleEnvelope", 'hex') end,
          case when change."descriptionEnvelope" is null then null else decode(change."descriptionEnvelope", 'hex') end,
          decode(change."attendeesEnvelope", 'hex'),
          case when change."locationEnvelope" is null then null else decode(change."locationEnvelope", 'hex') end,
          case when change."meetingLinkEnvelope" is null then null else decode(change."meetingLinkEnvelope", 'hex') end,
          change."protectedKeyVersion"
        from eligible_upserts change
        inner join node_writes node on node.id = change."nodeId"
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
          and (
            persisted.provider_version < excluded.provider_version
            or (
              ${commit.replaceProjection}
              and persisted.provider_version = excluded.provider_version
              and persisted.status = 'cancelled'
            )
          )
        returning persisted.node_id
      ),
      payload_writes as (
        insert into event_sync_payloads as persisted (
          node_id, owner_id, protected_payload_envelope, protected_key_version
        )
        select
          change."nodeId", ${commit.ownerId},
          decode(change."providerPayloadEnvelope", 'hex'),
          change."providerPayloadKeyVersion"
        from eligible_upserts change
        inner join event_writes event on event.node_id = change."nodeId"
        on conflict (node_id) do update set
          protected_payload_envelope = excluded.protected_payload_envelope,
          protected_key_version = excluded.protected_key_version
        where persisted.owner_id = excluded.owner_id
        returning persisted.node_id
      ),
      cleared_recoverable_deletions as (
        delete from recoverable_deletions persisted
        using event_writes event
        where persisted.node_id = event.node_id
          and persisted.owner_id = ${commit.ownerId}
        returning persisted.node_id
      ),
      delete_targets as materialized (
        select persisted.node_id
        from events persisted
        cross join checkpoint_write
        where persisted.owner_id = ${commit.ownerId}
          and persisted.provider = ${PROVIDER}
          and persisted.provider_calendar_id = ${commit.calendarId}
          and (
            exists (
              select 1
              from incoming change
              where change.kind = 'delete'
                and change."sourceSystem" = persisted.provider
                and change."calendarId" = persisted.provider_calendar_id
                and change."eventId" = persisted.provider_event_id
            )
            or (
              ${commit.replaceProjection}
              and not exists (
                select 1
                from incoming change
                where change.kind = 'upsert'
                  and change."sourceSystem" = persisted.provider
                  and change."calendarId" = persisted.provider_calendar_id
                  and change."eventId" = persisted.provider_event_id
              )
            )
          )
      ),
      deleted_events as (
        update events as persisted
        set status = 'cancelled'
        from delete_targets target
        where persisted.node_id = target.node_id
          and persisted.status <> 'cancelled'
        returning persisted.node_id, persisted.provider_event_id
      ),
      deleted_nodes as (
        update nodes as persisted
        set
          lifecycle = 'deleted',
          updated_at = clock_timestamp(),
          valid_to = clock_timestamp()
        from deleted_events deleted
        where persisted.id = deleted.node_id
          and persisted.owner_id = ${commit.ownerId}
        returning persisted.id
      ),
      retained_deletions as (
        insert into recoverable_deletions (
          node_id, owner_id, deleted_at, purge_after, recovery_envelope
        )
        select
          deleted.id, ${commit.ownerId}, clock_timestamp(),
          clock_timestamp() + interval '30 days', null
        from deleted_nodes deleted
        on conflict (node_id) do nothing
        returning node_id
      ),
      changed_nodes as materialized (
        select node_id from event_writes
        union
        select id as node_id from deleted_nodes
      ),
      invalidated_edges as (
        update edges
        set lifecycle = 'retracted', valid_to = clock_timestamp()
        where owner_id = ${commit.ownerId}
          and origin = 'model'
          and lifecycle in ('proposed', 'confirmed')
          and (
            source_node_id in (select node_id from changed_nodes)
            or destination_node_id in (select node_id from changed_nodes)
          )
        returning id
      ),
      explicit_deleted_count as materialized (
        select count(*)::integer as count
        from deleted_events deleted
        inner join incoming change
          on change.kind = 'delete'
          and change."eventId" = deleted.provider_event_id
          and change."sourceSystem" = ${PROVIDER}
          and change."calendarId" = ${commit.calendarId}
      ),
      counts as materialized (
        select
          (select count(*)::integer from event_writes) as upserted,
          (select count(*)::integer from deleted_nodes) as deleted,
          (
            (select count(*)::integer from incoming)
            - (select count(*)::integer from event_writes)
            - case
                when ${commit.replaceProjection}
                  then (select count from explicit_deleted_count)
                else (select count(*)::integer from deleted_nodes)
              end
          ) as unchanged
      ),
      run_write as (
        insert into sync_runs (
          job_id, owner_id, provider, provider_calendar_id, reason,
          page_count, staged_count, upserted_count, deleted_count,
          unchanged_count, started_at, completed_at, checkpoint_version
        )
        select
          ${commit.jobId}, ${commit.ownerId}, ${PROVIDER}, ${commit.calendarId},
          ${commit.reason}, ${commit.pageCount},
          (select count(*)::integer from incoming),
          counts.upserted, counts.deleted, counts.unchanged,
          ${commit.startedAt}, clock_timestamp(), checkpoint_write.version
        from checkpoint_write
        cross join counts
        on conflict (job_id) do nothing
        returning job_id
      ),
      ${generationActivation}
      ${rebuildCleanup}
      result_marker as materialized (
        select true as present
      )
      select
        checkpoint_write.version,
        counts.upserted,
        counts.deleted,
        counts.unchanged,
        (select count(*) from payload_writes) as "payloadWrites",
        (select count(*) from cleared_recoverable_deletions) as "clearedRecoverableDeletions",
        (select count(*) from retained_deletions) as "retainedDeletions",
        (select count(*) from invalidated_edges) as "invalidatedEdges",
        (select count(*) from run_write) as "runWrites",
        (select count(*) from generation_activation) as "generationActivations",
        (select count(*) from cleared_rebuild_changes) as "clearedRebuildChanges"
      from checkpoint_write
      cross join counts
      cross join result_marker
    `);
    const row = result.rows[0];
    if (!row) return { outcome: "conflict" };
    return {
      outcome: "committed",
      upserted: readNonNegativeInteger(row.upserted),
      deleted: readNonNegativeInteger(row.deleted),
      unchanged: readNonNegativeInteger(row.unchanged),
    };
  }

  /** Updates safe health state only and never modifies the encrypted cursor or its version. */
  async recordFailure(record: SyncFailureRecord): Promise<void> {
    if (record.expectedCheckpointVersion === undefined) return;
    await this.database.execute(sql`
      update sync_checkpoints
      set
        status = ${record.state},
        last_error_category = ${record.category},
        updated_at = ${new Date(record.occurredAt)}
      where owner_id = ${record.ownerId}
        and provider = ${PROVIDER}
        and provider_calendar_id = ${record.calendarId}
        and version = ${record.expectedCheckpointVersion}
    `);
  }
}

/** Owner-scoped repository that encrypts every staged protected value before the atomic adapter call. */
class EncryptedSyncRepository implements SyncRepository {
  /** Captures the only owner accepted by this synchronization repository. */
  constructor(
    private readonly store: AtomicSyncStore,
    private readonly keyProvider: KeyProvider,
    private readonly ownerId: string,
  ) {
    if (typeof ownerId !== "string" || ownerId.length === 0) {
      throw new Error("Synchronization repository requires an owner.");
    }
  }

  /** Loads and decrypts the current cursor only for the repository owner. */
  async loadCheckpoint(
    ownerId: string,
    calendarId: string,
    queueAuthority?: QueueCommitAuthority,
  ): Promise<SyncCheckpoint | undefined> {
    this.assertOwner(ownerId);
    const row = await this.store.loadCheckpoint(
      ownerId,
      calendarId,
      queueAuthority,
    );
    if (!row) {
      if (queueAuthority !== undefined) {
        throw new SyncCalendarError("concurrency", "retry_scheduled", true);
      }
      throw new Error("Synchronization checkpoint is unavailable.");
    }
    if (row.version === 0) {
      if (row.tokenEnvelope !== null || row.keyVersion !== null) {
        throw new Error("Initial synchronization checkpoint is invalid.");
      }
      return undefined;
    }
    if (row.tokenEnvelope === null || row.keyVersion === null) {
      throw new Error("Committed synchronization checkpoint is invalid.");
    }
    const decrypted = await decryptProtectedFields(
      this.keyProvider,
      checkpointContext(ownerId, calendarId),
      { syncToken: decodeEnvelope(row.tokenEnvelope) },
    );
    return SyncCheckpointSchema.parse({
      calendarId: row.calendarId,
      syncToken: decrypted.syncToken,
      committedAt: row.committedAt.toISOString(),
      version: row.version,
    });
  }

  /** Encrypts staged event content and atomically applies it with the terminal encrypted cursor. */
  async applyChanges(request: SyncApplyRequest): Promise<SyncApplyResult> {
    this.assertOwner(request.ownerId);
    const nextCheckpoint = SyncCheckpointSchema.parse(request.nextCheckpoint);
    const rebuilding =
      request.replaceProjection === true &&
      request.reason === "rebuild" &&
      typeof request.rebuildGenerationId === "string" &&
      request.rebuildGenerationId.length > 0 &&
      request.rebuildGenerationId.length <= 128;
    const queueReasonValid =
      request.queueJobReason === undefined ||
      (
        request.queueClaimId !== undefined &&
        ["initial", "manual", "push", "rebuild", "repair"].includes(
          request.queueJobReason,
        )
      );
    if (
      nextCheckpoint.calendarId !== request.calendarId ||
      nextCheckpoint.version !== request.expectedCheckpointVersion + 1 ||
      ((request.replaceProjection ?? false) !== rebuilding) ||
      ((request.rebuildGenerationId !== undefined) !== rebuilding) ||
      !queueReasonValid ||
      request.changes.some((change) => {
        const identity = change.type === "upsert" ? change.identity : change.target;
        return (
          identity.sourceSystem !== PROVIDER ||
          identity.sourceCalendarId !== request.calendarId
        );
      })
    ) {
      throw new Error("Synchronization commit scope is invalid.");
    }
    const contexts = new Map(
      (await this.store.loadProjectionContexts(request.ownerId, request.calendarId))
        .map((context) => [context.eventId, context]),
    );
    const prepared: PreparedDatabaseChange[] = [];
    for (const change of request.changes) {
      if (change.type === "delete") {
        prepared.push({
          kind: "delete",
          sourceSystem: change.target.sourceSystem,
          calendarId: change.target.sourceCalendarId,
          eventId: change.target.sourceEventId,
        });
        continue;
      }
      prepared.push(
        preparedUpsertToDatabase(
          await this.prepareUpsert(request.ownerId, change, contexts.get(change.identity.sourceEventId)),
        ),
      );
    }

    const encryptedCheckpoint = await encryptProtectedFields(
      this.keyProvider,
      checkpointContext(request.ownerId, request.calendarId),
      { syncToken: nextCheckpoint.syncToken },
    );
    if (encryptedCheckpoint.syncToken === null) {
      throw new Error("Synchronization token encryption failed.");
    }
    return this.store.applyAtomic({
      ownerId: request.ownerId,
      calendarId: request.calendarId,
      expectedCheckpointVersion: request.expectedCheckpointVersion,
      nextCheckpoint,
      checkpointEnvelope: encodeEnvelope(encryptedCheckpoint.syncToken),
      checkpointKeyVersion: encryptedCheckpoint.syncToken.keyVersion,
      changes: prepared,
      jobId: request.jobId,
      reason: request.reason,
      ...(request.queueJobReason === undefined
        ? {}
        : { queueJobReason: request.queueJobReason }),
      pageCount: request.pageCount,
      startedAt: new Date(request.startedAt),
      replaceProjection: rebuilding,
      ...(request.rebuildGenerationId === undefined
        ? {}
        : { rebuildGenerationId: request.rebuildGenerationId }),
      ...(request.queueClaimId === undefined
        ? {}
        : { queueClaimId: request.queueClaimId }),
    });
  }

  /** Records only safe failure classification for the exact repository owner. */
  async recordFailure(record: SyncFailureRecord): Promise<void> {
    this.assertOwner(record.ownerId);
    await this.store.recordFailure(record);
  }

  /** Preserves existing Vision metadata and encrypts provider content for one upsert. */
  private async prepareUpsert(
    ownerId: string,
    change: UpsertEvent,
    existing: EventProjectionContext | undefined,
  ): Promise<PreparedUpsert> {
    const nodeId = existing?.nodeId ?? await stableEventNodeId(ownerId, change);
    const domain = existing?.domain ?? "unresolved";
    const event = await prepareStoredEventRow(
      {
        nodeId,
        ownerId,
        identity: change.identity,
        startsAt: change.startsAt,
        endsAt: change.endsAt,
        timeZone: change.timeZone,
        busy: change.busy,
        status: change.status,
        ...(change.recurrence.kind === "occurrence"
          ? { recurrenceId: change.recurrence.masterEventId }
          : {}),
        domain,
        domainState: existing?.domainState ?? "unresolved",
        privacy: existing?.privacy ?? "private",
        version: existing?.nodeVersion ?? 1,
        title: change.protected.title,
        description: change.protected.description,
        attendees: change.protected.attendees,
        location: change.protected.location,
        meetingLink: change.protected.meetingLinks[0] ?? null,
      },
      this.keyProvider,
    );
    const encryptedPayload = await encryptProtectedFields(
      this.keyProvider,
      { ownerId, nodeId, domain },
      { providerPayload: JSON.stringify(change.protected) },
    );
    if (encryptedPayload.providerPayload === null) {
      throw new Error("Provider event payload encryption failed.");
    }
    return {
      change,
      event,
      providerPayloadEnvelope: encodeEnvelope(encryptedPayload.providerPayload),
      providerPayloadKeyVersion: encryptedPayload.providerPayload.keyVersion,
      providerNodeId: providerNodeIdentity(change.identity.sourceCalendarId, change.identity.sourceEventId),
      expectedExisting: existing !== undefined,
    };
  }

  /** Rejects every attempt to cross the repository's authenticated owner scope. */
  private assertOwner(ownerId: string): void {
    if (ownerId !== this.ownerId) {
      throw new Error("Synchronization owner scope does not match.");
    }
  }
}

/** Creates the production encrypted synchronization repository for one authenticated owner. */
export function createSyncRepository(
  database: VisionDatabase,
  keyProvider: KeyProvider,
  ownerId: string,
): SyncRepository {
  return new EncryptedSyncRepository(
    new DrizzleAtomicSyncStore(database),
    keyProvider,
    ownerId,
  );
}

/** Creates a repository over an injected atomic store for integration and failure-path testing. */
export function createSyncRepositoryWithStore(
  store: AtomicSyncStore,
  keyProvider: KeyProvider,
  ownerId: string,
): SyncRepository {
  return new EncryptedSyncRepository(store, keyProvider, ownerId);
}

/** Converts one encrypted upsert into the ciphertext-only transaction boundary shape. */
function preparedUpsertToDatabase(prepared: PreparedUpsert): PreparedDatabaseChange {
  return {
    kind: "upsert",
    sourceSystem: prepared.change.identity.sourceSystem,
    calendarId: prepared.change.identity.sourceCalendarId,
    eventId: prepared.change.identity.sourceEventId,
    providerNodeId: prepared.providerNodeId,
    nodeId: prepared.event.nodeId,
    providerVersion: prepared.event.identity.sourceVersion,
    startsAt: prepared.event.startsAt,
    endsAt: prepared.event.endsAt,
    timeZone: prepared.event.timeZone,
    busy: prepared.event.busy,
    status: prepared.change.status,
    recurrenceId: prepared.event.recurrenceId ?? null,
    domain: prepared.event.domain,
    domainState: prepared.event.domainState,
    privacy: prepared.event.privacy,
    nodeVersion: prepared.event.version,
    expectedExisting: prepared.expectedExisting,
    titleEnvelope: bytesToHex(prepared.event.titleEnvelope),
    descriptionEnvelope: bytesToHex(prepared.event.descriptionEnvelope),
    attendeesEnvelope: bytesToHex(prepared.event.attendeesEnvelope) as string,
    locationEnvelope: bytesToHex(prepared.event.locationEnvelope),
    meetingLinkEnvelope: bytesToHex(prepared.event.meetingLinkEnvelope),
    protectedKeyVersion: prepared.event.protectedKeyVersion,
    providerPayloadEnvelope: bytesToHex(prepared.providerPayloadEnvelope) as string,
    providerPayloadKeyVersion: prepared.providerPayloadKeyVersion,
  };
}

/** Derives one opaque stable node identifier without exposing provider identity in logs or queue payloads. */
async function stableEventNodeId(ownerId: string, change: UpsertEvent): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(JSON.stringify([
      "vision-google-event",
      1,
      ownerId,
      change.identity.sourceCalendarId,
      change.identity.sourceEventId,
    ])),
  );
  return `event_${encodeBase64Url(new Uint8Array(digest))}`;
}

/** Creates the collision-free queryable provider identity retained on the canonical node. */
function providerNodeIdentity(calendarId: string, eventId: string): string {
  return JSON.stringify([calendarId, eventId]);
}

/** Binds cursor encryption to its exact owner and calendar under a noncategorical key partition. */
function checkpointContext(ownerId: string, calendarId: string) {
  return {
    ownerId,
    nodeId: `sync-checkpoint:${calendarId}`,
    domain: "unresolved" as const,
  };
}

/** Creates the stable non-secret checkpoint row identifier. */
function checkpointId(ownerId: string, calendarId: string): string {
  return `sync:${PROVIDER}:${ownerId}:${calendarId}`;
}

/** Serializes one validated cipher envelope into binary storage. */
function encodeEnvelope(envelope: CipherEnvelope): Uint8Array {
  return textEncoder.encode(serializeCipherEnvelope(envelope));
}

/** Parses one stored cipher envelope after a strict byte boundary. */
function decodeEnvelope(envelope: Uint8Array): CipherEnvelope {
  return parseCipherEnvelope(textDecoder.decode(envelope));
}

/** Encodes ciphertext bytes for transient JSON-to-recordset transport inside one SQL statement. */
function bytesToHex(value: Uint8Array | null): string | null {
  if (value === null) return null;
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Strictly decodes the raw CAS checkpoint row. */
function decodeCheckpointRow(row: Record<string, unknown>): StoredCheckpointRow {
  const version = readNonNegativeInteger(row.version);
  return {
    ownerId: readText(row.ownerId),
    calendarId: readText(row.calendarId),
    tokenEnvelope: row.tokenEnvelope === null ? null : readBytes(row.tokenEnvelope),
    keyVersion: row.keyVersion === null ? null : readPositiveInteger(row.keyVersion),
    committedAt: readDate(row.committedAt),
    version,
  };
}

/** Strictly decodes planning-only metadata used for event encryption. */
function decodeProjectionContext(row: Record<string, unknown>): EventProjectionContext {
  const domain = readText(row.domain);
  const domainState = readText(row.domainState);
  const privacy = readText(row.privacy);
  if (
    !["school", "work", "personal", "unresolved"].includes(domain) ||
    !["confirmed", "inferred", "unresolved"].includes(domainState) ||
    !["planning", "private", "restricted"].includes(privacy)
  ) {
    throw new Error("Invalid synchronization projection context.");
  }
  return {
    nodeId: readText(row.nodeId),
    eventId: readText(row.eventId),
    domain: domain as EventProjectionContext["domain"],
    domainState: domainState as EventProjectionContext["domainState"],
    privacy: privacy as EventProjectionContext["privacy"],
    nodeVersion: readPositiveInteger(row.nodeVersion),
  };
}

/** Reads one required non-empty database string. */
function readText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Invalid synchronization database row.");
  }
  return value;
}

/** Reads one nonnegative safe integer from Neon or a strict decimal string. */
function readNonNegativeInteger(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^(?:0|[1-9]\d*)$/u.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("Invalid synchronization database row.");
  }
  return parsed;
}

/** Reads one positive safe integer from Neon or a strict decimal string. */
function readPositiveInteger(value: unknown): number {
  const parsed = readNonNegativeInteger(value);
  if (parsed === 0) throw new Error("Invalid synchronization database row.");
  return parsed;
}

/** Reads one genuine or offset-bearing database timestamp. */
function readDate(value: unknown): Date {
  const date =
    value instanceof Date
      ? new Date(Date.prototype.getTime.call(value))
      : typeof value === "string" && /(?:z|[+-]\d{2}(?::?\d{2})?)$/iu.test(value)
        ? new Date(value)
        : new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid synchronization database row.");
  }
  return date;
}

/** Reads canonical PostgreSQL bytea or a copied driver byte array. */
function readBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return Uint8Array.prototype.slice.call(value);
  if (typeof value !== "string" || !/^\\x(?:[0-9a-f]{2})+$/u.test(value)) {
    throw new Error("Invalid synchronization database row.");
  }
  const bytes = new Uint8Array((value.length - 2) / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(2 + index * 2, 4 + index * 2), 16);
  }
  return bytes;
}

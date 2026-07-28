/** Reads owner-scoped operational facts and decrypts only authorized event display fields. */
import { sql } from "drizzle-orm";
import {
  MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS,
  parseCipherEnvelope,
  serializeCipherEnvelope,
  type CipherEnvelope,
} from "../../crypto/envelope";
import type { KeyProvider } from "../../crypto/key-provider";
import {
  decryptProtectedFields,
  encryptProtectedFields,
  type EncryptedProtectedFields,
} from "../../crypto/protected-fields";
import { getChicagoBudgetMonth } from "../../domain/budget/ai-budget";
import type { Domain } from "../../domain/categorization/category";
import type {
  DiagnosticCheckpointStatus,
  DiagnosticSafeErrorCode,
  FoundationHealthFacts,
} from "../../domain/operations/health";
import type { UsageWarningSource } from "../../domain/operations/usage-warnings";
import {
  isVerifiedEventRepositoryAccess,
  matchesEventContentAuthorizationDecision,
  type VerifiedEventRepositoryAccess,
} from "../../server/authorization/event-content-authorization";
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

type DatabaseRow = Record<string, unknown>;
type ConcreteDomain = "school" | "work" | "personal";
type DomainState = "confirmed" | "inferred" | "unresolved";
type Privacy = "planning" | "private" | "restricted";
type CategoryProvenance = "provider" | "user" | "system" | "model";
type PlainCorrectionFields = {
  readonly title: string | null;
  readonly description: string | null;
  readonly attendees: string;
  readonly location: string | null;
  readonly meetingLink: string | null;
};
type EncryptedCorrectionFields =
  EncryptedProtectedFields<PlainCorrectionFields>;

interface DiagnosticPlanningEvent {
  readonly id: string;
  readonly ownerId: string;
  readonly providerVersion: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timeZone: string;
  readonly status: "confirmed" | "tentative" | "cancelled";
  readonly domain: Domain;
  readonly domainState: DomainState;
  readonly privacy: Privacy;
  readonly version: number;
  readonly categoryProvenance: CategoryProvenance;
}

interface CorrectionPlanningSnapshot extends DiagnosticPlanningEvent {
  readonly nodeProvenance: CategoryProvenance;
  readonly assignedDomain: ConcreteDomain | null;
  readonly assignedDomainState: "confirmed" | "inferred" | null;
  readonly assignedProvenance: "user" | "system" | "model" | null;
  readonly assignedAt: Date | null;
  readonly assignedVersion: number | null;
  readonly provider: string;
  readonly providerCalendarId: string;
  readonly providerEventId: string;
  readonly busy: boolean;
  readonly recurrenceId: string | null;
}

interface CorrectionProtectedSnapshot {
  readonly planning: CorrectionPlanningSnapshot;
  readonly titleEnvelope: Uint8Array | null;
  readonly descriptionEnvelope: Uint8Array | null;
  readonly attendeesEnvelope: Uint8Array;
  readonly locationEnvelope: Uint8Array | null;
  readonly meetingLinkEnvelope: Uint8Array | null;
  readonly protectedKeyVersion: number;
  readonly providerPayloadEnvelope: Uint8Array | null;
  readonly providerPayloadKeyVersion: number | null;
}

interface PreparedCorrection {
  readonly expected: CorrectionProtectedSnapshot;
  readonly targetDomain: ConcreteDomain;
  readonly assignedAt: Date;
  readonly eventFields: EncryptedCorrectionFields;
  readonly eventKeyVersion: number;
  readonly providerPayload: CipherEnvelope | null;
}

const textDecoder = new TextDecoder("utf-8", { fatal: true });
const textEncoder = new TextEncoder();
const CONCRETE_DOMAINS = ["school", "work", "personal"] as const;
const CORRECTION_RETRY_LIMIT = 4;
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
  private readonly ownerId: string;

  constructor(
    private readonly database: VisionDatabase,
    private readonly keyProvider: KeyProvider,
    private readonly access: VerifiedEventRepositoryAccess,
    private readonly usageWarningSource: UsageWarningSource,
  ) {
    this.ownerId = access.authenticatedOwnerId;
  }

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
    const usageWarnings = await this.usageWarningSource.readUsageWarnings();
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
      databaseUsageWarning: usageWarnings.databaseUsageWarning,
      r2UsageWarning: usageWarnings.r2UsageWarning,
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

  /** Authorizes planning rows before selecting and decrypting their title envelopes. */
  async listEvents(): Promise<readonly DiagnosticEvent[]> {
    const result = await this.database.execute<DatabaseRow>(sql`
      select
        node.id,
        event.owner_id as "ownerId",
        event.provider_version as "providerVersion",
        event.starts_at as "startsAt",
        event.ends_at as "endsAt",
        event.time_zone as "timeZone",
        event.status,
        node.domain,
        node.domain_state as "domainState",
        node.privacy,
        node.version,
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
    const decoded = await Promise.all(
      result.rows.map(async (row) => {
        const planning = decodePlanningEvent(row);
        return this.authorizePlanningEvent(planning)
          ? this.readAuthorizedDiagnosticEvent(planning)
          : undefined;
      }),
    );
    return Object.freeze(
      decoded.filter((event): event is DiagnosticEvent => event !== undefined),
    );
  }

  /** Rekeys one exact authorized snapshot and atomically records user category authority. */
  async correctCategory(
    eventId: string,
    domain: ConcreteDomain,
    assignedAt: Date,
  ): Promise<DiagnosticCategoryCorrection | undefined> {
    validateEventId(eventId);
    if (!CONCRETE_DOMAINS.includes(domain)) {
      throw new Error("Invalid category correction.");
    }
    assertDate(assignedAt);

    for (let attempt = 0; attempt < CORRECTION_RETRY_LIMIT; attempt += 1) {
      const planning = await this.readCorrectionPlanningSnapshot(eventId);
      if (!planning) return undefined;
      if (!this.authorizePlanningEvent(planning)) {
        throw new Error("Protected event content access is not authorized.");
      }

      const snapshot = await this.readCorrectionProtectedSnapshot(planning);
      if (!snapshot) continue;
      const plaintext = await this.decryptCorrectionSnapshot(snapshot);

      if (isIdempotentCorrection(snapshot.planning, domain)) {
        return correctionFromPlanning(snapshot.planning);
      }

      const prepared = await this.prepareCorrection(
        snapshot,
        plaintext.eventFields,
        plaintext.providerPayload,
        domain,
        assignedAt,
      );
      const corrected = await this.applyCorrection(prepared);
      if (corrected) return corrected;
    }

    throw new Error("Category correction conflicted with a newer event snapshot.");
  }

  /** Applies the existing production capability to the exact planning facts before protected access. */
  private authorizePlanningEvent(planning: DiagnosticPlanningEvent): boolean {
    const request = {
      authenticatedOwnerId: this.ownerId,
      eventOwnerId: planning.ownerId,
      privacy: planning.privacy,
    };
    return matchesEventContentAuthorizationDecision(
      this.access.authorize(request),
      request,
    );
  }

  /** Pins the authorized planning snapshot in the protected-title selection statement. */
  private async readAuthorizedDiagnosticEvent(
    planning: DiagnosticPlanningEvent,
  ): Promise<DiagnosticEvent> {
    const result = await this.database.execute<DatabaseRow>(sql`
      select
        event.title_envelope as "titleEnvelope",
        event.protected_key_version as "protectedKeyVersion"
      from events event
      inner join nodes node
        on node.id = event.node_id and node.owner_id = event.owner_id
      where event.node_id = ${planning.id}
        and event.owner_id = ${this.ownerId}
        and event.provider_version = ${planning.providerVersion}
        and node.domain = ${planning.domain}
        and node.domain_state = ${planning.domainState}
        and node.privacy = ${planning.privacy}
        and node.version = ${planning.version}
        and node.node_type = 'event'
        and node.lifecycle = 'active'
      limit 1
    `);
    const row = result.rows[0];
    if (!row) {
      throw new Error("Authorized diagnostic event changed during protected read.");
    }
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
            {
              ownerId: this.ownerId,
              nodeId: planning.id,
              domain: planning.domain,
            },
            { title: titleEnvelope },
          );
    return Object.freeze({
      id: planning.id,
      title: decrypted.title,
      startsAt: planning.startsAt.toISOString(),
      endsAt: planning.endsAt.toISOString(),
      timeZone: planning.timeZone,
      status: planning.status,
      domain: planning.domain,
      domainState: planning.domainState,
      categoryProvenance: planning.categoryProvenance,
    });
  }

  /** Reads only planning and authority facts before any correction ciphertext is selected. */
  private async readCorrectionPlanningSnapshot(
    eventId: string,
  ): Promise<CorrectionPlanningSnapshot | undefined> {
    const result = await this.database.execute<DatabaseRow>(sql`
      select
        node.id,
        node.owner_id as "ownerId",
        node.domain,
        node.domain_state as "domainState",
        node.privacy,
        node.version,
        node.provenance as "nodeProvenance",
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
        assignment.domain as "assignedDomain",
        assignment.domain_state as "assignedDomainState",
        assignment.provenance as "assignedProvenance",
        assignment.assigned_at as "assignedAt",
        assignment.version as "assignedVersion",
        coalesce(assignment.provenance, node.provenance) as "categoryProvenance"
      from nodes node
      inner join events event
        on event.node_id = node.id and event.owner_id = node.owner_id
      left join node_category_assignments assignment
        on assignment.node_id = node.id and assignment.owner_id = node.owner_id
      where node.id = ${eventId}
        and node.owner_id = ${this.ownerId}
        and node.node_type = 'event'
        and node.lifecycle = 'active'
      limit 1
    `);
    return result.rows[0]
      ? decodeCorrectionPlanningSnapshot(result.rows[0])
      : undefined;
  }

  /** Selects every domain-bound envelope only for the already-authorized exact planning snapshot. */
  private async readCorrectionProtectedSnapshot(
    planning: CorrectionPlanningSnapshot,
  ): Promise<CorrectionProtectedSnapshot | undefined> {
    const result = await this.database.execute<DatabaseRow>(sql`
      select
        event.title_envelope as "titleEnvelope",
        event.description_envelope as "descriptionEnvelope",
        event.attendees_envelope as "attendeesEnvelope",
        event.location_envelope as "locationEnvelope",
        event.meeting_link_envelope as "meetingLinkEnvelope",
        event.protected_key_version as "protectedKeyVersion",
        payload.protected_payload_envelope as "providerPayloadEnvelope",
        payload.protected_key_version as "providerPayloadKeyVersion"
      from events event
      inner join nodes node
        on node.id = event.node_id and node.owner_id = event.owner_id
      left join event_sync_payloads payload
        on payload.node_id = event.node_id and payload.owner_id = event.owner_id
      where event.node_id = ${planning.id}
        and event.owner_id = ${this.ownerId}
        and event.provider = ${planning.provider}
        and event.provider_calendar_id = ${planning.providerCalendarId}
        and event.provider_event_id = ${planning.providerEventId}
        and event.provider_version = ${planning.providerVersion}
        and event.starts_at = ${planning.startsAt}
        and event.ends_at = ${planning.endsAt}
        and event.time_zone = ${planning.timeZone}
        and event.busy = ${planning.busy}
        and event.status = ${planning.status}
        and event.recurrence_id is not distinct from ${planning.recurrenceId}
        and node.domain = ${planning.domain}
        and node.domain_state = ${planning.domainState}
        and node.privacy = ${planning.privacy}
        and node.version = ${planning.version}
        and node.node_type = 'event'
        and node.lifecycle = 'active'
      limit 1
    `);
    return result.rows[0]
      ? decodeCorrectionProtectedSnapshot(planning, result.rows[0])
      : undefined;
  }

  /** Decrypts the exact old-domain event and retained provider payload snapshot. */
  private async decryptCorrectionSnapshot(
    snapshot: CorrectionProtectedSnapshot,
  ): Promise<{
    readonly eventFields: PlainCorrectionFields;
    readonly providerPayload: string | null;
  }> {
    const context = {
      ownerId: this.ownerId,
      nodeId: snapshot.planning.id,
      domain: snapshot.planning.domain,
    };
    const eventFields = await decryptProtectedFields(
      this.keyProvider,
      context,
      decodeCorrectionEventEnvelopes(snapshot),
    );
    const providerPayload =
      snapshot.providerPayloadEnvelope === null
        ? null
        : (
            await decryptProtectedFields(
              this.keyProvider,
              context,
              {
                providerPayload: decodeCheckedEnvelope(
                  snapshot.providerPayloadEnvelope,
                  snapshot.providerPayloadKeyVersion as number,
                ),
              },
            )
          ).providerPayload;
    return { eventFields, providerPayload };
  }

  /** Encrypts all old plaintext under the target domain before any write is reachable. */
  private async prepareCorrection(
    expected: CorrectionProtectedSnapshot,
    eventFields: PlainCorrectionFields,
    providerPayload: string | null,
    targetDomain: ConcreteDomain,
    assignedAt: Date,
  ): Promise<PreparedCorrection> {
    const context = {
      ownerId: this.ownerId,
      nodeId: expected.planning.id,
      domain: targetDomain,
    };
    const encryptedEvent = await encryptProtectedFields(
      this.keyProvider,
      context,
      eventFields,
    );
    const eventKeyVersion = requireOneEnvelopeVersion(encryptedEvent);
    const encryptedPayload =
      providerPayload === null
        ? null
        : (
            await encryptProtectedFields(
              this.keyProvider,
              context,
              { providerPayload },
            )
          ).providerPayload;
    if (providerPayload !== null && encryptedPayload === null) {
      throw new Error("Provider event payload encryption failed.");
    }
    return {
      expected,
      targetDomain,
      assignedAt,
      eventFields: encryptedEvent,
      eventKeyVersion,
      providerPayload: encryptedPayload,
    };
  }

  /** Commits the rekey and category authority only if every old row still matches byte-for-byte. */
  private async applyCorrection(
    prepared: PreparedCorrection,
  ): Promise<DiagnosticCategoryCorrection | undefined> {
    const expected = prepared.expected;
    const planning = expected.planning;
    const hasProviderPayload = expected.providerPayloadEnvelope !== null;
    const result = await this.database.execute<DatabaseRow>(sql`
      with locked_node as materialized (
        select node.id, node.owner_id
        from nodes node
        where node.id = ${planning.id}
          and node.owner_id = ${this.ownerId}
          and node.node_type = 'event'
          and node.lifecycle = 'active'
          and node.domain = ${planning.domain}
          and node.domain_state = ${planning.domainState}
          and node.privacy = ${planning.privacy}
          and node.version = ${planning.version}
        for update
      ),
      locked_event as materialized (
        select event.node_id
        from events event
        inner join locked_node node
          on node.id = event.node_id and node.owner_id = event.owner_id
        where event.provider = ${planning.provider}
          and event.provider_calendar_id = ${planning.providerCalendarId}
          and event.provider_event_id = ${planning.providerEventId}
          and event.provider_version = ${planning.providerVersion}
          and event.starts_at = ${planning.startsAt}
          and event.ends_at = ${planning.endsAt}
          and event.time_zone = ${planning.timeZone}
          and event.busy = ${planning.busy}
          and event.status = ${planning.status}
          and event.recurrence_id is not distinct from ${planning.recurrenceId}
          and event.title_envelope is not distinct from
            ${nullableByteaSql(expected.titleEnvelope)}
          and event.description_envelope is not distinct from
            ${nullableByteaSql(expected.descriptionEnvelope)}
          and event.attendees_envelope =
            ${requiredByteaSql(expected.attendeesEnvelope)}
          and event.location_envelope is not distinct from
            ${nullableByteaSql(expected.locationEnvelope)}
          and event.meeting_link_envelope is not distinct from
            ${nullableByteaSql(expected.meetingLinkEnvelope)}
          and event.protected_key_version = ${expected.protectedKeyVersion}
        for update of event
      ),
      locked_payload as materialized (
        select payload.node_id
        from event_sync_payloads payload
        inner join locked_event event on event.node_id = payload.node_id
        where ${hasProviderPayload}
          and payload.owner_id = ${this.ownerId}
          and payload.protected_payload_envelope =
            ${requiredByteaSql(
              expected.providerPayloadEnvelope ?? new Uint8Array([0]),
            )}
          and payload.protected_key_version =
            ${expected.providerPayloadKeyVersion ?? 0}
        for update of payload
      ),
      payload_guard as materialized (
        select event.node_id
        from locked_event event
        where (
          ${hasProviderPayload}
          and exists (
            select 1 from locked_payload payload
            where payload.node_id = event.node_id
          )
        ) or (
          not ${hasProviderPayload}
          and not exists (
            select 1
            from event_sync_payloads payload
            where payload.node_id = event.node_id
              and payload.owner_id = ${this.ownerId}
          )
        )
      ),
      event_write as (
        update events event
        set
          title_envelope = ${nullableByteaSql(
            encodeEnvelope(prepared.eventFields.title),
          )},
          description_envelope = ${nullableByteaSql(
            encodeEnvelope(prepared.eventFields.description),
          )},
          attendees_envelope = ${requiredByteaSql(
            encodeRequiredEnvelope(prepared.eventFields.attendees),
          )},
          location_envelope = ${nullableByteaSql(
            encodeEnvelope(prepared.eventFields.location),
          )},
          meeting_link_envelope = ${nullableByteaSql(
            encodeEnvelope(prepared.eventFields.meetingLink),
          )},
          protected_key_version = ${prepared.eventKeyVersion}
        from payload_guard guard
        where event.node_id = guard.node_id
          and event.owner_id = ${this.ownerId}
        returning event.node_id
      ),
      payload_write as (
        update event_sync_payloads payload
        set
          protected_payload_envelope = ${requiredByteaSql(
            prepared.providerPayload === null
              ? new Uint8Array([0])
              : encodeRequiredEnvelope(prepared.providerPayload),
          )},
          protected_key_version = ${prepared.providerPayload?.keyVersion ?? 1}
        from event_write event
        where ${hasProviderPayload}
          and payload.node_id = event.node_id
          and payload.owner_id = ${this.ownerId}
        returning payload.node_id
      ),
      node_write as (
        update nodes node
        set
          domain = ${prepared.targetDomain},
          domain_state = 'confirmed',
          provenance = 'user',
          model_confidence = null,
          updated_at = greatest(node.updated_at, ${prepared.assignedAt}),
          version = node.version + 1
        from event_write event
        where node.id = event.node_id
          and node.owner_id = ${this.ownerId}
          and (
            not ${hasProviderPayload}
            or exists (
              select 1 from payload_write payload
              where payload.node_id = event.node_id
            )
          )
        returning node.id, node.owner_id, node.domain, node.version
      ),
      assigned as (
        insert into node_category_assignments (
          node_id, owner_id, domain, domain_state, provenance, assigned_at,
          version
        )
        select
          node.id, node.owner_id, node.domain, 'confirmed', 'user',
          ${prepared.assignedAt}, node.version
        from node_write node
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
    return result.rows[0]
      ? decodeCorrectionResult(result.rows[0])
      : undefined;
  }
}

/** Decodes the planning-only event row used before protected title authorization. */
function decodePlanningEvent(row: DatabaseRow): DiagnosticPlanningEvent {
  return {
    id: decodeText(row.id, 128),
    ownerId: decodeText(row.ownerId, 128),
    providerVersion: decodeText(row.providerVersion, 512),
    startsAt: decodeDate(row.startsAt),
    endsAt: decodeDate(row.endsAt),
    timeZone: decodeText(row.timeZone, 255),
    status: decodeEnum(
      row.status,
      ["confirmed", "tentative", "cancelled"] as const,
    ),
    domain: decodeEnum(
      row.domain,
      ["school", "work", "personal", "unresolved"] as const,
    ),
    domainState: decodeEnum(
      row.domainState,
      ["confirmed", "inferred", "unresolved"] as const,
    ),
    privacy: decodeEnum(
      row.privacy,
      ["planning", "private", "restricted"] as const,
    ),
    version: decodePositiveInteger(row.version),
    categoryProvenance: decodeEnum(
      row.categoryProvenance,
      ["provider", "user", "system", "model"] as const,
    ),
  };
}

/** Decodes one exact correction planning snapshot and its optional assignment authority. */
function decodeCorrectionPlanningSnapshot(
  row: DatabaseRow,
): CorrectionPlanningSnapshot {
  const planning = decodePlanningEvent(row);
  const assignmentCells = [
    row.assignedDomain,
    row.assignedDomainState,
    row.assignedProvenance,
    row.assignedAt,
    row.assignedVersion,
  ];
  const hasAssignment = assignmentCells.every((value) => value !== null);
  if (
    !hasAssignment &&
    assignmentCells.some((value) => value !== null)
  ) {
    throw new Error("Invalid diagnostic database row.");
  }
  return {
    ...planning,
    nodeProvenance: decodeEnum(
      row.nodeProvenance,
      ["provider", "user", "system", "model"] as const,
    ),
    assignedDomain: hasAssignment
      ? decodeEnum(row.assignedDomain, CONCRETE_DOMAINS)
      : null,
    assignedDomainState: hasAssignment
      ? decodeEnum(row.assignedDomainState, ["confirmed", "inferred"] as const)
      : null,
    assignedProvenance: hasAssignment
      ? decodeEnum(
          row.assignedProvenance,
          ["user", "system", "model"] as const,
        )
      : null,
    assignedAt: hasAssignment ? decodeDate(row.assignedAt) : null,
    assignedVersion: hasAssignment
      ? decodePositiveInteger(row.assignedVersion)
      : null,
    provider: decodeText(row.provider, 255),
    providerCalendarId: decodeText(row.providerCalendarId, 1024),
    providerEventId: decodeText(row.providerEventId, 1024),
    busy: decodeBoolean(row.busy),
    recurrenceId:
      row.recurrenceId === null
        ? null
        : decodeText(row.recurrenceId, 1024),
  };
}

/** Copies and validates every protected row value used by the correction CAS. */
function decodeCorrectionProtectedSnapshot(
  planning: CorrectionPlanningSnapshot,
  row: DatabaseRow,
): CorrectionProtectedSnapshot {
  const providerPayloadEnvelope =
    row.providerPayloadEnvelope === null
      ? null
      : decodeBytea(row.providerPayloadEnvelope);
  const providerPayloadKeyVersion =
    row.providerPayloadKeyVersion === null
      ? null
      : decodePositiveInteger(row.providerPayloadKeyVersion);
  if (
    (providerPayloadEnvelope === null) !==
    (providerPayloadKeyVersion === null)
  ) {
    throw new Error("Protected provider payload key metadata is inconsistent.");
  }
  return {
    planning,
    titleEnvelope:
      row.titleEnvelope === null ? null : decodeBytea(row.titleEnvelope),
    descriptionEnvelope:
      row.descriptionEnvelope === null
        ? null
        : decodeBytea(row.descriptionEnvelope),
    attendeesEnvelope: decodeBytea(row.attendeesEnvelope),
    locationEnvelope:
      row.locationEnvelope === null
        ? null
        : decodeBytea(row.locationEnvelope),
    meetingLinkEnvelope:
      row.meetingLinkEnvelope === null
        ? null
        : decodeBytea(row.meetingLinkEnvelope),
    protectedKeyVersion: decodePositiveInteger(row.protectedKeyVersion),
    providerPayloadEnvelope,
    providerPayloadKeyVersion,
  };
}

/** Parses event envelopes and requires all represented fields to match row key metadata. */
function decodeCorrectionEventEnvelopes(
  snapshot: CorrectionProtectedSnapshot,
): EncryptedCorrectionFields {
  const fields = {
    title:
      snapshot.titleEnvelope === null
        ? null
        : decodeCheckedEnvelope(
            snapshot.titleEnvelope,
            snapshot.protectedKeyVersion,
          ),
    description:
      snapshot.descriptionEnvelope === null
        ? null
        : decodeCheckedEnvelope(
            snapshot.descriptionEnvelope,
            snapshot.protectedKeyVersion,
          ),
    attendees: decodeCheckedEnvelope(
      snapshot.attendeesEnvelope,
      snapshot.protectedKeyVersion,
    ),
    location:
      snapshot.locationEnvelope === null
        ? null
        : decodeCheckedEnvelope(
            snapshot.locationEnvelope,
            snapshot.protectedKeyVersion,
          ),
    meetingLink:
      snapshot.meetingLinkEnvelope === null
        ? null
        : decodeCheckedEnvelope(
            snapshot.meetingLinkEnvelope,
            snapshot.protectedKeyVersion,
          ),
  };
  requireOneEnvelopeVersion(fields, snapshot.protectedKeyVersion);
  return fields;
}

/** Parses one bounded envelope and checks its authenticated key-version metadata. */
function decodeCheckedEnvelope(
  bytes: Uint8Array,
  expectedKeyVersion: number,
): CipherEnvelope {
  const envelope = parseCipherEnvelope(textDecoder.decode(bytes));
  if (envelope.keyVersion !== expectedKeyVersion) {
    throw new Error("Protected event key metadata is inconsistent.");
  }
  return envelope;
}

/** Requires one non-null key version across a complete protected field group. */
function requireOneEnvelopeVersion(
  fields: EncryptedCorrectionFields,
  expectedVersion?: number,
): number {
  const versions = new Set(
    Object.values(fields)
      .filter((envelope): envelope is CipherEnvelope => envelope !== null)
      .map((envelope) => envelope.keyVersion),
  );
  if (
    versions.size !== 1 ||
    (expectedVersion !== undefined && !versions.has(expectedVersion))
  ) {
    throw new Error("Protected event key metadata is inconsistent.");
  }
  return [...versions][0]!;
}

/** Recognizes a repeated explicit correction without rotating ciphertext or node version. */
function isIdempotentCorrection(
  planning: CorrectionPlanningSnapshot,
  targetDomain: ConcreteDomain,
): boolean {
  return (
    planning.domain === targetDomain &&
    planning.domainState === "confirmed" &&
    planning.nodeProvenance === "user" &&
    planning.assignedDomain === targetDomain &&
    planning.assignedDomainState === "confirmed" &&
    planning.assignedProvenance === "user" &&
    planning.assignedAt !== null &&
    planning.assignedVersion === planning.version
  );
}

/** Returns the already-persisted explicit authority for an idempotent correction. */
function correctionFromPlanning(
  planning: CorrectionPlanningSnapshot,
): DiagnosticCategoryCorrection {
  if (
    planning.assignedDomain === null ||
    planning.assignedAt === null ||
    planning.assignedVersion === null
  ) {
    throw new Error("Explicit category authority is incomplete.");
  }
  return Object.freeze({
    id: planning.id,
    domain: planning.assignedDomain,
    domainState: "confirmed",
    categoryProvenance: "user",
    assignedAt: planning.assignedAt.toISOString(),
    version: planning.assignedVersion,
  });
}

/** Decodes one successful atomic correction result without exposing protected values. */
function decodeCorrectionResult(row: DatabaseRow): DiagnosticCategoryCorrection {
  return Object.freeze({
    id: decodeText(row.id, 128),
    domain: decodeEnum(row.domain, CONCRETE_DOMAINS),
    domainState: "confirmed",
    categoryProvenance: "user",
    assignedAt: decodeDate(row.assignedAt).toISOString(),
    version: decodePositiveInteger(row.version),
  });
}

/** Serializes one optional validated envelope for byte-for-byte SQL comparison or replacement. */
function encodeEnvelope(envelope: CipherEnvelope | null): Uint8Array | null {
  return envelope === null
    ? null
    : textEncoder.encode(serializeCipherEnvelope(envelope));
}

/** Serializes one required validated envelope. */
function encodeRequiredEnvelope(envelope: CipherEnvelope | null): Uint8Array {
  const encoded = encodeEnvelope(envelope);
  if (encoded === null) {
    throw new Error("Required protected event ciphertext is missing.");
  }
  return encoded;
}

/** Produces one typed SQL `bytea` value while preserving null exactly. */
function nullableByteaSql(value: Uint8Array | null) {
  const hex = value === null ? null : bytesToHex(value);
  return sql`
    case
      when ${hex}::text is null then null::bytea
      else decode(${hex}, 'hex')
    end
  `;
}

/** Produces one required typed SQL `bytea` value from bounded bytes. */
function requiredByteaSql(value: Uint8Array) {
  return sql`decode(${bytesToHex(value)}, 'hex')`;
}

/** Encodes bounded ciphertext bytes for transient parameterized SQL transport. */
function bytesToHex(value: Uint8Array): string {
  if (
    !(value instanceof Uint8Array) ||
    value.byteLength === 0 ||
    value.byteLength > MAX_SERIALIZED_CIPHER_ENVELOPE_CHARS
  ) {
    throw new Error("Invalid diagnostic ciphertext.");
  }
  return [...value]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Creates an authenticated-owner repository with externally measured warning flags. */
export function createDiagnosticRepository(
  database: VisionDatabase,
  keyProvider: KeyProvider,
  access: VerifiedEventRepositoryAccess,
  usageWarningSource: UsageWarningSource,
): DiagnosticRepositoryPort {
  if (
    !isVerifiedEventRepositoryAccess(access) ||
    !usageWarningSource ||
    typeof usageWarningSource.readUsageWarnings !== "function"
  ) {
    throw new Error("Invalid diagnostic repository scope.");
  }
  return new DiagnosticRepository(
    database,
    keyProvider,
    access,
    usageWarningSource,
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

/** Reads a PostgreSQL boolean from Neon raw text or an already-decoded driver value. */
function decodeBoolean(value: unknown): boolean {
  if (value === true || value === "t") return true;
  if (value === false || value === "f") return false;
  throw new Error("Invalid diagnostic database row.");
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

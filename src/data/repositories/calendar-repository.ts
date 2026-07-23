/** Persists owner-bound calendar setup state, evidence, and one-shot creation operations. */
import { sql } from "drizzle-orm";
import type { VisionDatabase } from "../db";

/** Exact provider evidence required before Vision offers or connects a calendar. */
export interface VerifiedCalendarEvidence {
  readonly id: string;
  readonly summary: "Vision";
  readonly accessRole: "owner";
  readonly timeZone: string;
  readonly providerEtag: string;
  readonly ownerGoogleSubject: string;
  readonly verifiedAt: Date;
}

/** Persisted calendar connection returned without token or provider-body data. */
export interface CalendarConnection {
  readonly calendarId: string;
  readonly connectionKind: "existing" | "created";
  readonly timeZone: string;
  readonly providerEtag: string;
  readonly verifiedAt: Date;
}

/** Client-safe versioned setup snapshot with normalized candidates and optional connection. */
export interface CalendarSetupSnapshot {
  readonly setupVersion: number;
  readonly status:
    | "authenticated"
    | "discovering"
    | "awaiting_choice"
    | "awaiting_confirmation"
    | "creating"
    | "connected"
    | "failed";
  readonly actionRequired: boolean;
  readonly candidates: readonly VerifiedCalendarEvidence[];
  readonly connection?: CalendarConnection;
}

/** Durable local creation-operation state used to suppress retries after an uncertain response. */
export interface CalendarCreationOperation {
  readonly idempotencyKey: string;
  readonly setupVersion: number;
  readonly status:
    | "in_progress"
    | "retryable"
    | "completed"
    | "action_required"
    | "definite_failure";
  readonly requestedAt: Date;
  readonly completedAt?: Date;
  readonly resultCalendarId?: string;
  readonly preCreateCalendarIds: readonly string[];
}

/** Result of atomically attempting to claim a setup version and idempotency key. */
export type BeginCreationResult =
  | { readonly kind: "started"; readonly operation: CalendarCreationOperation }
  | { readonly kind: "existing"; readonly operation: CalendarCreationOperation };

/** Route-facing repository surface implemented by production SQL and deterministic test stores. */
export interface CalendarRepositoryPort {
  getOrCreateAuthenticated(now: Date): Promise<CalendarSetupSnapshot>;
  discover(setupVersion: number, calendars: readonly VerifiedCalendarEvidence[], now: Date): Promise<CalendarSetupSnapshot>;
  selectExisting(setupVersion: number, calendar: VerifiedCalendarEvidence, now: Date): Promise<CalendarSetupSnapshot>;
  beginCreation(setupVersion: number, idempotencyKey: string, preCreateCalendars: readonly VerifiedCalendarEvidence[], now: Date): Promise<BeginCreationResult>;
  findCreationOperation(idempotencyKey: string): Promise<CalendarCreationOperation | undefined>;
  completeCreation(idempotencyKey: string, calendar: VerifiedCalendarEvidence, now: Date): Promise<CalendarSetupSnapshot>;
  markCreationUncertain(idempotencyKey: string, outcome: "retryable" | "action_required", now: Date): Promise<CalendarSetupSnapshot>;
  markCreationDefiniteFailure(idempotencyKey: string, now: Date): Promise<CalendarSetupSnapshot>;
  getSnapshot(): Promise<CalendarSetupSnapshot | undefined>;
}

/** Constant safe repository error codes suitable for route mapping. */
export type CalendarRepositoryErrorCode =
  | "STALE_SETUP_VERSION"
  | "INVALID_CALENDAR_EVIDENCE"
  | "CALENDAR_PERSISTENCE_FAILED";

/** Removes database and owner details from persistence failures. */
export class CalendarRepositoryError extends Error {
  /** Creates one safe typed repository failure without retaining a cause. */
  constructor(public readonly code: CalendarRepositoryErrorCode) {
    super(code);
    this.name = "CalendarRepositoryError";
  }
}

/** Parameterized PostgreSQL adapter for atomic calendar setup mutations. */
export class DrizzleCalendarStore {
  /** Binds setup persistence to Vision's authoritative database. */
  constructor(private readonly database: VisionDatabase) {}

  /** Creates one authenticated setup row or reads its exact owner-subject winner. */
  async getOrCreateAuthenticated(
    ownerId: string,
    googleSubject: string,
    now: Date,
  ): Promise<void> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      insert into calendar_setup_states (
        owner_id, google_subject, setup_version, status, action_required, updated_at
      ) values (
        ${ownerId}, ${googleSubject}, 1, 'authenticated', false, ${now}
      )
      on conflict (owner_id) do nothing
      returning owner_id as "ownerId"
    `);
    if (result.rows[0]) return;
    const winner = await this.database.execute<Record<string, unknown>>(sql`
      select owner_id as "ownerId"
      from calendar_setup_states
      where owner_id = ${ownerId} and google_subject = ${googleSubject}
      limit 1
    `);
    if (!winner.rows[0]) throw persistenceFailure();
  }

  /** Atomically creates or CASes setup directly to the final discovery result and replaces candidates. */
  async discover(
    ownerId: string,
    googleSubject: string,
    expectedVersion: number,
    calendars: readonly VerifiedCalendarEvidence[],
    now: Date,
  ): Promise<boolean> {
    const candidateJson = JSON.stringify(calendars.map(toCandidateParameter));
    const result = await this.database.execute<Record<string, unknown>>(sql`
      with advanced as (
        insert into calendar_setup_states (
          owner_id, google_subject, setup_version, status,
          action_required, updated_at
        )
        select
          ${ownerId}, ${googleSubject}, ${expectedVersion + 1},
          case
            when ${calendars.length}::integer = 0 then 'awaiting_confirmation'
            else 'awaiting_choice'
          end,
          false,
          ${now}
        where ${expectedVersion}::integer = 1
           or exists (
             select 1 from calendar_setup_states
             where owner_id = ${ownerId}
           )
        on conflict (owner_id) do update set
          setup_version = calendar_setup_states.setup_version + 1,
          status = excluded.status,
          action_required = false,
          updated_at = excluded.updated_at
        where calendar_setup_states.google_subject = ${googleSubject}
          and calendar_setup_states.setup_version = ${expectedVersion}
          and calendar_setup_states.status in (
            'authenticated', 'awaiting_confirmation', 'failed'
          )
          and (
            calendar_setup_states.status <> 'failed'
            or not exists (
              select 1 from operation_ledger
              where owner_id = ${ownerId}
                and operation_kind = 'vision_calendar_create'
                and status in ('in_progress', 'retryable', 'action_required')
            )
          )
        returning owner_id
      ),
      cleared as (
        delete from calendar_setup_candidates
        where owner_id = ${ownerId}
          and exists (select 1 from advanced)
        returning owner_id
      ),
      inserted as (
        insert into calendar_setup_candidates (
          owner_id, provider_calendar_id, google_subject, summary,
          ownership_access_role, time_zone, provider_etag, verified_at
        )
        select
          ${ownerId}, candidate.id, ${googleSubject}, 'Vision', 'owner',
          candidate.time_zone, candidate.provider_etag, candidate.verified_at
        from jsonb_to_recordset(${candidateJson}::jsonb) as candidate(
          id text, time_zone text, provider_etag text, verified_at timestamptz
        )
        where exists (select 1 from advanced)
        returning owner_id
      )
      select owner_id as "ownerId" from advanced
    `);
    return result.rows.length === 1;
  }

  /** Connects one reverified candidate only if it still belongs to the exact current choice set. */
  async selectExisting(
    ownerId: string,
    googleSubject: string,
    expectedVersion: number,
    calendar: VerifiedCalendarEvidence,
    now: Date,
  ): Promise<boolean> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      with advanced as (
        update calendar_setup_states as setup
        set setup_version = setup.setup_version + 1,
            status = 'connected',
            action_required = false,
            updated_at = ${now}
        where setup.owner_id = ${ownerId}
          and setup.google_subject = ${googleSubject}
          and setup.setup_version = ${expectedVersion}
          and setup.status = 'awaiting_choice'
          and exists (
            select 1 from calendar_setup_candidates as candidate
            where candidate.owner_id = setup.owner_id
              and candidate.provider_calendar_id = ${calendar.id}
              and candidate.google_subject = ${googleSubject}
          )
        returning setup.owner_id
      ),
      connected as (
        insert into vision_calendar_connections (
          owner_id, google_subject, provider_calendar_id, summary,
          ownership_access_role, time_zone, provider_etag, verified_at,
          connection_kind
        )
        select
          ${ownerId}, ${googleSubject}, ${calendar.id}, 'Vision', 'owner',
          ${calendar.timeZone}, ${calendar.providerEtag}, ${calendar.verifiedAt},
          'existing'
        from advanced
        on conflict (owner_id) do update set
          google_subject = excluded.google_subject,
          provider_calendar_id = excluded.provider_calendar_id,
          summary = excluded.summary,
          ownership_access_role = excluded.ownership_access_role,
          time_zone = excluded.time_zone,
          provider_etag = excluded.provider_etag,
          verified_at = excluded.verified_at,
          connection_kind = excluded.connection_kind
        returning owner_id
      )
      select owner_id as "ownerId" from advanced
    `);
    return result.rows.length === 1;
  }

  /** Claims the exact confirmation version, creates the ledger, and stores the pre-create snapshot atomically. */
  async beginCreation(
    ownerId: string,
    googleSubject: string,
    expectedVersion: number,
    idempotencyKey: string,
    preCreateCalendarIds: readonly string[],
    now: Date,
  ): Promise<boolean> {
    const snapshotJson = JSON.stringify(
      preCreateCalendarIds.map((id) => ({ id })),
    );
    const result = await this.database.execute<Record<string, unknown>>(sql`
      with advanced as (
        update calendar_setup_states
        set setup_version = setup_version + 1,
            status = 'creating',
            action_required = false,
            updated_at = ${now}
        where owner_id = ${ownerId}
          and google_subject = ${googleSubject}
          and setup_version = ${expectedVersion}
          and status = 'awaiting_confirmation'
        returning owner_id, setup_version
      ),
      inserted_operation as (
        insert into operation_ledger (
          operation_id, owner_id, provider, provider_operation_id,
          operation_kind, status, requested_at, completed_at,
          response_envelope, setup_version, result_calendar_id
        )
        select
          ${idempotencyKey}, ${ownerId}, 'google', ${idempotencyKey},
          'vision_calendar_create', 'in_progress', ${now}, null, null,
          ${expectedVersion}, null
        from advanced
        returning operation_id
      ),
      inserted_snapshot as (
        insert into calendar_create_snapshots (
          operation_id, owner_id, provider_calendar_id
        )
        select ${idempotencyKey}, ${ownerId}, snapshot.id
        from jsonb_to_recordset(${snapshotJson}::jsonb) as snapshot(id text)
        where exists (select 1 from inserted_operation)
        returning operation_id
      )
      select owner_id as "ownerId" from advanced
    `);
    return result.rows.length === 1;
  }

  /** Reads one owner-scoped creation ledger and its normalized pre-create ID snapshot. */
  async findCreationOperation(
    ownerId: string,
    idempotencyKey: string,
  ): Promise<CalendarCreationOperation | undefined> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        ledger.operation_id as "idempotencyKey",
        ledger.setup_version as "setupVersion",
        ledger.status,
        ledger.requested_at as "requestedAt",
        ledger.completed_at as "completedAt",
        ledger.result_calendar_id as "resultCalendarId",
        snapshot.provider_calendar_id as "snapshotCalendarId"
      from operation_ledger as ledger
      left join calendar_create_snapshots as snapshot
        on snapshot.operation_id = ledger.operation_id
       and snapshot.owner_id = ledger.owner_id
      where ledger.owner_id = ${ownerId}
        and ledger.provider = 'google'
        and ledger.operation_kind = 'vision_calendar_create'
        and ledger.operation_id = ${idempotencyKey}
      order by snapshot.provider_calendar_id
    `);
    return decodeCreationOperation(result.rows);
  }

  /** Persists one returned or reconciled calendar and completes its ledger and setup state atomically. */
  async completeCreation(
    ownerId: string,
    googleSubject: string,
    idempotencyKey: string,
    calendar: VerifiedCalendarEvidence,
    now: Date,
  ): Promise<boolean> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      with eligible as (
        select operation_id
        from operation_ledger
        where operation_id = ${idempotencyKey}
          and owner_id = ${ownerId}
          and provider = 'google'
          and operation_kind = 'vision_calendar_create'
          and status in ('in_progress', 'retryable')
      ),
      advanced as (
        update calendar_setup_states
        set setup_version = setup_version + 1,
            status = 'connected',
            action_required = false,
            updated_at = ${now}
        where owner_id = ${ownerId}
          and google_subject = ${googleSubject}
          and status in ('creating', 'failed')
          and exists (select 1 from eligible)
        returning owner_id
      ),
      connected as (
        insert into vision_calendar_connections (
          owner_id, google_subject, provider_calendar_id, summary,
          ownership_access_role, time_zone, provider_etag, verified_at,
          connection_kind
        )
        select
          ${ownerId}, ${googleSubject}, ${calendar.id}, 'Vision', 'owner',
          ${calendar.timeZone}, ${calendar.providerEtag}, ${calendar.verifiedAt},
          'created'
        from advanced
        on conflict (owner_id) do update set
          google_subject = excluded.google_subject,
          provider_calendar_id = excluded.provider_calendar_id,
          summary = excluded.summary,
          ownership_access_role = excluded.ownership_access_role,
          time_zone = excluded.time_zone,
          provider_etag = excluded.provider_etag,
          verified_at = excluded.verified_at,
          connection_kind = excluded.connection_kind
        returning owner_id
      ),
      completed as (
        update operation_ledger
        set status = 'completed',
            completed_at = ${now},
            result_calendar_id = ${calendar.id}
        where operation_id = ${idempotencyKey}
          and owner_id = ${ownerId}
          and exists (select 1 from connected)
        returning operation_id
      )
      select operation_id as "operationId" from completed
    `);
    return result.rows.length === 1;
  }

  /** Moves one uncertain operation to retryable or manual action without authorizing another create. */
  async markCreationUncertain(
    ownerId: string,
    googleSubject: string,
    idempotencyKey: string,
    status: "retryable" | "action_required",
    now: Date,
  ): Promise<boolean> {
    const priorOperationStatus =
      status === "retryable" ? "in_progress" : "retryable";
    const priorSetupStatus =
      status === "retryable" ? "creating" : "failed";
    const priorSetupVersionOffset = status === "retryable" ? 1 : 2;
    const priorActionRequired = false;
    const result = await this.database.execute<Record<string, unknown>>(sql`
      with eligible as (
        select
          ledger.operation_id,
          setup.setup_version,
          setup.status as setup_status,
          setup.action_required
        from operation_ledger ledger
        join calendar_setup_states setup
          on setup.owner_id = ledger.owner_id
         and setup.google_subject = ${googleSubject}
         and setup.setup_version = ledger.setup_version + ${priorSetupVersionOffset}
         and setup.status = ${priorSetupStatus}
         and setup.action_required = ${priorActionRequired}
        where ledger.operation_id = ${idempotencyKey}
          and ledger.owner_id = ${ownerId}
          and ledger.provider = 'google'
          and ledger.operation_kind = 'vision_calendar_create'
          and ledger.status = ${priorOperationStatus}
        for update of ledger, setup
      ),
      changed as (
        update operation_ledger ledger
        set status = ${status}
        from eligible
        where ledger.operation_id = eligible.operation_id
        returning ledger.operation_id
      ),
      failed as (
        update calendar_setup_states setup
        set setup_version = setup.setup_version + 1,
            status = 'failed',
            action_required = ${status === "action_required"},
            updated_at = ${now}
        from eligible
        where setup.owner_id = ${ownerId}
          and setup.google_subject = ${googleSubject}
          and setup.setup_version = eligible.setup_version
          and setup.status = eligible.setup_status
          and setup.action_required = eligible.action_required
          and exists (select 1 from changed)
        returning setup.owner_id
      )
      select owner_id as "ownerId" from failed
    `);
    return result.rows.length === 1;
  }

  /** Terminalizes a known non-mutation rejection and releases the unresolved-operation index claim. */
  async markCreationDefiniteFailure(
    ownerId: string,
    googleSubject: string,
    idempotencyKey: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      with eligible as (
        select
          ledger.operation_id,
          setup.setup_version,
          setup.status as setup_status,
          setup.action_required
        from operation_ledger ledger
        join calendar_setup_states setup
          on setup.owner_id = ledger.owner_id
         and setup.google_subject = ${googleSubject}
         and setup.setup_version = ledger.setup_version +
           case ledger.status
             when 'in_progress' then 1
             when 'retryable' then 2
             when 'action_required' then 3
           end
         and (
           (ledger.status = 'in_progress' and setup.status = 'creating' and setup.action_required = false)
           or (ledger.status = 'retryable' and setup.status = 'failed' and setup.action_required = false)
           or (ledger.status = 'action_required' and setup.status = 'failed' and setup.action_required = true)
         )
        where ledger.operation_id = ${idempotencyKey}
          and ledger.owner_id = ${ownerId}
          and ledger.provider = 'google'
          and ledger.operation_kind = 'vision_calendar_create'
          and ledger.status in ('in_progress', 'retryable', 'action_required')
        for update of ledger, setup
      ),
      changed as (
        update operation_ledger ledger
        set status = 'definite_failure',
            completed_at = ${now}
        from eligible
        where ledger.operation_id = eligible.operation_id
        returning ledger.operation_id
      ),
      failed as (
        update calendar_setup_states setup
        set setup_version = setup.setup_version + 1,
            status = 'failed',
            action_required = true,
            updated_at = ${now}
        from eligible
        where setup.owner_id = ${ownerId}
          and setup.google_subject = ${googleSubject}
          and setup.setup_version = eligible.setup_version
          and setup.status = eligible.setup_status
          and setup.action_required = eligible.action_required
          and exists (select 1 from changed)
        returning setup.owner_id
      )
      select owner_id as "ownerId" from failed
    `);
    return result.rows.length === 1;
  }

  /** Reads one owner-subject setup state plus normalized candidates and connection metadata. */
  async readSnapshot(
    ownerId: string,
    googleSubject: string,
  ): Promise<CalendarSetupSnapshot | undefined> {
    const states = await this.database.execute<Record<string, unknown>>(sql`
      select
        owner_id as "ownerId",
        google_subject as "googleSubject",
        setup_version as "setupVersion",
        status,
        action_required as "actionRequired"
      from calendar_setup_states
      where owner_id = ${ownerId} and google_subject = ${googleSubject}
      limit 1
    `);
    if (!states.rows[0]) return undefined;
    const candidates = await this.database.execute<Record<string, unknown>>(sql`
      select
        provider_calendar_id as id,
        summary,
        ownership_access_role as "accessRole",
        time_zone as "timeZone",
        provider_etag as "providerEtag",
        google_subject as "ownerGoogleSubject",
        verified_at as "verifiedAt"
      from calendar_setup_candidates
      where owner_id = ${ownerId} and google_subject = ${googleSubject}
      order by provider_calendar_id
      limit 100
    `);
    const connections = await this.database.execute<Record<string, unknown>>(sql`
      select
        provider_calendar_id as "calendarId",
        connection_kind as "connectionKind",
        time_zone as "timeZone",
        provider_etag as "providerEtag",
        verified_at as "verifiedAt"
      from vision_calendar_connections
      where owner_id = ${ownerId} and google_subject = ${googleSubject}
      limit 1
    `);
    return decodeSetupSnapshot(
      states.rows[0],
      candidates.rows,
      connections.rows[0],
    );
  }
}

/** Owner- and verified-account-scoped repository used by setup route orchestration. */
export class CalendarRepository implements CalendarRepositoryPort {
  /** Captures immutable ownership scope so callers cannot substitute it per operation. */
  constructor(
    private readonly store: DrizzleCalendarStore,
    private readonly ownerId: string,
    private readonly googleSubject: string,
  ) {
    if (!isBoundedText(ownerId, 128) || !isBoundedText(googleSubject, 255)) {
      throw persistenceFailure();
    }
  }

  /** Creates or reads the initial authenticated state for this exact owner and account. */
  async getOrCreateAuthenticated(now: Date): Promise<CalendarSetupSnapshot> {
    assertDate(now);
    await this.store.getOrCreateAuthenticated(
      this.ownerId,
      this.googleSubject,
      now,
    );
    return this.requireSnapshot();
  }

  /** Persists one provider result in a single final-state CAS or returns the concurrent winner. */
  async discover(
    setupVersion: number,
    calendars: readonly VerifiedCalendarEvidence[],
    now: Date,
  ): Promise<CalendarSetupSnapshot> {
    assertVersionAndDate(setupVersion, now);
    const verified = validateEvidenceSet(calendars, this.googleSubject);
    const applied = await this.store.discover(
      this.ownerId,
      this.googleSubject,
      setupVersion,
      verified,
      now,
    );
    if (!applied) {
      const authoritative = await this.getSnapshot();
      if (authoritative) return authoritative;
      throw staleVersion();
    }
    return this.requireSnapshot();
  }

  /** Connects one explicitly selected stable candidate after fresh provider verification. */
  async selectExisting(
    setupVersion: number,
    calendar: VerifiedCalendarEvidence,
    now: Date,
  ): Promise<CalendarSetupSnapshot> {
    assertVersionAndDate(setupVersion, now);
    const verified = validateEvidence(calendar, this.googleSubject);
    if (
      !(await this.store.selectExisting(
        this.ownerId,
        this.googleSubject,
        setupVersion,
        verified,
        now,
      ))
    ) {
      throw staleVersion();
    }
    return this.requireSnapshot();
  }

  /** Atomically claims a creation operation or returns the same existing owner-scoped ledger. */
  async beginCreation(
    setupVersion: number,
    idempotencyKey: string,
    preCreateCalendars: readonly VerifiedCalendarEvidence[],
    now: Date,
  ): Promise<BeginCreationResult> {
    assertVersionAndDate(setupVersion, now);
    assertUuid(idempotencyKey);
    const verified = validateEvidenceSet(
      preCreateCalendars,
      this.googleSubject,
    );
    const existing = await this.findCreationOperation(idempotencyKey);
    if (existing) return { kind: "existing", operation: existing };
    const started = await this.store.beginCreation(
      this.ownerId,
      this.googleSubject,
      setupVersion,
      idempotencyKey,
      verified.map(({ id }) => id),
      now,
    );
    if (!started) {
      const winner = await this.findCreationOperation(idempotencyKey);
      if (winner) return { kind: "existing", operation: winner };
      throw staleVersion();
    }
    const operation = await this.findCreationOperation(idempotencyKey);
    if (!operation) throw persistenceFailure();
    return { kind: "started", operation };
  }

  /** Reads one idempotency operation only inside the repository's fixed owner scope. */
  async findCreationOperation(
    idempotencyKey: string,
  ): Promise<CalendarCreationOperation | undefined> {
    assertUuid(idempotencyKey);
    return this.store.findCreationOperation(this.ownerId, idempotencyKey);
  }

  /** Completes a creation once, returning the existing connected state on an exact replay. */
  async completeCreation(
    idempotencyKey: string,
    calendar: VerifiedCalendarEvidence,
    now: Date,
  ): Promise<CalendarSetupSnapshot> {
    assertUuid(idempotencyKey);
    assertDate(now);
    const verified = validateEvidence(calendar, this.googleSubject);
    const existing = await this.findCreationOperation(idempotencyKey);
    if (existing?.status === "completed") return this.requireSnapshot();
    if (
      !(await this.store.completeCreation(
        this.ownerId,
        this.googleSubject,
        idempotencyKey,
        verified,
        now,
      ))
    ) {
      throw persistenceFailure();
    }
    return this.requireSnapshot();
  }

  /** Records an uncertain result without ever advancing to another provider creation call. */
  async markCreationUncertain(
    idempotencyKey: string,
    outcome: "retryable" | "action_required",
    now: Date,
  ): Promise<CalendarSetupSnapshot> {
    assertUuid(idempotencyKey);
    assertDate(now);
    if (
      !(await this.store.markCreationUncertain(
        this.ownerId,
        this.googleSubject,
        idempotencyKey,
        outcome,
        now,
      ))
    ) {
      const operation = await this.findCreationOperation(idempotencyKey);
      if (!operation) throw persistenceFailure();
    }
    return this.requireSnapshot();
  }

  /** Records a known provider rejection as terminal so corrected setup can use a fresh key. */
  async markCreationDefiniteFailure(
    idempotencyKey: string,
    now: Date,
  ): Promise<CalendarSetupSnapshot> {
    assertUuid(idempotencyKey);
    assertDate(now);
    if (
      !(await this.store.markCreationDefiniteFailure(
        this.ownerId,
        this.googleSubject,
        idempotencyKey,
        now,
      ))
    ) {
      const operation = await this.findCreationOperation(idempotencyKey);
      if (operation?.status !== "definite_failure") throw persistenceFailure();
    }
    return this.requireSnapshot();
  }

  /** Returns the current setup state in this fixed owner/account scope. */
  async getSnapshot(): Promise<CalendarSetupSnapshot | undefined> {
    return this.store.readSnapshot(this.ownerId, this.googleSubject);
  }

  /** Requires an existing valid snapshot after a successful persistence mutation. */
  private async requireSnapshot(): Promise<CalendarSetupSnapshot> {
    const snapshot = await this.getSnapshot();
    if (!snapshot) throw persistenceFailure();
    return snapshot;
  }
}

/** Converts validated evidence into a parameter-only candidate record. */
function toCandidateParameter(calendar: VerifiedCalendarEvidence) {
  return {
    id: calendar.id,
    time_zone: calendar.timeZone,
    provider_etag: calendar.providerEtag,
    verified_at: calendar.verifiedAt.toISOString(),
  };
}

/** Validates a bounded unique list and snapshots it before SQL parameterization. */
function validateEvidenceSet(
  calendars: readonly VerifiedCalendarEvidence[],
  googleSubject: string,
): readonly VerifiedCalendarEvidence[] {
  if (!Array.isArray(calendars) || calendars.length > 100) {
    throw invalidEvidence();
  }
  const snapshot = calendars.map((calendar) =>
    validateEvidence(calendar, googleSubject),
  );
  if (new Set(snapshot.map(({ id }) => id)).size !== snapshot.length) {
    throw invalidEvidence();
  }
  return Object.freeze(snapshot);
}

/** Requires exact-name owner evidence bound to the repository's verified Google subject. */
function validateEvidence(
  calendar: VerifiedCalendarEvidence,
  googleSubject: string,
): VerifiedCalendarEvidence {
  if (
    !calendar ||
    calendar.summary !== "Vision" ||
    calendar.accessRole !== "owner" ||
    calendar.ownerGoogleSubject !== googleSubject ||
    !isBoundedText(calendar.id, 1_024) ||
    !isBoundedText(calendar.timeZone, 255) ||
    !isBoundedText(calendar.providerEtag, 1_024) ||
    !isValidDate(calendar.verifiedAt)
  ) {
    throw invalidEvidence();
  }
  return Object.freeze({
    id: calendar.id,
    summary: "Vision",
    accessRole: "owner",
    timeZone: calendar.timeZone,
    providerEtag: calendar.providerEtag,
    ownerGoogleSubject: googleSubject,
    verifiedAt: new Date(calendar.verifiedAt),
  });
}

/** Decodes one joined ledger result and its bounded normalized snapshot IDs. */
function decodeCreationOperation(
  rows: readonly Record<string, unknown>[],
): CalendarCreationOperation | undefined {
  if (rows.length === 0) return undefined;
  if (rows.length > 101) throw persistenceFailure();
  const first = rows[0]!;
  const status = first.status;
  if (
    status !== "in_progress" &&
    status !== "retryable" &&
    status !== "completed" &&
    status !== "action_required" &&
    status !== "definite_failure"
  ) {
    throw persistenceFailure();
  }
  const completedAt =
    first.completedAt === null ? undefined : readDate(first.completedAt);
  const resultCalendarId =
    first.resultCalendarId === null
      ? undefined
      : readText(first.resultCalendarId, 1_024);
  return Object.freeze({
    idempotencyKey: readText(first.idempotencyKey, 36),
    setupVersion: readPositiveInteger(first.setupVersion),
    status,
    requestedAt: readDate(first.requestedAt),
    ...(completedAt ? { completedAt } : {}),
    ...(resultCalendarId ? { resultCalendarId } : {}),
    preCreateCalendarIds: Object.freeze(
      rows
        .map(({ snapshotCalendarId }) =>
          snapshotCalendarId === null
            ? undefined
            : readText(snapshotCalendarId, 1_024),
        )
        .filter((value): value is string => value !== undefined),
    ),
  });
}

/** Decodes exact database aliases into the client-safe setup snapshot contract. */
function decodeSetupSnapshot(
  state: Record<string, unknown>,
  candidateRows: readonly Record<string, unknown>[],
  connectionRow?: Record<string, unknown>,
): CalendarSetupSnapshot {
  const status = state.status;
  if (
    status !== "authenticated" &&
    status !== "discovering" &&
    status !== "awaiting_choice" &&
    status !== "awaiting_confirmation" &&
    status !== "creating" &&
    status !== "connected" &&
    status !== "failed"
  ) {
    throw persistenceFailure();
  }
  const candidates = candidateRows.map((row) =>
    validateEvidence(
      {
        id: readText(row.id, 1_024),
        summary: row.summary as "Vision",
        accessRole: row.accessRole as "owner",
        timeZone: readText(row.timeZone, 255),
        providerEtag: readText(row.providerEtag, 1_024),
        ownerGoogleSubject: readText(row.ownerGoogleSubject, 255),
        verifiedAt: readDate(row.verifiedAt),
      },
      readText(state.googleSubject, 255),
    ),
  );
  const connection = connectionRow
    ? decodeConnection(connectionRow)
    : undefined;
  return Object.freeze({
    setupVersion: readPositiveInteger(state.setupVersion),
    status,
    actionRequired: readBoolean(state.actionRequired),
    candidates: Object.freeze(candidates),
    ...(connection ? { connection } : {}),
  });
}

/** Decodes one stable connected-calendar row without accepting extra ownership inputs. */
function decodeConnection(row: Record<string, unknown>): CalendarConnection {
  const connectionKind = row.connectionKind;
  if (connectionKind !== "existing" && connectionKind !== "created") {
    throw persistenceFailure();
  }
  return Object.freeze({
    calendarId: readText(row.calendarId, 1_024),
    connectionKind,
    timeZone: readText(row.timeZone, 255),
    providerEtag: readText(row.providerEtag, 1_024),
    verifiedAt: readDate(row.verifiedAt),
  });
}

/** Requires a canonical UUID idempotency key. */
function assertUuid(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw persistenceFailure();
  }
}

/** Requires a positive setup version and valid current timestamp. */
function assertVersionAndDate(version: number, now: Date): void {
  if (!Number.isSafeInteger(version) || version <= 0) throw staleVersion();
  assertDate(now);
}

/** Requires a genuine finite Date and prevents invalid timestamps reaching SQL. */
function assertDate(value: unknown): asserts value is Date {
  if (!isValidDate(value)) throw persistenceFailure();
}

/** Returns whether a value is a finite intrinsic Date instance. */
function isValidDate(value: unknown): value is Date {
  return (
    value instanceof Date &&
    !Number.isNaN(Date.prototype.getTime.call(value))
  );
}

/** Accepts one non-whitespace scalar under a persistence boundary length limit. */
function isBoundedText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum
  );
}

/** Strictly reads one positive integer database value without broad coercion. */
function readPositiveInteger(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^[1-9]\d*$/u.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw persistenceFailure();
  return parsed;
}

/** Strictly reads one bounded nonempty text database value. */
function readText(value: unknown, maximum: number): string {
  if (!isBoundedText(value, maximum)) throw persistenceFailure();
  return value;
}

/** Strictly reads one database boolean without truthy coercion. */
function readBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw persistenceFailure();
  return value;
}

/** Copies one timezone-aware database timestamp. */
function readDate(value: unknown): Date {
  const date =
    value instanceof Date
      ? new Date(Date.prototype.getTime.call(value))
      : typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
        ? new Date(value)
        : undefined;
  if (!date || !isValidDate(date)) throw persistenceFailure();
  return date;
}

/** Creates the constant exact-version compare-and-swap failure. */
function staleVersion(): CalendarRepositoryError {
  return new CalendarRepositoryError("STALE_SETUP_VERSION");
}

/** Creates the constant account-bound evidence validation failure. */
function invalidEvidence(): CalendarRepositoryError {
  return new CalendarRepositoryError("INVALID_CALENDAR_EVIDENCE");
}

/** Creates the constant persistence failure without database detail. */
function persistenceFailure(): CalendarRepositoryError {
  return new CalendarRepositoryError("CALENDAR_PERSISTENCE_FAILED");
}

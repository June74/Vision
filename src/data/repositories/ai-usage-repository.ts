/** Persists content-free AI reservations and settlements with PostgreSQL-enforced concurrency. */
import { sql } from "drizzle-orm";
import {
  AI_HARD_STOP_CENTS,
  AI_OPTIONAL_STOP_CENTS,
  AI_WARNING_CENTS,
  getChicagoBudgetMonth,
  type AiRequestClass,
} from "../../domain/budget/ai-budget";
import type { VisionDatabase } from "../db";

/** Describes the safe facts needed to atomically reserve one possible provider call. */
export interface AiUsageReservationInput {
  readonly reservationId: string;
  readonly ownerId: string;
  readonly idempotencyKey: string;
  readonly requestClass: AiRequestClass;
  readonly estimatedCents: number;
  readonly now: Date;
  readonly expiresAt: Date;
}

/** Describes the only provider metadata permitted in the AI usage ledger. */
export interface AiUsageSettlementMetadata {
  readonly providerRequestId?: string;
  readonly modelId?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

/** Describes one idempotent actual or conservative cost settlement. */
export interface AiUsageSettlementInput {
  readonly reservationId: string;
  readonly ownerId: string;
  readonly actualCents: number;
  readonly metadata: AiUsageSettlementMetadata;
  readonly now: Date;
}

/** Reports whether an atomic reservation was admitted, repeated, or denied. */
export type AiUsageReserveResult =
  | {
      readonly status: "reserved";
      readonly reservationId: string;
      readonly budgetMonth: string;
      readonly projectedCents: number;
    }
  | {
      readonly status: "duplicate";
      readonly reservationId: string;
    }
  | {
      readonly status: "denied";
      readonly reason: "budget" | "concurrency";
      readonly projectedCents: number;
    };

/** Defines the transaction-safe accounting boundary used by BudgetedAiProvider. */
export interface AiUsageRepository {
  reserve(input: AiUsageReservationInput): Promise<AiUsageReserveResult>;
  /** Requires an unexpired reservation and replaces its expiry in the same dispatch transition. */
  markDispatched(
    reservationId: string,
    ownerId: string,
    now: Date,
    expiresAt: Date,
  ): Promise<"dispatched" | "duplicate">;
  settle(input: AiUsageSettlementInput): Promise<"settled" | "duplicate">;
  release(
    reservationId: string,
    ownerId: string,
    now: Date,
  ): Promise<"released" | "duplicate">;
}

/** Implements AI accounting with one PostgreSQL statement per state transition. */
class DrizzleAiUsageRepository implements AiUsageRepository {
  constructor(private readonly database: VisionDatabase) {}

  /** Reserves worst-case cents after expiring stale work under one owner advisory lock. */
  async reserve(input: AiUsageReservationInput): Promise<AiUsageReserveResult> {
    assertIdentifier(input.reservationId, "reservation");
    assertIdentifier(input.ownerId, "owner");
    assertIdentifier(input.idempotencyKey, "idempotency");
    assertRequestClass(input.requestClass);
    assertPositiveCents(input.estimatedCents);
    assertDate(input.now);
    assertDate(input.expiresAt);
    if (
      Date.prototype.getTime.call(input.expiresAt) <=
      Date.prototype.getTime.call(input.now)
    ) {
      throw new Error("Invalid AI reservation expiry.");
    }
    const budgetMonth = getChicagoBudgetMonth(input.now);

    await this.database.execute(sql`
      insert into ai_usage_months (
        owner_id, budget_month, settled_cents, reserved_cents, created_at, updated_at
      ) values (
        ${input.ownerId}, ${budgetMonth}, 0, 0, ${input.now}, ${input.now}
      )
      on conflict (owner_id, budget_month) do nothing
    `);

    const result = await this.database.execute<Record<string, unknown>>(sql`
      with owner_lock as materialized (
        select pg_advisory_xact_lock(hashtext(${input.ownerId})) as locked
      ),
      stale as (
        update ai_usage_reservations as reservation
        set
          status = case
            when reservation.dispatched_at is null then 'released'
            else 'settled_estimate'
          end,
          actual_cents = case
            when reservation.dispatched_at is null then null
            else reservation.estimated_cents
          end,
          completed_at = ${input.now}
        from owner_lock
        where reservation.owner_id = ${input.ownerId}
          and reservation.status in ('reserved', 'dispatched')
          and reservation.expires_at <= ${input.now}
        returning
          reservation.id as "reservationId",
          reservation.budget_month as "budgetMonth",
          reservation.estimated_cents as "estimatedCents",
          reservation.dispatched_at as "dispatchedAt"
      ),
      stale_ledger as (
        insert into ai_usage_ledger (
          id, reservation_id, owner_id, budget_month, event_type,
          estimated_cents, actual_cents, occurred_at
        )
        select
          stale."reservationId" || case
            when stale."dispatchedAt" is null then ':released'
            else ':settled_estimate'
          end,
          stale."reservationId",
          ${input.ownerId},
          stale."budgetMonth",
          case
            when stale."dispatchedAt" is null then 'released'
            else 'settled_estimate'
          end,
          stale."estimatedCents",
          case
            when stale."dispatchedAt" is null then null
            else stale."estimatedCents"
          end,
          ${input.now}
        from stale
        on conflict (id) do nothing
        returning id
      ),
      stale_totals as (
        select
          "budgetMonth",
          sum("estimatedCents")::integer as "releasedCents",
          sum(
            case when "dispatchedAt" is null then 0 else "estimatedCents" end
          )::integer as "chargedCents"
        from stale
        group by "budgetMonth"
      ),
      current_month as materialized (
        select month.settled_cents, month.reserved_cents
        from ai_usage_months as month, owner_lock
        where month.owner_id = ${input.ownerId}
          and month.budget_month = ${budgetMonth}
        for update
      ),
      existing as materialized (
        select reservation.id
        from ai_usage_reservations as reservation, owner_lock
        where reservation.owner_id = ${input.ownerId}
          and reservation.budget_month = ${budgetMonth}
          and reservation.idempotency_key = ${input.idempotencyKey}
        limit 1
      ),
      admission as materialized (
        select
          current_month.settled_cents
            + current_month.reserved_cents
            - coalesce((
                select stale_totals."releasedCents"
                from stale_totals
                where stale_totals."budgetMonth" = ${budgetMonth}
              ), 0)
            + coalesce((
                select stale_totals."chargedCents"
                from stale_totals
                where stale_totals."budgetMonth" = ${budgetMonth}
              ), 0)
            + ${input.estimatedCents} as projected_cents,
          not exists (
            select 1
            from ai_usage_reservations as active
            where active.owner_id = ${input.ownerId}
              and active.status in ('reserved', 'dispatched')
              and active.expires_at > ${input.now}
          ) as concurrency_available
        from current_month
      ),
      inserted as (
        insert into ai_usage_reservations (
          id, owner_id, budget_month, idempotency_key, request_class, status,
          estimated_cents, created_at, expires_at
        )
        select
          ${input.reservationId}, ${input.ownerId}, ${budgetMonth},
          ${input.idempotencyKey}, ${input.requestClass}, 'reserved',
          ${input.estimatedCents}, ${input.now}, ${input.expiresAt}
        from admission
        where not exists (select 1 from existing)
          and admission.concurrency_available
          and admission.projected_cents < ${AI_HARD_STOP_CENTS}
          and (
            ${input.requestClass} <> 'optional'
            or admission.projected_cents < ${AI_OPTIONAL_STOP_CENTS}
          )
          and (
            ${input.requestClass} <> 'complex'
            or admission.projected_cents < ${AI_WARNING_CENTS}
          )
        on conflict do nothing
        returning id
      ),
      reserved_ledger as (
        insert into ai_usage_ledger (
          id, reservation_id, owner_id, budget_month, event_type,
          estimated_cents, occurred_at
        )
        select
          inserted.id || ':reserved',
          inserted.id,
          ${input.ownerId},
          ${budgetMonth},
          'reserved',
          ${input.estimatedCents},
          ${input.now}
        from inserted
        returning id
      ),
      month_adjustments as (
        select
          stale_totals."budgetMonth",
          stale_totals."chargedCents" as "settledDelta",
          -stale_totals."releasedCents" as "reservedDelta"
        from stale_totals
        union all
        select
          ${budgetMonth},
          0,
          ${input.estimatedCents}
        where exists (select 1 from inserted)
      ),
      combined_adjustments as (
        select
          "budgetMonth",
          sum("settledDelta")::integer as "settledDelta",
          sum("reservedDelta")::integer as "reservedDelta"
        from month_adjustments
        group by "budgetMonth"
      ),
      update_months as (
        update ai_usage_months as month
        set
          settled_cents = month.settled_cents + adjustment."settledDelta",
          reserved_cents = month.reserved_cents + adjustment."reservedDelta",
          updated_at = ${input.now}
        from combined_adjustments as adjustment
        where month.owner_id = ${input.ownerId}
          and month.budget_month = adjustment."budgetMonth"
        returning month.budget_month
      )
      select
        case
          when exists (select 1 from inserted) then 'reserved'
          when exists (select 1 from existing) then 'duplicate'
          when not admission.concurrency_available then 'concurrency'
          else 'budget'
        end as outcome,
        coalesce(
          (select id from inserted),
          (select id from existing),
          ${input.reservationId}
        ) as "reservationId",
        coalesce(
          (select projected_cents from admission),
          ${AI_HARD_STOP_CENTS}
        ) as "projectedCents"
      from admission
    `);
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error("AI usage reservation failed.");
    }
    const outcome = readText(row.outcome);
    const reservationId = readText(row.reservationId);
    const projectedCents = readNonNegativeCents(row.projectedCents);
    if (outcome === "reserved") {
      return { status: "reserved", reservationId, budgetMonth, projectedCents };
    }
    if (outcome === "duplicate") {
      return { status: "duplicate", reservationId };
    }
    if (outcome === "budget" || outcome === "concurrency") {
      return { status: "denied", reason: outcome, projectedCents };
    }
    throw new Error("Invalid AI usage reservation result.");
  }

  /** Dispatches only an unexpired reservation and atomically refreshes its provider-call lease. */
  async markDispatched(
    reservationId: string,
    ownerId: string,
    now: Date,
    expiresAt: Date,
  ): Promise<"dispatched" | "duplicate"> {
    assertIdentifier(reservationId, "reservation");
    assertIdentifier(ownerId, "owner");
    assertDate(now);
    assertDate(expiresAt);
    if (
      Date.prototype.getTime.call(expiresAt) <=
      Date.prototype.getTime.call(now)
    ) {
      throw new Error("Invalid AI dispatch expiry.");
    }
    const result = await this.database.execute<Record<string, unknown>>(sql`
      with dispatched as (
        update ai_usage_reservations
        set
          status = 'dispatched',
          dispatched_at = ${now},
          expires_at = ${expiresAt}
        where id = ${reservationId}
          and owner_id = ${ownerId}
          and status = 'reserved'
          and expires_at > ${now}
        returning id, budget_month as "budgetMonth",
          estimated_cents as "estimatedCents"
      ),
      ledger as (
        insert into ai_usage_ledger (
          id, reservation_id, owner_id, budget_month, event_type,
          estimated_cents, occurred_at
        )
        select
          dispatched.id || ':dispatched',
          dispatched.id,
          ${ownerId},
          dispatched."budgetMonth",
          'dispatched',
          dispatched."estimatedCents",
          ${now}
        from dispatched
        returning id
      )
      select exists (select 1 from ledger) as applied
    `);
    if (readBoolean(result.rows[0]?.applied)) return "dispatched";
    const existing = await this.readStatus(reservationId, ownerId);
    if (existing === "dispatched") return "duplicate";
    throw new Error("AI reservation cannot be dispatched.");
  }

  /** Settles actual safe provider usage exactly once and removes reserved cents atomically. */
  async settle(input: AiUsageSettlementInput): Promise<"settled" | "duplicate"> {
    assertIdentifier(input.reservationId, "reservation");
    assertIdentifier(input.ownerId, "owner");
    assertNonNegativeCents(input.actualCents);
    assertSettlementMetadata(input.metadata);
    assertDate(input.now);
    const result = await this.database.execute<Record<string, unknown>>(sql`
      with candidate as materialized (
        select
          id,
          budget_month as "budgetMonth",
          estimated_cents as "estimatedCents",
          status as "priorStatus"
        from ai_usage_reservations
        where id = ${input.reservationId}
          and owner_id = ${input.ownerId}
          and status in ('dispatched', 'settled_estimate')
        for update
      ),
      settled as (
        update ai_usage_reservations as reservation
        set
          status = 'settled',
          actual_cents = ${input.actualCents},
          provider_request_id = ${input.metadata.providerRequestId ?? null},
          model_id = ${input.metadata.modelId ?? null},
          input_tokens = ${input.metadata.inputTokens ?? null},
          output_tokens = ${input.metadata.outputTokens ?? null},
          total_tokens = ${input.metadata.totalTokens ?? null},
          completed_at = ${input.now}
        from candidate
        where reservation.id = candidate.id
        returning
          reservation.id,
          candidate."budgetMonth",
          candidate."estimatedCents",
          candidate."priorStatus"
      ),
      month_settlement as (
        update ai_usage_months as month
        set
          settled_cents = month.settled_cents + ${input.actualCents}
            - case
                when settled."priorStatus" = 'settled_estimate'
                  then settled."estimatedCents"
                else 0
              end,
          reserved_cents = month.reserved_cents
            - case
                when settled."priorStatus" = 'dispatched'
                  then settled."estimatedCents"
                else 0
              end,
          updated_at = ${input.now}
        from settled
        where month.owner_id = ${input.ownerId}
          and month.budget_month = settled."budgetMonth"
        returning month.budget_month
      ),
      ledger as (
        insert into ai_usage_ledger (
          id, reservation_id, owner_id, budget_month, event_type,
          estimated_cents, actual_cents, provider_request_id, model_id,
          input_tokens, output_tokens, total_tokens, occurred_at
        )
        select
          settled.id || ':settled',
          settled.id,
          ${input.ownerId},
          settled."budgetMonth",
          'settled',
          settled."estimatedCents",
          ${input.actualCents},
          ${input.metadata.providerRequestId ?? null},
          ${input.metadata.modelId ?? null},
          ${input.metadata.inputTokens ?? null},
          ${input.metadata.outputTokens ?? null},
          ${input.metadata.totalTokens ?? null},
          ${input.now}
        from settled
        where exists (select 1 from month_settlement)
        returning id
      )
      select exists (select 1 from ledger) as applied
    `);
    if (readBoolean(result.rows[0]?.applied)) return "settled";
    const existing = await this.readSettlement(
      input.reservationId,
      input.ownerId,
    );
    if (
      existing?.status === "settled" &&
      existing.actualCents === input.actualCents &&
      existing.providerRequestId === (input.metadata.providerRequestId ?? null) &&
      existing.modelId === (input.metadata.modelId ?? null) &&
      existing.inputTokens === (input.metadata.inputTokens ?? null) &&
      existing.outputTokens === (input.metadata.outputTokens ?? null) &&
      existing.totalTokens === (input.metadata.totalTokens ?? null)
    ) {
      return "duplicate";
    }
    if (existing?.status === "settled") {
      throw new Error("Conflicting AI settlement.");
    }
    throw new Error("AI reservation cannot be settled.");
  }

  /** Releases only work that is still provably pre-dispatch. */
  async release(
    reservationId: string,
    ownerId: string,
    now: Date,
  ): Promise<"released" | "duplicate"> {
    assertIdentifier(reservationId, "reservation");
    assertIdentifier(ownerId, "owner");
    assertDate(now);
    const result = await this.database.execute<Record<string, unknown>>(sql`
      with released as (
        update ai_usage_reservations
        set status = 'released', completed_at = ${now}
        where id = ${reservationId}
          and owner_id = ${ownerId}
          and status = 'reserved'
          and dispatched_at is null
        returning id, budget_month as "budgetMonth",
          estimated_cents as "estimatedCents"
      ),
      month_release as (
        update ai_usage_months as month
        set
          reserved_cents = month.reserved_cents - released."estimatedCents",
          updated_at = ${now}
        from released
        where month.owner_id = ${ownerId}
          and month.budget_month = released."budgetMonth"
        returning month.budget_month
      ),
      ledger as (
        insert into ai_usage_ledger (
          id, reservation_id, owner_id, budget_month, event_type,
          estimated_cents, occurred_at
        )
        select
          released.id || ':released',
          released.id,
          ${ownerId},
          released."budgetMonth",
          'released',
          released."estimatedCents",
          ${now}
        from released
        where exists (select 1 from month_release)
        returning id
      )
      select exists (select 1 from ledger) as applied
    `);
    if (readBoolean(result.rows[0]?.applied)) return "released";
    const existing = await this.readStatus(reservationId, ownerId);
    if (
      existing === "released" ||
      existing === "settled" ||
      existing === "settled_estimate"
    ) {
      return "duplicate";
    }
    throw new Error("Dispatched AI reservations cannot be released.");
  }

  /** Reads only one content-free reservation status for idempotent transitions. */
  private async readStatus(
    reservationId: string,
    ownerId: string,
  ): Promise<string | undefined> {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select status
      from ai_usage_reservations
      where id = ${reservationId}
        and owner_id = ${ownerId}
      limit 1
    `);
    return result.rows[0] === undefined
      ? undefined
      : readText(result.rows[0].status);
  }

  /** Reads the exact content-free settled tuple to distinguish retries from conflicts. */
  private async readSettlement(
    reservationId: string,
    ownerId: string,
  ): Promise<
    | {
        readonly status: string;
        readonly actualCents: number | null;
        readonly providerRequestId: string | null;
        readonly modelId: string | null;
        readonly inputTokens: number | null;
        readonly outputTokens: number | null;
        readonly totalTokens: number | null;
      }
    | undefined
  > {
    const result = await this.database.execute<Record<string, unknown>>(sql`
      select
        status,
        actual_cents as "actualCents",
        provider_request_id as "providerRequestId",
        model_id as "modelId",
        input_tokens as "inputTokens",
        output_tokens as "outputTokens",
        total_tokens as "totalTokens"
      from ai_usage_reservations
      where id = ${reservationId}
        and owner_id = ${ownerId}
      limit 1
    `);
    const row = result.rows[0];
    if (row === undefined) return undefined;
    return {
      status: readText(row.status),
      actualCents: readNullableInteger(row.actualCents),
      providerRequestId: readNullableText(row.providerRequestId),
      modelId: readNullableText(row.modelId),
      inputTokens: readNullableInteger(row.inputTokens),
      outputTokens: readNullableInteger(row.outputTokens),
      totalTokens: readNullableInteger(row.totalTokens),
    };
  }
}

/** Creates the production AI usage repository over Vision's typed database. */
export function createAiUsageRepository(
  database: VisionDatabase,
): AiUsageRepository {
  return new DrizzleAiUsageRepository(database);
}

/** Validates one bounded opaque identifier without retaining content. */
function assertIdentifier(value: string, kind: string): void {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u.test(value)
  ) {
    throw new Error(`Invalid AI ${kind} identifier.`);
  }
}

/** Validates the closed request-class enum at the repository boundary. */
function assertRequestClass(value: AiRequestClass): void {
  if (!["routine", "optional", "complex"].includes(value)) {
    throw new Error("Invalid AI request class.");
  }
}

/** Validates a positive cent amount. */
function assertPositiveCents(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Invalid AI cent amount.");
  }
}

/** Validates a non-negative cent amount. */
function assertNonNegativeCents(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Invalid AI cent amount.");
  }
}

/** Validates a trusted timestamp without process-local timezone assumptions. */
function assertDate(value: Date): void {
  if (
    !(value instanceof Date) ||
    Number.isNaN(Date.prototype.getTime.call(value))
  ) {
    throw new Error("Invalid AI accounting timestamp.");
  }
}

/** Validates bounded safe settlement metadata and excludes prompts or response content by shape. */
function assertSettlementMetadata(metadata: AiUsageSettlementMetadata): void {
  const record = metadata as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (key) =>
        ![
          "providerRequestId",
          "modelId",
          "inputTokens",
          "outputTokens",
          "totalTokens",
        ].includes(key),
    )
  ) {
    throw new Error("Invalid AI settlement metadata.");
  }
  for (const value of [metadata.providerRequestId, metadata.modelId]) {
    if (
      value !== undefined &&
      (typeof value !== "string" || value.length < 1 || value.length > 128)
    ) {
      throw new Error("Invalid AI settlement metadata.");
    }
  }
  for (const value of [
    metadata.inputTokens,
    metadata.outputTokens,
    metadata.totalTokens,
  ]) {
    if (
      value !== undefined &&
      (!Number.isSafeInteger(value) || value < 0 || value > 100_000_000)
    ) {
      throw new Error("Invalid AI settlement metadata.");
    }
  }
}

/** Decodes one non-empty database text field. */
function readText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Invalid AI usage row.");
  }
  return value;
}

/** Decodes one PostgreSQL integer into a safe non-negative cent amount. */
function readNonNegativeCents(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^(?:0|[1-9]\d*)$/u.test(value)
        ? Number(value)
        : Number.NaN;
  assertNonNegativeCents(parsed);
  return parsed;
}

/** Decodes one PostgreSQL boolean result. */
function readBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new Error("Invalid AI usage row.");
  }
  return value;
}

/** Decodes a nullable bounded database text field. */
function readNullableText(value: unknown): string | null {
  if (value === null) return null;
  return readText(value);
}

/** Decodes a nullable safe non-negative PostgreSQL integer. */
function readNullableInteger(value: unknown): number | null {
  if (value === null) return null;
  return readNonNegativeCents(value);
}

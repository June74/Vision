/** Reads one owner/month AI accounting snapshot without exposing ledger identities. */
import { sql, type SQL } from "drizzle-orm";
import { getChicagoBudgetMonth } from "../domain/budget/ai-budget";
import type { VisionDatabase } from "./db";

/** Closed source failure vocabulary for temporary AI-usage evidence. */
export type PhaseBAiUsageSourceFailureCategory =
  | "unavailable"
  | "inconsistent";

/** Prevents database/provider detail crossing into the evidence job. */
export class PhaseBAiUsageSourceError extends Error {
  constructor(readonly category: PhaseBAiUsageSourceFailureCategory) {
    super("Phase B AI usage source failed.");
    this.name = "PhaseBAiUsageSourceError";
  }
}

/** Aggregate-only result admitted by the evidence job. */
export interface PhaseBAiUsageMeasurements {
  readonly monthlyCents: number;
}

/** Canonical interval used to count the one temporary AI candidate. */
export interface PhaseBAiUsageEligibilityWindow {
  readonly activatedAt: Date;
  readonly evidenceScheduledAt: Date;
}

/** Aggregate-only request counts for the temporary AI candidate. */
export interface PhaseBAiCandidateRequestCounts {
  readonly createdRequestCount: number;
  readonly eligibleSettledRequestCount: number;
}

/** Owner-bound aggregate read used by the evidence job. */
export interface PhaseBAiUsageSource {
  read(budgetMonth: string): Promise<PhaseBAiUsageMeasurements>;
  countActiveRequests(): Promise<number>;
  readCandidateRequestCounts(
    window: PhaseBAiUsageEligibilityWindow,
  ): Promise<PhaseBAiCandidateRequestCounts>;
}

/** Deterministic non-AI reads required before successful stop-tier evidence. */
export interface PhaseBNonAiReadSource {
  readStatus(): Promise<void>;
  readCalendar(): Promise<void>;
}

/** Builds reusable exact current-row/append-only-ledger validation CTEs. */
function phaseBAiLifecycleValidationCtes(
  ownerId: string,
  scopePredicate: SQL,
) {
  return sql`
    target_reservations as materialized (
      select
        reservation.id,
        reservation.budget_month,
        reservation.status,
        reservation.estimated_cents,
        reservation.actual_cents,
        reservation.created_at,
        reservation.dispatched_at as reservation_dispatched_at,
        reservation.completed_at as reservation_completed_at
      from ai_usage_reservations reservation
      where reservation.owner_id = ${ownerId}
      ${scopePredicate}
    ),
    reservation_histories as (
      select
        reservation.id,
        reservation.budget_month,
        reservation.status,
        reservation.estimated_cents,
        reservation.actual_cents,
        reservation.created_at,
        reservation.reservation_dispatched_at,
        reservation.reservation_completed_at,
        count(ledger.id) as event_count,
        count(*) filter (
          where ledger.event_type = 'reserved'
        ) as reserved_count,
        count(*) filter (
          where ledger.event_type = 'dispatched'
        ) as dispatched_count,
        count(*) filter (
          where ledger.event_type = 'released'
        ) as released_count,
        count(*) filter (
          where ledger.event_type = 'settled_estimate'
        ) as settled_estimate_count,
        count(*) filter (
          where ledger.event_type = 'settled'
        ) as settled_count,
        min(ledger.occurred_at) filter (
          where ledger.event_type = 'reserved'
        ) as ledger_reserved_at,
        min(ledger.occurred_at) filter (
          where ledger.event_type = 'dispatched'
        ) as ledger_dispatched_at,
        min(ledger.occurred_at) filter (
          where ledger.event_type = 'released'
        ) as ledger_released_at,
        min(ledger.occurred_at) filter (
          where ledger.event_type = 'settled_estimate'
        ) as ledger_settled_estimate_at,
        min(ledger.occurred_at) filter (
          where ledger.event_type = 'settled'
        ) as ledger_settled_at,
        count(*) filter (
          where ledger.id is not null
            and (
              ledger.owner_id is distinct from ${ownerId}
              or ledger.budget_month is distinct from
                reservation.budget_month
            )
        ) as owner_month_mismatch_count,
        count(*) filter (
          where ledger.id is not null
            and (
              ledger.estimated_cents is distinct from
                reservation.estimated_cents
              or (
                ledger.event_type in ('reserved', 'dispatched', 'released')
                and ledger.actual_cents is not null
              )
              or (
                ledger.event_type = 'settled_estimate'
                and ledger.actual_cents is distinct from
                  reservation.estimated_cents
              )
              or (
                ledger.event_type = 'settled'
                and ledger.actual_cents is null
              )
            )
        ) as invalid_value_count,
        max(ledger.actual_cents) filter (
          where ledger.event_type = 'settled_estimate'
        ) as settled_estimate_actual_cents,
        max(ledger.actual_cents) filter (
          where ledger.event_type = 'settled'
        ) as settled_actual_cents
      from target_reservations reservation
      left join ai_usage_ledger ledger
        on ledger.reservation_id = reservation.id
      group by
        reservation.id,
        reservation.budget_month,
        reservation.status,
        reservation.estimated_cents,
        reservation.actual_cents,
        reservation.created_at,
        reservation.reservation_dispatched_at,
        reservation.reservation_completed_at
    ),
    validated_reservations as (
      select
        history.*,
        case
          when history.invalid_value_count <> 0 then 1
          when history.ledger_reserved_at is distinct from history.created_at
            then 1
          when history.status = 'reserved'
            and history.event_count = 1
            and history.reserved_count = 1
            and history.dispatched_count = 0
            and history.released_count = 0
            and history.settled_estimate_count = 0
            and history.settled_count = 0
            and history.reservation_dispatched_at is null
            and history.reservation_completed_at is null
            and history.actual_cents is null
            then 0
          when history.status = 'dispatched'
            and history.event_count = 2
            and history.reserved_count = 1
            and history.dispatched_count = 1
            and history.released_count = 0
            and history.settled_estimate_count = 0
            and history.settled_count = 0
            and history.reservation_dispatched_at is not null
            and history.reservation_completed_at is null
            and history.actual_cents is null
            and history.ledger_reserved_at <= history.ledger_dispatched_at
            and history.ledger_dispatched_at =
              history.reservation_dispatched_at
            then 0
          when history.status = 'released'
            and history.event_count = 2
            and history.reserved_count = 1
            and history.dispatched_count = 0
            and history.released_count = 1
            and history.settled_estimate_count = 0
            and history.settled_count = 0
            and history.reservation_dispatched_at is null
            and history.reservation_completed_at is not null
            and history.actual_cents is null
            and history.ledger_reserved_at <= history.ledger_released_at
            and history.ledger_released_at =
              history.reservation_completed_at
            then 0
          when history.status = 'settled_estimate'
            and history.event_count = 3
            and history.reserved_count = 1
            and history.dispatched_count = 1
            and history.released_count = 0
            and history.settled_estimate_count = 1
            and history.settled_count = 0
            and history.reservation_dispatched_at is not null
            and history.reservation_completed_at is not null
            and history.actual_cents = history.estimated_cents
            and history.settled_estimate_actual_cents =
              history.estimated_cents
            and history.ledger_reserved_at <= history.ledger_dispatched_at
            and history.ledger_dispatched_at <=
              history.ledger_settled_estimate_at
            and history.ledger_dispatched_at =
              history.reservation_dispatched_at
            and history.ledger_settled_estimate_at =
              history.reservation_completed_at
            then 0
          when history.status = 'settled'
            and history.event_count = 3
            and history.reserved_count = 1
            and history.dispatched_count = 1
            and history.released_count = 0
            and history.settled_estimate_count = 0
            and history.settled_count = 1
            and history.reservation_dispatched_at is not null
            and history.reservation_completed_at is not null
            and history.actual_cents is not null
            and history.settled_actual_cents = history.actual_cents
            and history.ledger_reserved_at <= history.ledger_dispatched_at
            and history.ledger_dispatched_at <= history.ledger_settled_at
            and history.ledger_dispatched_at =
              history.reservation_dispatched_at
            and history.ledger_settled_at =
              history.reservation_completed_at
            then 0
          when history.status = 'settled'
            and history.event_count = 4
            and history.reserved_count = 1
            and history.dispatched_count = 1
            and history.released_count = 0
            and history.settled_estimate_count = 1
            and history.settled_count = 1
            and history.reservation_dispatched_at is not null
            and history.reservation_completed_at is not null
            and history.actual_cents is not null
            and history.settled_estimate_actual_cents =
              history.estimated_cents
            and history.settled_actual_cents = history.actual_cents
            and history.ledger_reserved_at <= history.ledger_dispatched_at
            and history.ledger_dispatched_at <=
              history.ledger_settled_estimate_at
            and history.ledger_settled_estimate_at <=
              history.ledger_settled_at
            and history.ledger_dispatched_at =
              history.reservation_dispatched_at
            and history.ledger_settled_at =
              history.reservation_completed_at
            then 0
          else 1
        end as invalid_transition_count
      from reservation_histories history
    )
  `;
}

/** Counts every active owner reservation after one exact lifecycle snapshot. */
function phaseBAiActiveRequestCountQuery(ownerId: string) {
  const lifecycle = phaseBAiLifecycleValidationCtes(ownerId, sql``);
  return sql`
    /* phase_b_ai_active_request_count */
    with ${lifecycle},
    reservation_totals as (
      select
        count(*) filter (
          where reservation.status in ('reserved', 'dispatched')
        ) as active_request_count,
        coalesce(sum(reservation.owner_month_mismatch_count), 0)
          as owner_month_mismatch_count,
        coalesce(sum(reservation.invalid_transition_count), 0)
          as invalid_transition_count
      from validated_reservations reservation
    ),
    foreign_scoped_ledger as (
      select count(*) as owner_month_mismatch_count
      from ai_usage_ledger ledger
      left join ai_usage_reservations reservation
        on reservation.id = ledger.reservation_id
      where ledger.owner_id = ${ownerId}
        and (
          reservation.id is null
          or reservation.owner_id is distinct from ${ownerId}
          or reservation.budget_month is distinct from ledger.budget_month
        )
    )
    select
      reservation_totals.active_request_count as "activeRequestCount",
      reservation_totals.owner_month_mismatch_count
        + foreign_scoped_ledger.owner_month_mismatch_count
        as "ownerMonthMismatchCount",
      reservation_totals.invalid_transition_count
        as "invalidTransitionCount"
    from reservation_totals
    cross join foreign_scoped_ledger
  `;
}

/** Reads both candidate counts from one exact lifecycle snapshot. */
function phaseBAiCandidateRequestCountsQuery(
  ownerId: string,
  candidateMonth: string,
  activatedAt: Date,
  evidenceScheduledAt: Date,
) {
  const lifecycle = phaseBAiLifecycleValidationCtes(
    ownerId,
    sql`
      and reservation.created_at >= ${activatedAt}
      and reservation.created_at < ${evidenceScheduledAt}
    `,
  );
  return sql`
    /* phase_b_ai_candidate_request_counts */
    with ${lifecycle},
    reservation_totals as (
      select
        count(*) as created_request_count,
        count(*) filter (
          where reservation.status = 'settled'
            and reservation.reservation_completed_at <
              ${evidenceScheduledAt}
        ) as eligible_settled_request_count,
        coalesce(sum(reservation.owner_month_mismatch_count), 0)
          as owner_month_mismatch_count,
        count(*) filter (
          where reservation.budget_month is distinct from ${candidateMonth}
        ) as candidate_month_mismatch_count,
        coalesce(sum(reservation.invalid_transition_count), 0)
          as invalid_transition_count
      from validated_reservations reservation
    ),
    foreign_scoped_ledger as (
      select count(*) as owner_month_mismatch_count
      from ai_usage_ledger ledger
      left join ai_usage_reservations reservation
        on reservation.id = ledger.reservation_id
      where ledger.owner_id = ${ownerId}
        and ledger.occurred_at >= ${activatedAt}
        and ledger.occurred_at < ${evidenceScheduledAt}
        and (
          reservation.id is null
          or reservation.owner_id is distinct from ${ownerId}
          or reservation.budget_month is distinct from ledger.budget_month
        )
    )
    select
      reservation_totals.created_request_count as "createdRequestCount",
      reservation_totals.eligible_settled_request_count
        as "eligibleSettledRequestCount",
      reservation_totals.owner_month_mismatch_count
        + foreign_scoped_ledger.owner_month_mismatch_count
        as "ownerMonthMismatchCount",
      reservation_totals.candidate_month_mismatch_count
        as "candidateMonthMismatchCount",
      reservation_totals.invalid_transition_count
        as "invalidTransitionCount"
    from reservation_totals
    cross join foreign_scoped_ledger
  `;
}

/** Builds one guaranteed-row aggregate with canonical per-reservation accounting. */
function phaseBAiUsageQuery(ownerId: string, budgetMonth: string) {
  return sql`
    /* phase_b_ai_usage_aggregates */
    with target_month as (
      select
        count(*) as month_row_count,
        coalesce(max(month.settled_cents), 0) as settled_cents,
        coalesce(max(month.reserved_cents), 0) as reserved_cents
      from ai_usage_months month
      where month.owner_id = ${ownerId}
        and month.budget_month = ${budgetMonth}
    ),
    target_reservations as materialized (
      select
        reservation.id,
        reservation.status,
        reservation.estimated_cents,
        reservation.actual_cents,
        reservation.created_at,
        reservation.dispatched_at as reservation_dispatched_at,
        reservation.completed_at as reservation_completed_at
      from ai_usage_reservations reservation
      where reservation.owner_id = ${ownerId}
        and reservation.budget_month = ${budgetMonth}
    ),
    reservation_histories as (
      select
        reservation.id,
        reservation.status,
        reservation.estimated_cents,
        reservation.actual_cents,
        reservation.created_at,
        reservation.reservation_dispatched_at,
        reservation.reservation_completed_at,
        count(ledger.id) as event_count,
        count(*) filter (
          where ledger.event_type = 'reserved'
        ) as reserved_count,
        count(*) filter (
          where ledger.event_type = 'dispatched'
        ) as dispatched_count,
        count(*) filter (
          where ledger.event_type = 'released'
        ) as released_count,
        count(*) filter (
          where ledger.event_type = 'settled_estimate'
        ) as settled_estimate_count,
        count(*) filter (
          where ledger.event_type = 'settled'
        ) as settled_count,
        min(ledger.occurred_at) filter (
          where ledger.event_type = 'reserved'
        ) as ledger_reserved_at,
        min(ledger.occurred_at) filter (
          where ledger.event_type = 'dispatched'
        ) as ledger_dispatched_at,
        min(ledger.occurred_at) filter (
          where ledger.event_type = 'released'
        ) as ledger_released_at,
        min(ledger.occurred_at) filter (
          where ledger.event_type = 'settled_estimate'
        ) as ledger_settled_estimate_at,
        min(ledger.occurred_at) filter (
          where ledger.event_type = 'settled'
        ) as ledger_settled_at,
        count(*) filter (
          where ledger.id is not null
            and (
              ledger.owner_id is distinct from ${ownerId}
              or ledger.budget_month is distinct from ${budgetMonth}
            )
        ) as owner_month_mismatch_count,
        count(*) filter (
          where ledger.id is not null
            and (
              ledger.estimated_cents is distinct from
                reservation.estimated_cents
              or (
                ledger.event_type in ('reserved', 'dispatched', 'released')
                and ledger.actual_cents is not null
              )
              or (
                ledger.event_type = 'settled_estimate'
                and ledger.actual_cents is distinct from
                  reservation.estimated_cents
              )
              or (
                ledger.event_type = 'settled'
                and ledger.actual_cents is null
              )
            )
        ) as invalid_value_count,
        max(ledger.actual_cents) filter (
          where ledger.event_type = 'settled_estimate'
        ) as settled_estimate_actual_cents,
        max(ledger.actual_cents) filter (
          where ledger.event_type = 'settled'
        ) as settled_actual_cents
      from target_reservations reservation
      left join ai_usage_ledger ledger
        on ledger.reservation_id = reservation.id
      group by
        reservation.id,
        reservation.status,
        reservation.estimated_cents,
        reservation.actual_cents,
        reservation.created_at,
        reservation.reservation_dispatched_at,
        reservation.reservation_completed_at
    ),
    validated_reservations as (
      select
        history.*,
        case
          when history.invalid_value_count <> 0 then 1
          when history.ledger_reserved_at is distinct from history.created_at
            then 1
          when history.status = 'reserved'
            and history.event_count = 1
            and history.reserved_count = 1
            and history.dispatched_count = 0
            and history.released_count = 0
            and history.settled_estimate_count = 0
            and history.settled_count = 0
            and history.reservation_dispatched_at is null
            and history.reservation_completed_at is null
            and history.actual_cents is null
            then 0
          when history.status = 'dispatched'
            and history.event_count = 2
            and history.reserved_count = 1
            and history.dispatched_count = 1
            and history.released_count = 0
            and history.settled_estimate_count = 0
            and history.settled_count = 0
            and history.reservation_dispatched_at is not null
            and history.reservation_completed_at is null
            and history.actual_cents is null
            and history.ledger_reserved_at <= history.ledger_dispatched_at
            and history.ledger_dispatched_at =
              history.reservation_dispatched_at
            then 0
          when history.status = 'released'
            and history.event_count = 2
            and history.reserved_count = 1
            and history.dispatched_count = 0
            and history.released_count = 1
            and history.settled_estimate_count = 0
            and history.settled_count = 0
            and history.reservation_dispatched_at is null
            and history.reservation_completed_at is not null
            and history.actual_cents is null
            and history.ledger_reserved_at <= history.ledger_released_at
            and history.ledger_released_at =
              history.reservation_completed_at
            then 0
          when history.status = 'settled_estimate'
            and history.event_count = 3
            and history.reserved_count = 1
            and history.dispatched_count = 1
            and history.released_count = 0
            and history.settled_estimate_count = 1
            and history.settled_count = 0
            and history.reservation_dispatched_at is not null
            and history.reservation_completed_at is not null
            and history.actual_cents = history.estimated_cents
            and history.settled_estimate_actual_cents =
              history.estimated_cents
            and history.ledger_reserved_at <= history.ledger_dispatched_at
            and history.ledger_dispatched_at <=
              history.ledger_settled_estimate_at
            and history.ledger_dispatched_at =
              history.reservation_dispatched_at
            and history.ledger_settled_estimate_at =
              history.reservation_completed_at
            then 0
          when history.status = 'settled'
            and history.event_count = 3
            and history.reserved_count = 1
            and history.dispatched_count = 1
            and history.released_count = 0
            and history.settled_estimate_count = 0
            and history.settled_count = 1
            and history.reservation_dispatched_at is not null
            and history.reservation_completed_at is not null
            and history.actual_cents is not null
            and history.settled_actual_cents = history.actual_cents
            and history.ledger_reserved_at <= history.ledger_dispatched_at
            and history.ledger_dispatched_at <= history.ledger_settled_at
            and history.ledger_dispatched_at =
              history.reservation_dispatched_at
            and history.ledger_settled_at =
              history.reservation_completed_at
            then 0
          when history.status = 'settled'
            and history.event_count = 4
            and history.reserved_count = 1
            and history.dispatched_count = 1
            and history.released_count = 0
            and history.settled_estimate_count = 1
            and history.settled_count = 1
            and history.reservation_dispatched_at is not null
            and history.reservation_completed_at is not null
            and history.actual_cents is not null
            and history.settled_estimate_actual_cents =
              history.estimated_cents
            and history.settled_actual_cents = history.actual_cents
            and history.ledger_reserved_at <= history.ledger_dispatched_at
            and history.ledger_dispatched_at <=
              history.ledger_settled_estimate_at
            and history.ledger_settled_estimate_at <=
              history.ledger_settled_at
            and history.ledger_dispatched_at =
              history.reservation_dispatched_at
            and history.ledger_settled_at =
              history.reservation_completed_at
            then 0
          else 1
        end as invalid_transition_count
      from reservation_histories history
    ),
    reservation_totals as (
      select
        count(*) as reservation_count,
        coalesce(sum(
          case
            when reservation.status in ('settled', 'settled_estimate')
              then reservation.actual_cents
            else 0
          end
        ), 0) as ledger_settled_cents,
        coalesce(sum(
          case
            when reservation.status in ('reserved', 'dispatched')
              then reservation.estimated_cents
            else 0
          end
        ), 0) as ledger_reserved_cents,
        coalesce(sum(reservation.event_count), 0) as ledger_activity_count,
        coalesce(sum(reservation.owner_month_mismatch_count), 0)
          as owner_month_mismatch_count,
        coalesce(sum(reservation.invalid_transition_count), 0)
          as invalid_transition_count
      from validated_reservations reservation
    ),
    foreign_scoped_ledger as (
      select
        count(*) as ledger_activity_count,
        count(*) filter (
          where reservation.id is null
            or reservation.owner_id is distinct from ${ownerId}
            or reservation.budget_month is distinct from ${budgetMonth}
        ) as owner_month_mismatch_count
      from ai_usage_ledger ledger
      left join ai_usage_reservations reservation
        on reservation.id = ledger.reservation_id
      where ledger.owner_id = ${ownerId}
        and ledger.budget_month = ${budgetMonth}
        and (
          reservation.id is null
          or reservation.owner_id is distinct from ${ownerId}
          or reservation.budget_month is distinct from ${budgetMonth}
        )
    )
    select
      target_month.month_row_count as "monthRowCount",
      target_month.settled_cents as "settledCents",
      target_month.reserved_cents as "reservedCents",
      reservation_totals.ledger_settled_cents as "ledgerSettledCents",
      reservation_totals.ledger_reserved_cents as "ledgerReservedCents",
      reservation_totals.reservation_count as "reservationCount",
      reservation_totals.ledger_activity_count
        + foreign_scoped_ledger.ledger_activity_count
        as "ledgerActivityCount",
      reservation_totals.owner_month_mismatch_count
        + foreign_scoped_ledger.owner_month_mismatch_count
        as "ownerMonthMismatchCount",
      reservation_totals.invalid_transition_count
        as "invalidTransitionCount"
    from target_month
    cross join reservation_totals
    cross join foreign_scoped_ledger
  `;
}

/** Creates the parameterized, aggregate-only owner/month reader. */
export function createPhaseBAiUsageSource(
  database: VisionDatabase,
  ownerId: string,
): PhaseBAiUsageSource {
  if (typeof ownerId !== "string" || ownerId.length === 0) {
    throw new Error("Phase B AI usage source is unavailable.");
  }
  return Object.freeze({
    /** Reads one exact aggregate owner/month snapshot. */
    async read(
      budgetMonth: string,
    ): Promise<PhaseBAiUsageMeasurements> {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(budgetMonth)) {
        throw new PhaseBAiUsageSourceError("unavailable");
      }
      try {
        const result = await database.execute<Record<string, unknown>>(
          phaseBAiUsageQuery(ownerId, budgetMonth),
        );
        const row = result.rows[0];
        if (!row || result.rows.length !== 1) {
          throw new PhaseBAiUsageSourceError("unavailable");
        }
        const monthRows = decodeAggregateCell(row.monthRowCount);
        const settled = decodeAggregateCell(row.settledCents);
        const reserved = decodeAggregateCell(row.reservedCents);
        const ledgerSettled = decodeAggregateCell(row.ledgerSettledCents);
        const ledgerReserved = decodeAggregateCell(row.ledgerReservedCents);
        const reservations = decodeAggregateCell(row.reservationCount);
        const ledgerActivity = decodeAggregateCell(row.ledgerActivityCount);
        const mismatches = decodeAggregateCell(row.ownerMonthMismatchCount);
        const transitions = decodeAggregateCell(row.invalidTransitionCount);

        if (
          monthRows > 1 ||
          mismatches !== 0 ||
          transitions !== 0 ||
          (monthRows === 0 &&
            (reservations !== 0 || ledgerActivity !== 0)) ||
          settled !== ledgerSettled ||
          reserved !== ledgerReserved ||
          settled > Number.MAX_SAFE_INTEGER - reserved
        ) {
          throw new PhaseBAiUsageSourceError("inconsistent");
        }
        return Object.freeze({ monthlyCents: settled + reserved });
      } catch (error) {
        if (error instanceof PhaseBAiUsageSourceError) throw error;
        throw new PhaseBAiUsageSourceError("unavailable");
      }
    },
    /** Counts all active owner reservations in one validated SQL snapshot. */
    async countActiveRequests(): Promise<number> {
      try {
        const result = await database.execute<Record<string, unknown>>(
          phaseBAiActiveRequestCountQuery(ownerId),
        );
        const row = result.rows[0];
        if (!row || result.rows.length !== 1) {
          throw new PhaseBAiUsageSourceError("unavailable");
        }
        const active = decodeAggregateCell(row.activeRequestCount);
        const mismatches = decodeAggregateCell(row.ownerMonthMismatchCount);
        const transitions = decodeAggregateCell(row.invalidTransitionCount);
        if (mismatches !== 0 || transitions !== 0) {
          throw new PhaseBAiUsageSourceError("inconsistent");
        }
        return active;
      } catch (error) {
        if (error instanceof PhaseBAiUsageSourceError) throw error;
        throw new PhaseBAiUsageSourceError("unavailable");
      }
    },
    /** Reads created and exactly settled candidate counts in one SQL snapshot. */
    async readCandidateRequestCounts(
      window: PhaseBAiUsageEligibilityWindow,
    ): Promise<PhaseBAiCandidateRequestCounts> {
      let activatedAt: Date;
      let evidenceScheduledAt: Date;
      let candidateMonth: string;
      try {
        const activatedMilliseconds = Date.prototype.getTime.call(
          window.activatedAt,
        );
        const evidenceMilliseconds = Date.prototype.getTime.call(
          window.evidenceScheduledAt,
        );
        if (
          !Number.isFinite(activatedMilliseconds) ||
          !Number.isFinite(evidenceMilliseconds) ||
          activatedMilliseconds >= evidenceMilliseconds
        ) {
          throw new Error("Invalid candidate window.");
        }
        activatedAt = new Date(activatedMilliseconds);
        evidenceScheduledAt = new Date(evidenceMilliseconds);
        candidateMonth = getChicagoBudgetMonth(activatedAt);
        if (getChicagoBudgetMonth(evidenceScheduledAt) !== candidateMonth) {
          throw new Error("Candidate window crosses accounting month.");
        }
      } catch {
        throw new PhaseBAiUsageSourceError("unavailable");
      }
      try {
        const result = await database.execute<Record<string, unknown>>(
          phaseBAiCandidateRequestCountsQuery(
            ownerId,
            candidateMonth,
            activatedAt,
            evidenceScheduledAt,
          ),
        );
        const row = result.rows[0];
        if (!row || result.rows.length !== 1) {
          throw new PhaseBAiUsageSourceError("unavailable");
        }
        const created = decodeAggregateCell(row.createdRequestCount);
        const eligible = decodeAggregateCell(row.eligibleSettledRequestCount);
        const mismatches = decodeAggregateCell(row.ownerMonthMismatchCount);
        const candidateMonthMismatches = decodeAggregateCell(
          row.candidateMonthMismatchCount,
        );
        const transitions = decodeAggregateCell(row.invalidTransitionCount);
        if (
          mismatches !== 0 ||
          candidateMonthMismatches !== 0 ||
          transitions !== 0 ||
          eligible > created
        ) {
          throw new PhaseBAiUsageSourceError("inconsistent");
        }
        return Object.freeze({
          createdRequestCount: created,
          eligibleSettledRequestCount: eligible,
        });
      } catch (error) {
        if (error instanceof PhaseBAiUsageSourceError) throw error;
        throw new PhaseBAiUsageSourceError("unavailable");
      }
    },
  });
}

/** Creates owner-scoped status and calendar read checks without returning content. */
export function createPhaseBNonAiReadSource(
  database: VisionDatabase,
  ownerId: string,
): PhaseBNonAiReadSource {
  if (typeof ownerId !== "string" || ownerId.length === 0) {
    throw new Error("Phase B non-AI read source is unavailable.");
  }
  return Object.freeze({
    /** Exercises the same content-free owner status tables used by diagnostics. */
    async readStatus(): Promise<void> {
      await readAvailabilityAggregate(
        database,
        sql`
          /* phase_b_non_ai_status_read */
          select
            (
              select count(*)
              from sync_checkpoints checkpoint
              where checkpoint.owner_id = ${ownerId}
                and checkpoint.provider = 'google-calendar'
            ) + (
              select count(*)
              from calendar_sync_jobs job
              where job.owner_id = ${ownerId}
                and job.provider = 'google-calendar'
            ) as "rowCount"
        `,
      );
    },
    /** Exercises the owner-scoped calendar projection without selecting content. */
    async readCalendar(): Promise<void> {
      await readAvailabilityAggregate(
        database,
        sql`
          /* phase_b_non_ai_calendar_read */
          select count(*) as "rowCount"
          from nodes node
          inner join events event
            on event.node_id = node.id
            and event.owner_id = node.owner_id
          where node.owner_id = ${ownerId}
            and node.node_type = 'event'
            and node.lifecycle = 'active'
        `,
      );
    },
  });
}

/** Executes and decodes one guaranteed-row count while discarding its value. */
async function readAvailabilityAggregate(
  database: VisionDatabase,
  statement: SQL,
): Promise<void> {
  try {
    const result = await database.execute<Record<string, unknown>>(statement);
    if (result.rows.length !== 1 || result.rows[0] === undefined) {
      throw new PhaseBAiUsageSourceError("unavailable");
    }
    decodeAggregateCell(result.rows[0].rowCount);
  } catch (error) {
    if (error instanceof PhaseBAiUsageSourceError) throw error;
    throw new PhaseBAiUsageSourceError("unavailable");
  }
}

/** Admits one nonnegative safe integer database aggregate cell. */
function decodeAggregateCell(value: unknown): number {
  const decoded =
    typeof value === "string" && /^(?:0|[1-9]\d*)$/u.test(value)
      ? Number(value)
      : value;
  if (!Number.isSafeInteger(decoded) || (decoded as number) < 0) {
    throw new PhaseBAiUsageSourceError("inconsistent");
  }
  return decoded as number;
}

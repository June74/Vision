/** Reads one owner/month AI accounting snapshot without exposing ledger identities. */
import { sql } from "drizzle-orm";
import type { VisionDatabase } from "./db";

/** Closed source failure vocabulary for temporary AI-usage evidence. */
export type PhaseBAiUsageSourceFailureCategory = "unavailable" | "inconsistent";

/** Prevents database/provider detail crossing into the evidence job. */
export class PhaseBAiUsageSourceError extends Error {
  constructor(readonly category: PhaseBAiUsageSourceFailureCategory) {
    super("Phase B AI usage source failed.");
    this.name = "PhaseBAiUsageSourceError";
  }
}

/** Aggregate-only result admitted by the evidence job. */
export interface PhaseBAiUsageMeasurements { readonly monthlyCents: number; }
export interface PhaseBAiUsageSource { read(budgetMonth: string): Promise<PhaseBAiUsageMeasurements>; }

/** Builds the parameterized aggregate-only SQL statement. */
function query(ownerId: string, budgetMonth: string) { return sql`
/* phase_b_ai_usage_aggregates */
with month as (
  select settled_cents, reserved_cents from ai_usage_months
  where owner_id = ${ownerId} and budget_month = ${budgetMonth}
), ledger as (
  select
    coalesce(sum(case when event_type in ('settled','settled_estimate') then actual_cents else 0 end), 0) as ledger_settled_cents,
    coalesce(sum(case when event_type = 'reserved' then estimated_cents when event_type in ('released','settled','settled_estimate') then -estimated_cents else 0 end), 0) as ledger_reserved_cents,
    count(*) filter (where reservation.owner_id is distinct from ledger.owner_id or reservation.budget_month is distinct from ledger.budget_month) as owner_month_mismatch_count,
    count(*) filter (where ledger.event_type not in ('reserved','dispatched','settled','settled_estimate','released')) as invalid_transition_count
  from ai_usage_ledger ledger left join ai_usage_reservations reservation on reservation.id = ledger.reservation_id
  where ledger.owner_id = ${ownerId} and ledger.budget_month = ${budgetMonth}
)
select count(month.*) as "monthRowCount", coalesce(max(month.settled_cents),0) as "settledCents", coalesce(max(month.reserved_cents),0) as "reservedCents", ledger.ledger_settled_cents as "ledgerSettledCents", ledger.ledger_reserved_cents as "ledgerReservedCents", ledger.owner_month_mismatch_count as "ownerMonthMismatchCount", ledger.invalid_transition_count as "invalidTransitionCount" from month cross join ledger group by ledger.ledger_settled_cents, ledger.ledger_reserved_cents, ledger.owner_month_mismatch_count, ledger.invalid_transition_count
`; }

/** Creates the parameterized, aggregate-only owner/month reader. */
export function createPhaseBAiUsageSource(database: VisionDatabase, ownerId: string): PhaseBAiUsageSource {
  if (typeof ownerId !== "string" || ownerId.length === 0) throw new Error("Phase B AI usage source is unavailable.");
  return Object.freeze({
    /** Reads one exact aggregate owner/month snapshot. */
    async read(budgetMonth: string): Promise<PhaseBAiUsageMeasurements> {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(budgetMonth)) throw new PhaseBAiUsageSourceError("unavailable");
      try {
        const result = await database.execute<Record<string, unknown>>(query(ownerId, budgetMonth));
        const row = result.rows[0];
        if (!row || result.rows.length !== 1) throw new PhaseBAiUsageSourceError("unavailable");
        const values = ["monthRowCount","settledCents","reservedCents","ledgerSettledCents","ledgerReservedCents","ownerMonthMismatchCount","invalidTransitionCount"].map((key) => decode(row[key]));
        const [monthRows, settled, reserved, ledgerSettled, ledgerReserved, mismatches, transitions] = values;
        if (monthRows! > 1 || mismatches !== 0 || transitions !== 0 || (monthRows === 0 && (settled !== 0 || reserved !== 0)) || settled !== ledgerSettled || reserved !== ledgerReserved || settled! > Number.MAX_SAFE_INTEGER - reserved!) throw new PhaseBAiUsageSourceError("inconsistent");
        return Object.freeze({ monthlyCents: settled! + reserved! });
      } catch (error) {
        if (error instanceof PhaseBAiUsageSourceError) throw error;
        throw new PhaseBAiUsageSourceError("unavailable");
      }
    },
  });
}

/** Admits one nonnegative safe integer database cell. */
function decode(value: unknown): number {
  const decoded = typeof value === "string" && /^(?:0|[1-9]\d*)$/u.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(decoded) || (decoded as number) < 0) throw new PhaseBAiUsageSourceError("inconsistent");
  return decoded as number;
}

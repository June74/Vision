/** Defines append-only AI usage reservations and authoritative monthly totals. */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Stores settled and actively reserved cents for one private owner accounting month. */
export const aiUsageMonths = pgTable(
  "ai_usage_months",
  {
    ownerId: text("owner_id").notNull(),
    budgetMonth: text("budget_month").notNull(),
    settledCents: integer("settled_cents").notNull().default(0),
    reservedCents: integer("reserved_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.budgetMonth] }),
    check("ai_usage_months_owner_non_empty", sql`${table.ownerId} <> ''`),
    check("ai_usage_months_key_valid", sql`${table.budgetMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("ai_usage_months_settled_non_negative", sql`${table.settledCents} >= 0`),
    check("ai_usage_months_reserved_non_negative", sql`${table.reservedCents} >= 0`),
    check("ai_usage_months_timestamps_valid", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
);

/** Stores content-free reservation, dispatch, and settlement facts without prompts or responses. */
export const aiUsageReservations = pgTable(
  "ai_usage_reservations",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    budgetMonth: text("budget_month").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestClass: text("request_class").notNull(),
    status: text("status").notNull(),
    estimatedCents: integer("estimated_cents").notNull(),
    actualCents: integer("actual_cents"),
    providerRequestId: text("provider_request_id"),
    modelId: text("model_id"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("ai_usage_reservations_owner_idempotency_uq").on(
      table.ownerId,
      table.budgetMonth,
      table.idempotencyKey,
    ),
    check("ai_usage_reservations_owner_non_empty", sql`${table.ownerId} <> ''`),
    check("ai_usage_reservations_idempotency_non_empty", sql`${table.idempotencyKey} <> ''`),
    check("ai_usage_reservations_month_valid", sql`${table.budgetMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("ai_usage_reservations_class_valid", sql`${table.requestClass} in ('routine', 'optional', 'complex')`),
    check("ai_usage_reservations_status_valid", sql`${table.status} in ('reserved', 'dispatched', 'settled', 'settled_estimate', 'released')`),
    check("ai_usage_reservations_estimate_positive", sql`${table.estimatedCents} > 0`),
    check("ai_usage_reservations_actual_non_negative", sql`${table.actualCents} is null or ${table.actualCents} >= 0`),
    check("ai_usage_reservations_token_counts_non_negative", sql`(${table.inputTokens} is null or ${table.inputTokens} >= 0) and (${table.outputTokens} is null or ${table.outputTokens} >= 0) and (${table.totalTokens} is null or ${table.totalTokens} >= 0)`),
    check("ai_usage_reservations_expiry_after_created", sql`${table.expiresAt} > ${table.createdAt}`),
    check("ai_usage_reservations_dispatch_consistent", sql`(${table.status} in ('dispatched', 'settled', 'settled_estimate')) = (${table.dispatchedAt} is not null)`),
    check("ai_usage_reservations_completion_consistent", sql`(${table.status} in ('settled', 'settled_estimate', 'released')) = (${table.completedAt} is not null)`),
    check("ai_usage_reservations_actual_consistent", sql`(${table.status} in ('settled', 'settled_estimate')) = (${table.actualCents} is not null)`),
    check("ai_usage_reservations_timestamps_valid", sql`(${table.dispatchedAt} is null or ${table.dispatchedAt} >= ${table.createdAt}) and (${table.completedAt} is null or ${table.completedAt} >= ${table.createdAt})`),
    uniqueIndex("ai_usage_reservations_one_in_flight_uq")
      .on(table.ownerId)
      .where(sql`${table.status} in ('reserved', 'dispatched')`),
    index("ai_usage_reservations_expiry_idx").on(table.status, table.expiresAt),
  ],
);

/** Appends one immutable, content-free accounting event for every reservation transition. */
export const aiUsageLedger = pgTable(
  "ai_usage_ledger",
  {
    id: text("id").primaryKey(),
    reservationId: text("reservation_id").notNull(),
    ownerId: text("owner_id").notNull(),
    budgetMonth: text("budget_month").notNull(),
    eventType: text("event_type").notNull(),
    estimatedCents: integer("estimated_cents").notNull(),
    actualCents: integer("actual_cents"),
    providerRequestId: text("provider_request_id"),
    modelId: text("model_id"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.reservationId],
      foreignColumns: [aiUsageReservations.id],
      name: "ai_usage_ledger_reservation_fk",
    }),
    check("ai_usage_ledger_owner_non_empty", sql`${table.ownerId} <> ''`),
    check("ai_usage_ledger_month_valid", sql`${table.budgetMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("ai_usage_ledger_event_valid", sql`${table.eventType} in ('reserved', 'dispatched', 'settled', 'settled_estimate', 'released')`),
    check("ai_usage_ledger_estimate_positive", sql`${table.estimatedCents} > 0`),
    check("ai_usage_ledger_actual_non_negative", sql`${table.actualCents} is null or ${table.actualCents} >= 0`),
    check("ai_usage_ledger_token_counts_non_negative", sql`(${table.inputTokens} is null or ${table.inputTokens} >= 0) and (${table.outputTokens} is null or ${table.outputTokens} >= 0) and (${table.totalTokens} is null or ${table.totalTokens} >= 0)`),
    index("ai_usage_ledger_owner_month_occurred_idx").on(
      table.ownerId,
      table.budgetMonth,
      table.occurredAt,
    ),
  ],
);

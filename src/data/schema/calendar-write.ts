/** Defines encrypted Phase C approvals and owner-scoped event-write execution state. */
import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { ciphertext } from "./nodes";

/** Stores one server-owned immutable proposal until it is confirmed or invalidated. */
export const calendarWriteApprovals = pgTable(
  "calendar_write_approvals",
  {
    operationId: text("operation_id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    provider: text("provider").notNull(),
    calendarId: text("calendar_id").notNull(),
    action: text("action").notNull().default("create"),
    providerEventId: text("provider_event_id"),
    providerEventVersion: text("provider_event_version"),
    mutationScope: text("mutation_scope").notNull().default("single"),
    proposalDomain: text("proposal_domain").notNull(),
    status: text("status").notNull(),
    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    proposalEnvelope: ciphertext("proposal_envelope").notNull(),
  },
  (table) => [
    unique("calendar_write_approvals_owner_operation_unique").on(
      table.ownerId,
      table.operationId,
    ),
    check(
      "calendar_write_approvals_owner_non_empty",
      sql`${table.ownerId} <> ''`,
    ),
    check(
      "calendar_write_approvals_provider_google",
      sql`${table.provider} = 'google'`,
    ),
    check(
      "calendar_write_approvals_calendar_non_empty",
      sql`${table.calendarId} <> ''`,
    ),
    check(
      "calendar_write_approvals_action_valid",
      sql`${table.action} in ('create', 'update', 'move', 'cancel', 'delete')`,
    ),
    check(
      "calendar_write_approvals_event_identity_paired",
      sql`(${table.providerEventId} is null) = (${table.providerEventVersion} is null)`,
    ),
    check(
      "calendar_write_approvals_action_identity",
      sql`(${table.action} = 'create' and ${table.providerEventId} is null and ${table.providerEventVersion} is null) or (${table.action} <> 'create' and ${table.providerEventId} is not null and ${table.providerEventVersion} is not null)`,
    ),
    check(
      "calendar_write_approvals_scope_valid",
      sql`${table.mutationScope} in ('single', 'series')`,
    ),
    check(
      "calendar_write_approvals_domain_valid",
      sql`${table.proposalDomain} in ('school', 'work', 'personal')`,
    ),
    check(
      "calendar_write_approvals_status_valid",
      sql`${table.status} in ('proposed', 'confirmed', 'invalidated')`,
    ),
    check(
      "calendar_write_approvals_expiry_after_request",
      sql`${table.expiresAt} > ${table.requestedAt}`,
    ),
  ],
);

/** Stores provider identity/version only after the executor claims or verifies a write. */
export const calendarWriteOperations = pgTable(
  "calendar_write_operations",
  {
    operationId: text("operation_id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    provider: text("provider").notNull(),
    calendarId: text("calendar_id").notNull(),
    status: text("status").notNull(),
    providerEventId: text("provider_event_id"),
    providerEventVersion: text("provider_event_version"),
    requestedAt: timestamp("requested_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    unique("calendar_write_operations_owner_provider_operation_unique").on(
      table.ownerId,
      table.provider,
      table.operationId,
    ),
    check(
      "calendar_write_operations_owner_non_empty",
      sql`${table.ownerId} <> ''`,
    ),
    check(
      "calendar_write_operations_provider_google",
      sql`${table.provider} = 'google'`,
    ),
    check(
      "calendar_write_operations_calendar_non_empty",
      sql`${table.calendarId} <> ''`,
    ),
    check(
      "calendar_write_operations_status_valid",
      sql`${table.status} in ('writing', 'verification_pending', 'verified', 'failed', 'undone')`,
    ),
    check(
      "calendar_write_operations_event_identity_paired",
      sql`(${table.providerEventId} is null) = (${table.providerEventVersion} is null)`,
    ),
    check(
      "calendar_write_operations_terminal_event_identity",
      sql`${table.status} not in ('verified', 'undone') or (${table.providerEventId} is not null and ${table.providerEventVersion} is not null)`,
    ),
  ],
);

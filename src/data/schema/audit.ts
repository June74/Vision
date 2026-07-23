/** Defines privacy-safe audit and idempotent operation-ledger tables. */
import { sql } from "drizzle-orm";
import { check, foreignKey, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { ciphertext, nodes } from "./nodes";

/** Stores allowlisted, non-sensitive audit facts tied to opaque identities. */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    nodeId: text("node_id"),
    actorType: text("actor_type").notNull(),
    action: text("action").notNull(),
    outcome: text("outcome").notNull(),
    provider: text("provider"),
    errorCategory: text("error_category"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    foreignKey({ columns: [table.nodeId, table.ownerId], foreignColumns: [nodes.id, nodes.ownerId], name: "audit_events_node_owner_fk" }),
    check("audit_events_owner_non_empty", sql`${table.ownerId} <> ''`),
  ],
);

/** Stores idempotency state and any retained provider response only as a ciphertext envelope. */
export const operationLedger = pgTable(
  "operation_ledger",
  {
    operationId: text("operation_id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    provider: text("provider").notNull(),
    providerOperationId: text("provider_operation_id").notNull(),
    operationKind: text("operation_kind").notNull(),
    status: text("status").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    responseEnvelope: ciphertext("response_envelope"),
  },
  (table) => [
    unique("operation_ledger_provider_operation_unique").on(table.ownerId, table.provider, table.providerOperationId),
    check("operation_ledger_provider_non_empty", sql`${table.provider} <> ''`),
    check("operation_ledger_operation_non_empty", sql`${table.providerOperationId} <> ''`),
  ],
);

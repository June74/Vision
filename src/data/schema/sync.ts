/** Defines explicit synchronization state without storing provider tokens in JSON. */
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";
import { events } from "./events";
import { ciphertext, nodes } from "./nodes";

/** Stores the last safely committed provider sync token as encrypted binary data. */
export const syncCheckpoints = pgTable(
  "sync_checkpoints",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    provider: text("provider").notNull(),
    providerCalendarId: text("provider_calendar_id").notNull(),
    syncTokenEnvelope: ciphertext("sync_token_envelope"),
    keyVersion: integer("key_version"),
    committedAt: timestamp("committed_at", { withTimezone: true, mode: "date" }).notNull(),
    version: integer("version").notNull().default(0),
    status: text("status").notNull().default("pending"),
    lastErrorCategory: text("last_error_category"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique("sync_checkpoints_provider_calendar_unique").on(table.ownerId, table.provider, table.providerCalendarId),
    check("sync_checkpoints_provider_non_empty", sql`${table.provider} <> ''`),
    check("sync_checkpoints_calendar_non_empty", sql`${table.providerCalendarId} <> ''`),
    check("sync_checkpoints_key_version_positive", sql`${table.keyVersion} is null or ${table.keyVersion} > 0`),
    check("sync_checkpoints_version_non_negative", sql`${table.version} >= 0`),
    check("sync_checkpoints_status_valid", sql`${table.status} in ('pending', 'connected', 'disconnected', 'action_required', 'rebuild_required', 'retry_scheduled')`),
    check("sync_checkpoints_error_category_valid", sql`${table.lastErrorCategory} is null or ${table.lastErrorCategory} in ('authorization', 'concurrency', 'database', 'provider', 'payload_too_large', 'quota', 'schema', 'sync_token_invalid', 'transient')`),
    check("sync_checkpoints_token_version_consistent", sql`(${table.version} = 0 and ${table.syncTokenEnvelope} is null and ${table.keyVersion} is null) or (${table.version} > 0 and ${table.syncTokenEnvelope} is not null and ${table.keyVersion} is not null and ${table.keyVersion} > 0)`),
  ],
);

/** Stores the complete mapped protected provider payload as one authenticated ciphertext envelope. */
export const eventSyncPayloads = pgTable(
  "event_sync_payloads",
  {
    nodeId: text("node_id").notNull(),
    ownerId: text("owner_id").notNull(),
    protectedPayloadEnvelope: ciphertext("protected_payload_envelope").notNull(),
    protectedKeyVersion: integer("protected_key_version").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.nodeId] }),
    foreignKey({
      columns: [table.nodeId, table.ownerId],
      foreignColumns: [events.nodeId, events.ownerId],
      name: "event_sync_payloads_event_owner_fk",
    }).onDelete("cascade"),
    check("event_sync_payloads_key_version_positive", sql`${table.protectedKeyVersion} > 0`),
  ],
);

/** Stores content-free synchronization outcomes for diagnostics and budget-safe operations review. */
export const syncRuns = pgTable(
  "sync_runs",
  {
    jobId: text("job_id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    provider: text("provider").notNull(),
    providerCalendarId: text("provider_calendar_id").notNull(),
    reason: text("reason").notNull(),
    pageCount: integer("page_count").notNull(),
    stagedCount: integer("staged_count").notNull(),
    upsertedCount: integer("upserted_count").notNull(),
    deletedCount: integer("deleted_count").notNull(),
    unchangedCount: integer("unchanged_count").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }).notNull(),
    checkpointVersion: integer("checkpoint_version").notNull(),
  },
  (table) => [
    check("sync_runs_owner_non_empty", sql`${table.ownerId} <> ''`),
    check("sync_runs_provider_non_empty", sql`${table.provider} <> ''`),
    check("sync_runs_calendar_non_empty", sql`${table.providerCalendarId} <> ''`),
    check("sync_runs_reason_valid", sql`${table.reason} in ('initial', 'manual', 'push', 'rebuild', 'repair')`),
    check("sync_runs_page_count_positive", sql`${table.pageCount} > 0`),
    check("sync_runs_staged_count_non_negative", sql`${table.stagedCount} >= 0`),
    check("sync_runs_upserted_count_non_negative", sql`${table.upsertedCount} >= 0`),
    check("sync_runs_deleted_count_non_negative", sql`${table.deletedCount} >= 0`),
    check("sync_runs_unchanged_count_non_negative", sql`${table.unchangedCount} >= 0`),
    check("sync_runs_completed_after_started", sql`${table.completedAt} >= ${table.startedAt}`),
    check("sync_runs_checkpoint_version_positive", sql`${table.checkpointVersion} > 0`),
    index("sync_runs_owner_calendar_completed_idx").on(
      table.ownerId,
      table.provider,
      table.providerCalendarId,
      table.completedAt.desc(),
    ),
  ],
);

/** Stores provider notification channel state and protects the callback verification token. */
export const syncChannels = pgTable(
  "sync_channels",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    provider: text("provider").notNull(),
    providerCalendarId: text("provider_calendar_id").notNull(),
    providerChannelId: text("provider_channel_id").notNull(),
    providerResourceId: text("provider_resource_id").notNull(),
    verificationTokenEnvelope: ciphertext("verification_token_envelope").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("sync_channels_provider_channel_unique").on(table.ownerId, table.provider, table.providerChannelId),
    check("sync_channels_provider_non_empty", sql`${table.provider} <> ''`),
    check("sync_channels_calendar_non_empty", sql`${table.providerCalendarId} <> ''`),
    check("sync_channels_channel_non_empty", sql`${table.providerChannelId} <> ''`),
    check("sync_channels_resource_non_empty", sql`${table.providerResourceId} <> ''`),
  ],
);

/** Tracks the encrypted recovery window after a node enters the deleted lifecycle. */
export const recoverableDeletions = pgTable(
  "recoverable_deletions",
  {
    nodeId: text("node_id").notNull(),
    ownerId: text("owner_id").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }).notNull(),
    purgeAfter: timestamp("purge_after", { withTimezone: true, mode: "date" }).notNull(),
    recoveryEnvelope: ciphertext("recovery_envelope"),
  },
  (table) => [
    primaryKey({ columns: [table.nodeId] }),
    foreignKey({ columns: [table.nodeId, table.ownerId], foreignColumns: [nodes.id, nodes.ownerId], name: "recoverable_deletions_node_owner_fk" }),
    check("recoverable_deletions_purge_after_deleted", sql`${table.purgeAfter} > ${table.deletedAt}`),
  ],
);

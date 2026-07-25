/** Defines explicit synchronization state without storing provider tokens in JSON. */
import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, pgTable, primaryKey, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
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
    providerResourceId: text("provider_resource_id"),
    verificationTokenEnvelope: ciphertext("verification_token_envelope").notNull(),
    verificationTokenHash: text("verification_token_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    lifecycle: text("lifecycle").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true, mode: "date" }).defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true, mode: "date" }),
    failureCount: integer("failure_count").notNull().default(0),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true, mode: "date" }),
    renewalGeneration: integer("renewal_generation"),
    renewalLeaseId: text("renewal_lease_id"),
    cleanupRequired: boolean("cleanup_required").notNull().default(false),
  },
  (table) => [
    unique("sync_channels_provider_channel_unique").on(table.ownerId, table.provider, table.providerChannelId),
    unique("sync_channels_provider_channel_lookup_uq").on(table.provider, table.providerChannelId),
    check("sync_channels_provider_non_empty", sql`${table.provider} <> ''`),
    check("sync_channels_calendar_non_empty", sql`${table.providerCalendarId} <> ''`),
    check("sync_channels_channel_non_empty", sql`${table.providerChannelId} <> ''`),
    check("sync_channels_resource_non_empty", sql`${table.providerResourceId} is null or ${table.providerResourceId} <> ''`),
    check("sync_channels_token_hash_valid", sql`${table.verificationTokenHash} is null or ${table.verificationTokenHash} ~ '^[A-Za-z0-9_-]{43}$'`),
    check("sync_channels_lifecycle_valid", sql`${table.lifecycle} in ('pending', 'active', 'retired', 'failed')`),
    check("sync_channels_resource_lifecycle_consistent", sql`(${table.lifecycle} in ('active', 'retired') and ${table.providerResourceId} is not null) or ${table.lifecycle} in ('pending', 'failed')`),
    check("sync_channels_activation_consistent", sql`(${table.lifecycle} = 'active' and ${table.activatedAt} is not null and ${table.retiredAt} is null) or (${table.lifecycle} = 'retired' and ${table.activatedAt} is not null and ${table.retiredAt} is not null) or ${table.lifecycle} in ('pending', 'failed')`),
    check("sync_channels_failure_count_non_negative", sql`${table.failureCount} >= 0`),
    check("sync_channels_renewal_generation_positive", sql`${table.renewalGeneration} is null or ${table.renewalGeneration} > 0`),
    check("sync_channels_renewal_lease_consistent", sql`(${table.lifecycle} in ('pending', 'failed')) = (${table.renewalLeaseId} is not null) or ${table.lifecycle} in ('active', 'retired')`),
    uniqueIndex("sync_channels_one_pending_renewal_uq")
      .on(table.ownerId, table.provider, table.providerCalendarId)
      .where(sql`${table.lifecycle} = 'pending'`),
    index("sync_channels_cleanup_idx").on(
      table.ownerId,
      table.provider,
      table.providerCalendarId,
      table.cleanupRequired,
      table.lifecycle,
    ),
    index("sync_channels_renewal_idx").on(
      table.ownerId,
      table.provider,
      table.providerCalendarId,
      table.lifecycle,
      table.expiresAt,
    ),
  ],
);

/** Stores one durable renewal election and failure counter per connected private calendar. */
export const calendarSyncMaintenance = pgTable(
  "calendar_sync_maintenance",
  {
    ownerId: text("owner_id").notNull(),
    provider: text("provider").notNull(),
    providerCalendarId: text("provider_calendar_id").notNull(),
    connectionVersion: integer("connection_version").notNull(),
    checkpointVersion: integer("checkpoint_version").notNull(),
    renewalGeneration: integer("renewal_generation").notNull().default(0),
    renewalLeaseId: text("renewal_lease_id"),
    renewalLeaseExpiresAt: timestamp("renewal_lease_expires_at", { withTimezone: true, mode: "date" }),
    renewalFailures: integer("renewal_failures").notNull().default(0),
    currentChannelRowId: text("current_channel_row_id"),
    credentialFailureCheckpointVersion: integer("credential_failure_checkpoint_version"),
    credentialFailureCategory: text("credential_failure_category"),
    credentialFailureRecordedAt: timestamp("credential_failure_recorded_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.provider, table.providerCalendarId] }),
    check("calendar_sync_maintenance_owner_non_empty", sql`${table.ownerId} <> ''`),
    check("calendar_sync_maintenance_provider_non_empty", sql`${table.provider} <> ''`),
    check("calendar_sync_maintenance_calendar_non_empty", sql`${table.providerCalendarId} <> ''`),
    check("calendar_sync_maintenance_connection_version_positive", sql`${table.connectionVersion} > 0`),
    check("calendar_sync_maintenance_checkpoint_version_non_negative", sql`${table.checkpointVersion} >= 0`),
    check("calendar_sync_maintenance_generation_non_negative", sql`${table.renewalGeneration} >= 0`),
    check("calendar_sync_maintenance_failures_non_negative", sql`${table.renewalFailures} >= 0`),
    check("calendar_sync_maintenance_credential_version_non_negative", sql`${table.credentialFailureCheckpointVersion} is null or ${table.credentialFailureCheckpointVersion} >= 0`),
    check("calendar_sync_maintenance_credential_category_valid", sql`${table.credentialFailureCategory} is null or ${table.credentialFailureCategory} in ('authorization', 'concurrency', 'database', 'provider', 'payload_too_large', 'quota', 'schema', 'sync_token_invalid', 'transient')`),
    check("calendar_sync_maintenance_credential_marker_consistent", sql`(${table.credentialFailureCheckpointVersion} is null) = (${table.credentialFailureCategory} is null) and (${table.credentialFailureCheckpointVersion} is null) = (${table.credentialFailureRecordedAt} is null)`),
    check("calendar_sync_maintenance_lease_consistent", sql`(${table.renewalLeaseId} is null) = (${table.renewalLeaseExpiresAt} is null)`),
    check("calendar_sync_maintenance_timestamps_valid", sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
);

/** Stores idempotent notification work and content-free queue outcomes. */
export const calendarSyncJobs = pgTable(
  "calendar_sync_jobs",
  {
    jobId: text("job_id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    provider: text("provider").notNull(),
    providerCalendarId: text("provider_calendar_id").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull(),
    attempts: integer("attempts").notNull().default(0),
    claimId: text("claim_id"),
    claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    lastErrorCategory: text("last_error_category"),
    actionRequired: boolean("action_required").notNull().default(false),
    checkpointVersion: integer("checkpoint_version"),
    pageCount: integer("page_count"),
    stagedCount: integer("staged_count"),
    upsertedCount: integer("upserted_count"),
    deletedCount: integer("deleted_count"),
    unchangedCount: integer("unchanged_count"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    check("calendar_sync_jobs_owner_non_empty", sql`${table.ownerId} <> ''`),
    check("calendar_sync_jobs_provider_non_empty", sql`${table.provider} <> ''`),
    check("calendar_sync_jobs_calendar_non_empty", sql`${table.providerCalendarId} <> ''`),
    check("calendar_sync_jobs_reason_valid", sql`${table.reason} in ('initial', 'manual', 'push', 'rebuild', 'repair')`),
    check("calendar_sync_jobs_status_valid", sql`${table.status} in ('pending_enqueue', 'enqueued', 'in_progress', 'retry_scheduled', 'succeeded', 'failed')`),
    check("calendar_sync_jobs_attempts_non_negative", sql`${table.attempts} >= 0`),
    check("calendar_sync_jobs_claim_consistent", sql`(${table.status} = 'in_progress' and ${table.claimId} is not null and ${table.claimedAt} is not null) or (${table.status} <> 'in_progress' and ${table.claimId} is null)`),
    check("calendar_sync_jobs_error_category_valid", sql`${table.lastErrorCategory} is null or ${table.lastErrorCategory} in ('authorization', 'concurrency', 'database', 'provider', 'payload_too_large', 'quota', 'schema', 'sync_token_invalid', 'transient')`),
    check("calendar_sync_jobs_checkpoint_positive", sql`${table.checkpointVersion} is null or ${table.checkpointVersion} > 0`),
    check("calendar_sync_jobs_counts_non_negative", sql`(${table.pageCount} is null or ${table.pageCount} > 0) and (${table.stagedCount} is null or ${table.stagedCount} >= 0) and (${table.upsertedCount} is null or ${table.upsertedCount} >= 0) and (${table.deletedCount} is null or ${table.deletedCount} >= 0) and (${table.unchangedCount} is null or ${table.unchangedCount} >= 0)`),
    check("calendar_sync_jobs_completed_consistent", sql`(${table.status} in ('succeeded', 'failed')) = (${table.completedAt} is not null)`),
    check("calendar_sync_jobs_action_required_terminal", sql`not ${table.actionRequired} or ${table.status} = 'failed'`),
    check("calendar_sync_jobs_timestamps_valid", sql`${table.updatedAt} >= ${table.createdAt} and (${table.claimedAt} is null or ${table.claimedAt} >= ${table.createdAt}) and (${table.completedAt} is null or ${table.completedAt} >= ${table.createdAt})`),
    index("calendar_sync_jobs_owner_calendar_updated_idx").on(
      table.ownerId,
      table.provider,
      table.providerCalendarId,
      table.updatedAt.desc(),
    ),
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

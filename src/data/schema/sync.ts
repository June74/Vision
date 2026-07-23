/** Defines explicit synchronization state without storing provider tokens in JSON. */
import { sql } from "drizzle-orm";
import { check, foreignKey, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";
import { ciphertext, nodes } from "./nodes";

/** Stores the last safely committed provider sync token as encrypted binary data. */
export const syncCheckpoints = pgTable(
  "sync_checkpoints",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    provider: text("provider").notNull(),
    providerCalendarId: text("provider_calendar_id").notNull(),
    syncTokenEnvelope: ciphertext("sync_token_envelope").notNull(),
    keyVersion: text("key_version").notNull(),
    committedAt: timestamp("committed_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    unique("sync_checkpoints_provider_calendar_unique").on(table.ownerId, table.provider, table.providerCalendarId),
    check("sync_checkpoints_provider_non_empty", sql`${table.provider} <> ''`),
    check("sync_checkpoints_calendar_non_empty", sql`${table.providerCalendarId} <> ''`),
    check("sync_checkpoints_key_version_non_empty", sql`${table.keyVersion} <> ''`),
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

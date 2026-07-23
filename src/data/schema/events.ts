/** Defines planning-safe event columns and nullable binary envelopes for protected event content. */
import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, integer, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";
import { ciphertext, nodes } from "./nodes";

/** Stores one provider-backed event with explicit identity and no plaintext protected payload columns. */
export const events = pgTable(
  "events",
  {
    nodeId: text("node_id").notNull(),
    ownerId: text("owner_id").notNull(),
    nodeType: text("node_type").notNull().default("event"),
    provider: text("provider").notNull(),
    providerCalendarId: text("provider_calendar_id").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    providerVersion: text("provider_version").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
    timeZone: text("time_zone").notNull(),
    busy: boolean("busy").notNull(),
    status: text("status").notNull(),
    recurrenceId: text("recurrence_id"),
    titleEnvelope: ciphertext("title_envelope"),
    descriptionEnvelope: ciphertext("description_envelope"),
    attendeesEnvelope: ciphertext("attendees_envelope"),
    locationEnvelope: ciphertext("location_envelope"),
    meetingLinkEnvelope: ciphertext("meeting_link_envelope"),
    protectedKeyVersion: integer("protected_key_version"),
  },
  (table) => [
    primaryKey({ columns: [table.nodeId] }),
    unique("events_node_owner_unique").on(table.nodeId, table.ownerId),
    unique("events_provider_identity_unique").on(table.provider, table.providerCalendarId, table.providerEventId),
    foreignKey({
      columns: [table.nodeId, table.ownerId],
      foreignColumns: [nodes.id, nodes.ownerId],
      name: "events_node_owner_fk",
    }),
    foreignKey({
      columns: [table.nodeId, table.ownerId, table.nodeType],
      foreignColumns: [nodes.id, nodes.ownerId, nodes.nodeType],
      name: "events_node_owner_type_fk",
    }),
    check("events_provider_non_empty", sql`${table.provider} <> ''`),
    check("events_calendar_non_empty", sql`${table.providerCalendarId} <> ''`),
    check("events_provider_event_non_empty", sql`${table.providerEventId} <> ''`),
    check("events_provider_version_non_empty", sql`${table.providerVersion} <> ''`),
    check("events_node_type_event", sql`${table.nodeType} = 'event'`),
    check("events_end_after_start", sql`${table.endsAt} > ${table.startsAt}`),
    check("events_status_valid", sql`${table.status} in ('confirmed', 'tentative', 'cancelled')`),
    check("events_protected_key_positive", sql`${table.protectedKeyVersion} is null or ${table.protectedKeyVersion} > 0`),
  ],
);

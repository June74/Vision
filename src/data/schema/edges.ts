/** Defines governed graph relations with explicit endpoint types and owner-scoped foreign keys. */
import { sql } from "drizzle-orm";
import { check, foreignKey, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { nodes } from "./nodes";

/** Stores an authorized relationship between two nodes owned by the same Vision account. */
export const edges = pgTable(
  "edges",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    sourceNodeId: text("source_node_id").notNull(),
    sourceNodeType: text("source_node_type").notNull(),
    destinationNodeId: text("destination_node_id").notNull(),
    destinationNodeType: text("destination_node_type").notNull(),
    relation: text("relation").notNull(),
    origin: text("origin").notNull(),
    evidence: text("evidence"),
    confidence: integer("confidence"),
    lifecycle: text("lifecycle").notNull(),
    privacy: text("privacy").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
    version: integer("version").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.sourceNodeId, table.ownerId],
      foreignColumns: [nodes.id, nodes.ownerId],
      name: "edges_source_owner_fk",
    }),
    foreignKey({
      columns: [table.destinationNodeId, table.ownerId],
      foreignColumns: [nodes.id, nodes.ownerId],
      name: "edges_destination_owner_fk",
    }),
    foreignKey({
      columns: [table.sourceNodeId, table.ownerId, table.sourceNodeType],
      foreignColumns: [nodes.id, nodes.ownerId, nodes.nodeType],
      name: "edges_source_owner_type_fk",
    }),
    foreignKey({
      columns: [table.destinationNodeId, table.ownerId, table.destinationNodeType],
      foreignColumns: [nodes.id, nodes.ownerId, nodes.nodeType],
      name: "edges_destination_owner_type_fk",
    }),
    check("edges_relation_valid", sql`${table.relation} in ('event_in_calendar', 'task_from_source', 'note_about_event', 'commitment_for_person', 'recommendation_for_event', 'preference_for_policy', 'policy_governs_event', 'alert_episode_for_event')`),
    check("edges_relation_endpoints_valid", sql`(${table.relation} = 'event_in_calendar' and ${table.sourceNodeType} = 'event' and ${table.destinationNodeType} = 'calendar') or (${table.relation} = 'task_from_source' and ${table.sourceNodeType} = 'task' and ${table.destinationNodeType} = 'source_artifact') or (${table.relation} = 'note_about_event' and ${table.sourceNodeType} = 'note' and ${table.destinationNodeType} = 'event') or (${table.relation} = 'commitment_for_person' and ${table.sourceNodeType} = 'commitment' and ${table.destinationNodeType} = 'person') or (${table.relation} = 'recommendation_for_event' and ${table.sourceNodeType} = 'recommendation' and ${table.destinationNodeType} = 'event') or (${table.relation} = 'preference_for_policy' and ${table.sourceNodeType} = 'preference' and ${table.destinationNodeType} = 'policy') or (${table.relation} = 'policy_governs_event' and ${table.sourceNodeType} = 'policy' and ${table.destinationNodeType} = 'event') or (${table.relation} = 'alert_episode_for_event' and ${table.sourceNodeType} = 'alert_episode' and ${table.destinationNodeType} = 'event')`),
    check("edges_origin_valid", sql`${table.origin} in ('provider', 'user', 'system', 'model')`),
    check("edges_lifecycle_valid", sql`${table.lifecycle} in ('proposed', 'confirmed', 'rejected', 'retracted')`),
    check("edges_privacy_valid", sql`${table.privacy} in ('planning', 'private', 'restricted')`),
    check("edges_confidence_valid", sql`${table.confidence} is null or (${table.confidence} >= 0 and ${table.confidence} <= 1000000)`),
    check("edges_validity_valid", sql`${table.validTo} is null or (${table.validFrom} is not null and ${table.validTo} > ${table.validFrom})`),
    check("edges_version_positive", sql`${table.version} > 0`),
  ],
);

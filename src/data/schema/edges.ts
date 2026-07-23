/** Defines governed graph relations with explicit endpoint types and owner-scoped foreign keys. */
import { foreignKey, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
  ],
);

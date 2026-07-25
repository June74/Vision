/** Defines encrypted first-party annotations that remain independent from provider projections. */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { ciphertext, nodes } from "./nodes";

/** Stores one Vision-owned annotation without placing its protected text in queryable columns. */
export const nodeAnnotations = pgTable(
  "node_annotations",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    nodeId: text("node_id").notNull(),
    provenance: text("provenance").notNull(),
    annotationEnvelope: ciphertext("annotation_envelope").notNull(),
    keyVersion: integer("key_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.nodeId, table.ownerId],
      foreignColumns: [nodes.id, nodes.ownerId],
      name: "node_annotations_node_owner_fk",
    }),
    check("node_annotations_owner_non_empty", sql`${table.ownerId} <> ''`),
    check("node_annotations_provenance_valid", sql`${table.provenance} in ('user', 'system', 'model')`),
    check("node_annotations_key_version_positive", sql`${table.keyVersion} > 0`),
    check("node_annotations_timestamps_valid", sql`${table.updatedAt} >= ${table.createdAt}`),
    index("node_annotations_owner_node_idx").on(
      table.ownerId,
      table.nodeId,
      table.updatedAt.desc(),
    ),
  ],
);

/** Stores the explicit provenance of the category materialized on an authoritative node. */
export const nodeCategoryAssignments = pgTable(
  "node_category_assignments",
  {
    nodeId: text("node_id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    domain: text("domain").notNull(),
    domainState: text("domain_state").notNull(),
    provenance: text("provenance").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true, mode: "date" }).notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.nodeId, table.ownerId],
      foreignColumns: [nodes.id, nodes.ownerId],
      name: "node_category_assignments_node_owner_fk",
    }),
    check("node_category_assignments_domain_valid", sql`${table.domain} in ('school', 'work', 'personal')`),
    check("node_category_assignments_state_valid", sql`${table.domainState} in ('confirmed', 'inferred')`),
    check("node_category_assignments_provenance_valid", sql`${table.provenance} in ('user', 'system', 'model')`),
    check("node_category_assignments_version_positive", sql`${table.version} > 0`),
    index("node_category_assignments_owner_domain_idx").on(
      table.ownerId,
      table.domain,
      table.assignedAt.desc(),
    ),
  ],
);

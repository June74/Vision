/** Defines the shared PostgreSQL envelope for every authoritative Vision graph node. */
import { customType, integer, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";

/** Maps authenticated ciphertext envelopes to PostgreSQL's binary `bytea` storage type. */
export const ciphertext = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  /** Returns PostgreSQL's binary column type for encrypted envelopes. */
  dataType: () => "bytea",
});

/** Stores canonical node facts without placing identity or protected content in JSON. */
export const nodes = pgTable(
  "nodes",
  {
    id: text("id").notNull(),
    ownerId: text("owner_id").notNull(),
    identityKind: text("identity_kind", { enum: ["provider", "first_party", "system"] }).notNull(),
    provider: text("provider").notNull(),
    providerNodeId: text("provider_node_id").notNull(),
    nodeType: text("node_type").notNull(),
    domain: text("domain").notNull(),
    domainState: text("domain_state").notNull(),
    privacy: text("privacy").notNull(),
    provenance: text("provenance").notNull(),
    lifecycle: text("lifecycle").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
    version: integer("version").notNull(),
    modelConfidence: integer("model_confidence"),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    unique("nodes_id_owner_unique").on(table.id, table.ownerId),
    unique("nodes_id_owner_type_unique").on(table.id, table.ownerId, table.nodeType),
    unique("nodes_owner_provider_identity_unique").on(table.ownerId, table.provider, table.providerNodeId),
  ],
);

/** Defines the shared PostgreSQL envelope for every authoritative Vision graph node. */
import { sql } from "drizzle-orm";
import { check, customType, integer, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";

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
    check("nodes_owner_non_empty", sql`${table.ownerId} <> ''`),
    check("nodes_provider_non_empty", sql`${table.provider} <> ''`),
    check("nodes_provider_node_non_empty", sql`${table.providerNodeId} <> ''`),
    check("nodes_identity_kind_valid", sql`${table.identityKind} in ('provider', 'first_party', 'system')`),
    check("nodes_type_valid", sql`${table.nodeType} in ('event', 'task', 'note', 'commitment', 'recommendation', 'preference', 'policy', 'audit_event', 'person', 'calendar', 'source_artifact', 'alert_episode')`),
    check("nodes_domain_valid", sql`${table.domain} in ('school', 'work', 'personal', 'unresolved')`),
    check("nodes_domain_state_valid", sql`${table.domainState} in ('confirmed', 'inferred', 'unresolved') and ((${table.domain} = 'unresolved') = (${table.domainState} = 'unresolved'))`),
    check("nodes_privacy_valid", sql`${table.privacy} in ('planning', 'private', 'restricted')`),
    check("nodes_provenance_valid", sql`${table.provenance} in ('provider', 'user', 'system', 'model')`),
    check("nodes_lifecycle_valid", sql`${table.lifecycle} in ('active', 'deleted', 'purged')`),
    check("nodes_timestamps_valid", sql`${table.updatedAt} >= ${table.createdAt} and (${table.validTo} is null or ${table.validTo} > ${table.validFrom})`),
    check("nodes_version_positive", sql`${table.version} > 0`),
    check("nodes_inference_confidence_valid", sql`((${table.domainState} = 'inferred') = (${table.modelConfidence} is not null)) and (${table.modelConfidence} is null or (${table.modelConfidence} >= 0 and ${table.modelConfidence} <= 1000000))`),
  ],
);

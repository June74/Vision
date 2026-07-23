import type { SchemaTablesManifest } from "./schema-manifest";

/**
 * Hand-authored from the eight CREATE TABLE statements in migrations/0001_phase_b_foundation.sql.
 * Never regenerate this fixture from Drizzle metadata or the generated snapshot.
 *
 * Primary and unique keys intentionally record columns rather than generated names because the
 * reviewed SQL leaves those names implicit. Foreign-key and check labels are the stable Drizzle
 * names for their corresponding reviewed clauses. Three node checks join adjacent migration
 * clauses with `and`: domain state, timestamps, and inferred confidence.
 */
export const phaseBSchemaManifest = {
  // Migration lines 107-119: create table audit_events.
  audit_events: {
    columns: [
      ["id", "text", true],
      ["owner_id", "text", true],
      ["node_id", "text", false],
      ["actor_type", "text", true],
      ["action", "text", true],
      ["outcome", "text", true],
      ["provider", "text", false],
      ["error_category", "text", false],
      ["occurred_at", "timestamptz", true],
    ],
    primaryKeys: [["id"]],
    uniqueKeys: [],
    foreignKeys: [
      ["audit_events_node_owner_fk", ["node_id", "owner_id"], "nodes", ["id", "owner_id"]],
    ],
    checks: [
      ["audit_events_owner_non_empty", "owner_id <> ''"],
    ],
  },

  // Migration lines 77-105: create table edges.
  edges: {
    columns: [
      ["id", "text", true],
      ["owner_id", "text", true],
      ["source_node_id", "text", true],
      ["source_node_type", "text", true],
      ["destination_node_id", "text", true],
      ["destination_node_type", "text", true],
      ["relation", "text", true],
      ["origin", "text", true],
      ["evidence", "text", false],
      ["confidence", "integer", false],
      ["lifecycle", "text", true],
      ["privacy", "text", true],
      ["valid_from", "timestamptz", false],
      ["valid_to", "timestamptz", false],
      ["version", "integer", true],
    ],
    primaryKeys: [["id"]],
    uniqueKeys: [],
    foreignKeys: [
      ["edges_destination_owner_fk", ["destination_node_id", "owner_id"], "nodes", ["id", "owner_id"]],
      ["edges_destination_owner_type_fk", ["destination_node_id", "owner_id", "destination_node_type"], "nodes", ["id", "owner_id", "node_type"]],
      ["edges_source_owner_fk", ["source_node_id", "owner_id"], "nodes", ["id", "owner_id"]],
      ["edges_source_owner_type_fk", ["source_node_id", "owner_id", "source_node_type"], "nodes", ["id", "owner_id", "node_type"]],
    ],
    checks: [
      ["edges_confidence_valid", "confidence is null or (confidence >= 0 and confidence <= 1000000)"],
      ["edges_lifecycle_valid", "lifecycle in ('proposed', 'confirmed', 'rejected', 'retracted')"],
      ["edges_origin_valid", "origin in ('provider', 'user', 'system', 'model')"],
      ["edges_privacy_valid", "privacy in ('planning', 'private', 'restricted')"],
      ["edges_relation_endpoints_valid", "(relation = 'event_in_calendar' and source_node_type = 'event' and destination_node_type = 'calendar') or (relation = 'task_from_source' and source_node_type = 'task' and destination_node_type = 'source_artifact') or (relation = 'note_about_event' and source_node_type = 'note' and destination_node_type = 'event') or (relation = 'commitment_for_person' and source_node_type = 'commitment' and destination_node_type = 'person') or (relation = 'recommendation_for_event' and source_node_type = 'recommendation' and destination_node_type = 'event') or (relation = 'preference_for_policy' and source_node_type = 'preference' and destination_node_type = 'policy') or (relation = 'policy_governs_event' and source_node_type = 'policy' and destination_node_type = 'event') or (relation = 'alert_episode_for_event' and source_node_type = 'alert_episode' and destination_node_type = 'event')"],
      ["edges_relation_valid", "relation in ('event_in_calendar', 'task_from_source', 'note_about_event', 'commitment_for_person', 'recommendation_for_event', 'preference_for_policy', 'policy_governs_event', 'alert_episode_for_event')"],
      ["edges_validity_valid", "valid_to is null or (valid_from is not null and valid_to > valid_from)"],
      ["edges_version_positive", "version > 0"],
    ],
  },

  // Migration lines 42-75: create table events.
  events: {
    columns: [
      ["node_id", "text", true],
      ["owner_id", "text", true],
      ["node_type", "text", true, "'event'"],
      ["provider", "text", true],
      ["provider_calendar_id", "text", true],
      ["provider_event_id", "text", true],
      ["provider_version", "text", true],
      ["starts_at", "timestamptz", true],
      ["ends_at", "timestamptz", true],
      ["time_zone", "text", true],
      ["busy", "boolean", true],
      ["status", "text", true],
      ["recurrence_id", "text", false],
      ["title_envelope", "bytea", false],
      ["description_envelope", "bytea", false],
      ["attendees_envelope", "bytea", false],
      ["location_envelope", "bytea", false],
      ["meeting_link_envelope", "bytea", false],
      ["protected_key_version", "integer", false],
    ],
    primaryKeys: [["node_id"]],
    uniqueKeys: [
      ["node_id", "owner_id"],
      ["provider", "provider_calendar_id", "provider_event_id"],
    ],
    foreignKeys: [
      ["events_node_owner_fk", ["node_id", "owner_id"], "nodes", ["id", "owner_id"]],
      ["events_node_owner_type_fk", ["node_id", "owner_id", "node_type"], "nodes", ["id", "owner_id", "node_type"]],
    ],
    checks: [
      ["events_calendar_non_empty", "provider_calendar_id <> ''"],
      ["events_end_after_start", "ends_at > starts_at"],
      ["events_node_type_event", "node_type = 'event'"],
      ["events_protected_key_positive", "protected_key_version is null or protected_key_version > 0"],
      ["events_provider_event_non_empty", "provider_event_id <> ''"],
      ["events_provider_non_empty", "provider <> ''"],
      ["events_provider_version_non_empty", "provider_version <> ''"],
      ["events_status_valid", "status in ('confirmed', 'tentative', 'cancelled')"],
    ],
  },

  // Migration lines 2-40: create table nodes.
  nodes: {
    columns: [
      ["id", "text", true],
      ["owner_id", "text", true],
      ["identity_kind", "text", true],
      ["provider", "text", true],
      ["provider_node_id", "text", true],
      ["node_type", "text", true],
      ["domain", "text", true],
      ["domain_state", "text", true],
      ["privacy", "text", true],
      ["provenance", "text", true],
      ["lifecycle", "text", true],
      ["created_at", "timestamptz", true],
      ["updated_at", "timestamptz", true],
      ["valid_from", "timestamptz", true],
      ["valid_to", "timestamptz", false],
      ["version", "integer", true],
      ["model_confidence", "integer", false],
    ],
    primaryKeys: [["id"]],
    uniqueKeys: [
      ["id", "owner_id", "node_type"],
      ["id", "owner_id"],
      ["owner_id", "provider", "provider_node_id"],
    ],
    foreignKeys: [],
    checks: [
      ["nodes_domain_state_valid", "domain_state in ('confirmed', 'inferred', 'unresolved') and ((domain = 'unresolved') = (domain_state = 'unresolved'))"],
      ["nodes_domain_valid", "domain in ('school', 'work', 'personal', 'unresolved')"],
      ["nodes_identity_kind_valid", "identity_kind in ('provider', 'first_party', 'system')"],
      ["nodes_inference_confidence_valid", "((domain_state = 'inferred') = (model_confidence is not null)) and (model_confidence is null or (model_confidence >= 0 and model_confidence <= 1000000))"],
      ["nodes_lifecycle_valid", "lifecycle in ('active', 'deleted', 'purged')"],
      ["nodes_owner_non_empty", "owner_id <> ''"],
      ["nodes_privacy_valid", "privacy in ('planning', 'private', 'restricted')"],
      ["nodes_provenance_valid", "provenance in ('provider', 'user', 'system', 'model')"],
      ["nodes_provider_node_non_empty", "provider_node_id <> ''"],
      ["nodes_provider_non_empty", "provider <> ''"],
      ["nodes_timestamps_valid", "updated_at >= created_at and (valid_to is null or valid_to > valid_from)"],
      ["nodes_type_valid", "node_type in ('event', 'task', 'note', 'commitment', 'recommendation', 'preference', 'policy', 'audit_event', 'person', 'calendar', 'source_artifact', 'alert_episode')"],
      ["nodes_version_positive", "version > 0"],
    ],
  },

  // Migration lines 151-164: create table operation_ledger.
  operation_ledger: {
    columns: [
      ["operation_id", "text", true],
      ["owner_id", "text", true],
      ["provider", "text", true],
      ["provider_operation_id", "text", true],
      ["operation_kind", "text", true],
      ["status", "text", true],
      ["requested_at", "timestamptz", true],
      ["completed_at", "timestamptz", false],
      ["response_envelope", "bytea", false],
    ],
    primaryKeys: [["operation_id"]],
    uniqueKeys: [
      ["owner_id", "provider", "provider_operation_id"],
    ],
    foreignKeys: [],
    checks: [
      ["operation_ledger_operation_non_empty", "provider_operation_id <> ''"],
      ["operation_ledger_provider_non_empty", "provider <> ''"],
    ],
  },

  // Migration lines 166-175: create table recoverable_deletions.
  recoverable_deletions: {
    columns: [
      ["node_id", "text", true],
      ["owner_id", "text", true],
      ["deleted_at", "timestamptz", true],
      ["purge_after", "timestamptz", true],
      ["recovery_envelope", "bytea", false],
    ],
    primaryKeys: [["node_id"]],
    uniqueKeys: [],
    foreignKeys: [
      ["recoverable_deletions_node_owner_fk", ["node_id", "owner_id"], "nodes", ["id", "owner_id"]],
    ],
    checks: [
      ["recoverable_deletions_purge_after_deleted", "purge_after > deleted_at"],
    ],
  },

  // Migration lines 135-149: create table sync_channels.
  sync_channels: {
    columns: [
      ["id", "text", true],
      ["owner_id", "text", true],
      ["provider", "text", true],
      ["provider_calendar_id", "text", true],
      ["provider_channel_id", "text", true],
      ["provider_resource_id", "text", true],
      ["verification_token_envelope", "bytea", true],
      ["expires_at", "timestamptz", true],
    ],
    primaryKeys: [["id"]],
    uniqueKeys: [
      ["owner_id", "provider", "provider_channel_id"],
    ],
    foreignKeys: [],
    checks: [
      ["sync_channels_calendar_non_empty", "provider_calendar_id <> ''"],
      ["sync_channels_channel_non_empty", "provider_channel_id <> ''"],
      ["sync_channels_provider_non_empty", "provider <> ''"],
      ["sync_channels_resource_non_empty", "provider_resource_id <> ''"],
    ],
  },

  // Migration lines 121-133: create table sync_checkpoints.
  sync_checkpoints: {
    columns: [
      ["id", "text", true],
      ["owner_id", "text", true],
      ["provider", "text", true],
      ["provider_calendar_id", "text", true],
      ["sync_token_envelope", "bytea", true],
      ["key_version", "text", true],
      ["committed_at", "timestamptz", true],
    ],
    primaryKeys: [["id"]],
    uniqueKeys: [
      ["owner_id", "provider", "provider_calendar_id"],
    ],
    foreignKeys: [],
    checks: [
      ["sync_checkpoints_calendar_non_empty", "provider_calendar_id <> ''"],
      ["sync_checkpoints_key_version_non_empty", "key_version <> ''"],
      ["sync_checkpoints_provider_non_empty", "provider <> ''"],
    ],
  },
} satisfies SchemaTablesManifest;

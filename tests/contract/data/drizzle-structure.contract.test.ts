import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { auditEvents, edges, events, nodes, operationLedger, recoverableDeletions, syncChannels, syncCheckpoints } from "../../../src/data/schema";

/** Lists declared constraint names so omitted Drizzle constraints fail independently of raw migration text. */
function constraintNames(values: Array<{ name?: string }>): string[] {
  return values.map((value) => value.name ?? "").sort();
}

describe("Drizzle schema structure", () => {
  it("models every reviewed key, foreign key, and supported check constraint", () => {
    const nodeConfig = getTableConfig(nodes);
    const eventConfig = getTableConfig(events);
    const edgeConfig = getTableConfig(edges);
    const auditConfig = getTableConfig(auditEvents);
    const ledgerConfig = getTableConfig(operationLedger);
    const checkpointConfig = getTableConfig(syncCheckpoints);
    const channelConfig = getTableConfig(syncChannels);
    const recoveryConfig = getTableConfig(recoverableDeletions);

    expect(constraintNames(nodeConfig.checks)).toEqual(["nodes_domain_state_valid", "nodes_domain_valid", "nodes_identity_kind_valid", "nodes_inference_confidence_valid", "nodes_lifecycle_valid", "nodes_owner_non_empty", "nodes_privacy_valid", "nodes_provenance_valid", "nodes_provider_node_non_empty", "nodes_provider_non_empty", "nodes_timestamps_valid", "nodes_type_valid", "nodes_version_positive"]);
    expect(constraintNames(eventConfig.checks)).toEqual(["events_calendar_non_empty", "events_end_after_start", "events_node_type_event", "events_protected_key_positive", "events_provider_event_non_empty", "events_provider_non_empty", "events_provider_version_non_empty", "events_status_valid"]);
    expect(constraintNames(edgeConfig.checks)).toEqual(["edges_confidence_valid", "edges_lifecycle_valid", "edges_origin_valid", "edges_privacy_valid", "edges_relation_endpoints_valid", "edges_relation_valid", "edges_validity_valid", "edges_version_positive"]);
    expect(constraintNames(auditConfig.checks)).toEqual(["audit_events_owner_non_empty"]);
    expect(constraintNames(ledgerConfig.checks)).toEqual(["operation_ledger_operation_non_empty", "operation_ledger_provider_non_empty"]);
    expect(constraintNames(checkpointConfig.checks)).toEqual(["sync_checkpoints_calendar_non_empty", "sync_checkpoints_key_version_non_empty", "sync_checkpoints_provider_non_empty"]);
    expect(constraintNames(channelConfig.checks)).toEqual(["sync_channels_calendar_non_empty", "sync_channels_channel_non_empty", "sync_channels_provider_non_empty", "sync_channels_resource_non_empty"]);
    expect(constraintNames(recoveryConfig.checks)).toEqual(["recoverable_deletions_purge_after_deleted"]);
    expect(eventConfig.foreignKeys).toHaveLength(2);
    expect(edgeConfig.foreignKeys).toHaveLength(4);
    expect(auditConfig.foreignKeys).toHaveLength(1);
    expect(recoveryConfig.foreignKeys).toHaveLength(1);
    expect(recoveryConfig.primaryKeys).toHaveLength(1);
  });
});

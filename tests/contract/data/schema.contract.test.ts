import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase B graph-schema migration", () => {
  it("preserves each reviewed table's keys, ownership, encrypted envelopes, lifecycle, and graph constraints", () => {
    const sql = readFileSync(resolve(process.cwd(), "migrations/0001_phase_b_foundation.sql"), "utf8").toLowerCase();

    expect(sql).toContain("create table nodes");
    expect(sql).toContain("primary key (id)");
    expect(sql).toContain("unique (owner_id, provider, provider_node_id)");
    expect(sql).toContain("check (owner_id <> '')");
    expect(sql).toContain("check ((domain = 'unresolved') = (domain_state = 'unresolved'))");
    expect(sql).toContain("check (updated_at >= created_at)");
    expect(sql).toContain("check (version > 0)");

    expect(sql).toContain("create table events");
    expect(sql).toContain("title_envelope bytea");
    expect(sql).toContain("meeting_link_envelope bytea");
    expect(sql).toContain("unique (provider, provider_calendar_id, provider_event_id)");
    expect(sql).toContain("foreign key (node_id, owner_id) references nodes (id, owner_id)");
    expect(sql).toContain("check (ends_at > starts_at)");
    expect(sql).toContain("check (status in ('confirmed', 'tentative', 'cancelled'))");

    expect(sql).toContain("create table edges");
    expect(sql).toContain("foreign key (source_node_id, owner_id)");
    expect(sql).toContain("foreign key (destination_node_id, owner_id)");
    expect(sql).toContain("check (relation in ('event_in_calendar'");
    expect(sql).toContain("check (valid_to is null or (valid_from is not null and valid_to > valid_from))");

    expect(sql).toContain("create table audit_events");
    expect(sql).toContain("foreign key (node_id, owner_id) references nodes (id, owner_id)");
    expect(sql).toContain("create table sync_checkpoints");
    expect(sql).toContain("sync_token_envelope bytea not null");
    expect(sql).toContain("create table sync_channels");
    expect(sql).toContain("verification_token_envelope bytea not null");
    expect(sql).toContain("create table operation_ledger");
    expect(sql).toContain("response_envelope bytea");
    expect(sql).toContain("create table recoverable_deletions");
    expect(sql).toContain("recovery_envelope bytea");
    expect(sql).toContain("check (purge_after > deleted_at)");
  });
});

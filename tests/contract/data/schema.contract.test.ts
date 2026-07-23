import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase B graph-schema migration", () => {
  it("preserves the reviewed authority, identity, lifecycle, and edge constraints", () => {
    const sql = readFileSync(resolve(process.cwd(), "migrations/0001_phase_b_foundation.sql"), "utf8").toLowerCase();

    expect(sql).toContain("create table nodes");
    expect(sql).toContain("primary key");
    expect(sql).toContain("foreign key");
    expect(sql).toContain("check (owner_id <> '')");
    expect(sql).toContain("unique (provider, provider_calendar_id, provider_event_id)");
    expect(sql).toContain("created_at");
    expect(sql).toContain("updated_at");
    expect(sql).toContain("valid_from");
    expect(sql).toContain("valid_to");
    expect(sql).toContain("check (version > 0)");
    expect(sql).toContain("foreign key (source_node_id, owner_id)");
    expect(sql).toContain("check (relation in (");
  });
});

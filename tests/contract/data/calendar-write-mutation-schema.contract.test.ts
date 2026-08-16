import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractDrizzleTablesManifest } from "./schema-manifest";
import {
  calendarWriteApprovals,
  calendarWriteOperations,
} from "../../../src/data/schema/calendar-write";

describe("Phase C mutation persistence schema", () => {
  it("adds mutation identity and scope without changing the existing tables destructively", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "migrations/0011_phase_c_event_mutations.sql"),
      "utf8",
    ).toLowerCase();

    expect(sql).toContain("alter table calendar_write_approvals");
    expect(sql).toContain("add column action text");
    expect(sql).toContain("add column provider_event_id text");
    expect(sql).toContain("add column provider_event_version text");
    expect(sql).toContain("add column mutation_scope text");
    expect(sql).toContain("check (action in ('create', 'update', 'move', 'cancel', 'delete'))");
    expect(sql).toContain("check (mutation_scope in ('single', 'series'))");
    expect(sql).toContain("check ((provider_event_id is null) = (provider_event_version is null))");
    expect(sql).not.toContain("drop table");
    expect(sql).not.toContain("drop column");
  });

  it("declares the mutation columns in the Drizzle manifest", () => {
    const manifest = extractDrizzleTablesManifest([
      calendarWriteApprovals,
      calendarWriteOperations,
    ]);

    expect(manifest.calendar_write_approvals.columns.map(([name]) => name)).toEqual([
      "operation_id",
      "owner_id",
      "provider",
      "calendar_id",
      "action",
      "provider_event_id",
      "provider_event_version",
      "mutation_scope",
      "proposal_domain",
      "status",
      "requested_at",
      "expires_at",
      "proposal_envelope",
    ]);
    expect(manifest.calendar_write_operations.columns.map(([name]) => name)).toEqual([
      "operation_id",
      "owner_id",
      "provider",
      "calendar_id",
      "status",
      "provider_event_id",
      "provider_event_version",
      "requested_at",
      "completed_at",
    ]);
  });
});

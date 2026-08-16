import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractDrizzleTablesManifest } from "./schema-manifest";
import {
  calendarWriteApprovals,
  calendarWriteOperations,
} from "../../../src/data/schema/calendar-write";

describe("Phase C calendar-write schema", () => {
  it("defines additive owner-scoped approval and execution tables", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "migrations/0010_phase_c_calendar_write_surface.sql",
      ),
      "utf8",
    ).toLowerCase();

    expect(sql).toContain("create table calendar_write_approvals");
    expect(sql).toContain("proposal_envelope bytea");
    expect(sql).toContain("proposal_domain text not null");
    expect(sql).toContain(
      "check (status in ('proposed', 'confirmed', 'invalidated'))",
    );
    expect(sql).toContain("create table calendar_write_operations");
    expect(sql).toContain(
      "check (status in ('writing', 'verification_pending', 'verified', 'failed', 'undone'))",
    );
    expect(sql).toContain(
      "check ((provider_event_id is null) = (provider_event_version is null))",
    );
    expect(sql).not.toContain("drop table");
  });

  it("declares the reviewed encrypted approval and execution columns", () => {
    const manifest = extractDrizzleTablesManifest([
      calendarWriteApprovals,
      calendarWriteOperations,
    ]);

    expect(manifest.calendar_write_approvals.columns.map(([name]) => name)).toEqual([
      "operation_id",
      "owner_id",
      "provider",
      "calendar_id",
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

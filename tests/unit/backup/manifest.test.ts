import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT_V1,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  createBackupManifest,
  type BackupRowCounts,
  validateBackupManifest,
} from "../../../src/domain/backup/manifest";

const emptyCounts = Object.fromEntries(
  BACKUP_TABLES.map((table) => [table, 0]),
) as unknown as BackupRowCounts;

describe("BackupManifestV1", () => {
  it("covers every authoritative table through migration 0009 in dependency-safe order", () => {
    expect(BACKUP_SCHEMA_VERSION).toBe(9);
    expect(BACKUP_TABLES).toEqual([
      "data_key_state",
      "wrapped_data_keys",
      "oauth_admission_windows",
      "oauth_transactions",
      "auth_sessions",
      "google_oauth_tokens",
      "calendar_setup_states",
      "calendar_setup_candidates",
      "vision_calendar_connections",
      "nodes",
      "events",
      "event_sync_payloads",
      "node_annotations",
      "node_category_assignments",
      "edges",
      "audit_events",
      "operation_ledger",
      "calendar_create_snapshots",
      "recoverable_deletions",
      "sync_checkpoints",
      "sync_channels",
      "calendar_sync_maintenance",
      "calendar_sync_jobs",
      "sync_runs",
      "projection_rebuild_generations",
      "projection_rebuild_changes",
      "ai_usage_months",
      "ai_usage_reservations",
      "ai_usage_ledger",
    ]);
  });

  it("creates the exact current versioned manifest", () => {
    const manifest = createBackupManifest({
      createdAt: "2026-07-25T18:00:00.000Z",
      rowCounts: { ...emptyCounts, nodes: 2, events: 1 },
      plaintextSha256: "A".repeat(43),
      keyVersion: 4,
    });

    expect(manifest).toEqual({
      format: BACKUP_FORMAT_V1,
      createdAt: "2026-07-25T18:00:00.000Z",
      schemaVersion: BACKUP_SCHEMA_VERSION,
      rowCounts: { ...emptyCounts, nodes: 2, events: 1 },
      plaintextSha256: "A".repeat(43),
      keyVersion: 4,
    });
  });

  it("rejects unsupported format and schema versions", () => {
    const valid = createBackupManifest({
      createdAt: "2026-07-25T18:00:00.000Z",
      rowCounts: emptyCounts,
      plaintextSha256: "A".repeat(43),
      keyVersion: 1,
    });

    expect(() => validateBackupManifest({ ...valid, format: "vision-backup/v2" })).toThrow(
      /format/i,
    );
    expect(() => validateBackupManifest({ ...valid, schemaVersion: 10 })).toThrow(
      /schema/i,
    );
  });

  it("requires every authoritative table count and no unknown table", () => {
    const valid = createBackupManifest({
      createdAt: "2026-07-25T18:00:00.000Z",
      rowCounts: emptyCounts,
      plaintextSha256: "A".repeat(43),
      keyVersion: 1,
    });
    const { nodes: _nodes, ...missingNodes } = valid.rowCounts;

    expect(() => validateBackupManifest({ ...valid, rowCounts: missingNodes })).toThrow(
      /row counts/i,
    );
    expect(() =>
      validateBackupManifest({
        ...valid,
        rowCounts: { ...valid.rowCounts, unknown_table: 1 },
      }),
    ).toThrow(/row counts/i);
  });

  it("rejects malformed checksums, timestamps, counts, key versions, and extra fields", () => {
    const valid = createBackupManifest({
      createdAt: "2026-07-25T18:00:00.000Z",
      rowCounts: emptyCounts,
      plaintextSha256: "A".repeat(43),
      keyVersion: 1,
    });

    expect(() => validateBackupManifest({ ...valid, plaintextSha256: "not-a-hash" })).toThrow(
      /checksum/i,
    );
    expect(() => validateBackupManifest({ ...valid, createdAt: "not-a-time" })).toThrow(
      /created/i,
    );
    expect(() =>
      validateBackupManifest({
        ...valid,
        rowCounts: { ...valid.rowCounts, nodes: -1 },
      }),
    ).toThrow(/row counts/i);
    expect(() => validateBackupManifest({ ...valid, keyVersion: 0 })).toThrow(
      /key version/i,
    );
    expect(() => validateBackupManifest({ ...valid, extra: true })).toThrow(/fields/i);
  });
});

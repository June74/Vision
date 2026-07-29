import { describe, expect, it, vi } from "vitest";
import type { BackupObjectWriter } from "../../../src/jobs/create-daily-backup";
import {
  TEMPORARY_PREVIEW_FAULT_ACTION,
  TEMPORARY_PREVIEW_FAULT_CRON,
  createTemporaryPreviewFaultEvidence,
  runTemporaryPreviewFault,
} from "../../../src/jobs/temporary-preview-fault";

describe("temporary preview fault evidence", () => {
  it.each([
    ["queue_delayed", "succeeded", "none"],
    ["job_failed", "succeeded", "none"],
    ["channel_expired", "succeeded", "none"],
    ["database_unavailable", "succeeded", "none"],
    ["r2_upload_failed", "failed", "backup_storage_write_failed"],
    ["ai_stopped", "succeeded", "none"],
  ] as const)("creates the exact closed %s terminal record", (scenario, outcome, category) => {
    expect(createTemporaryPreviewFaultEvidence(scenario)).toEqual({
      evidenceType: "vision.preview-fault/v1",
      scenario,
      outcome,
      category,
    });
  });

  it("emits one success record without touching an R2 boundary for every diagnostic-only scenario", async () => {
    for (const scenario of [
      "queue_delayed",
      "job_failed",
      "channel_expired",
      "database_unavailable",
      "ai_stopped",
    ] as const) {
      const runR2Upload = vi.fn();
      const write = vi.fn();

      await runTemporaryPreviewFault(
        { VISION_ENV: "preview", PREVIEW_ACCEPTANCE_SCENARIO: scenario },
        { runR2Upload },
        write,
      );

      expect(runR2Upload).not.toHaveBeenCalled();
      expect(write).toHaveBeenCalledExactlyOnceWith({
        action: TEMPORARY_PREVIEW_FAULT_ACTION,
        evidence: createTemporaryPreviewFaultEvidence(scenario),
      });
    }
  });

  it("injects a failure before the R2 writer mutates and preserves the fixed scheduled failure", async () => {
    const write = vi.fn();
    const runR2Upload = vi.fn(async (writer: BackupObjectWriter) => {
      await writer.putIfAbsent(
        "unused",
        new Uint8Array(),
        {
          format: "vision-backup/v1",
          createdDate: "2026-07-28",
          ciphertextSha256: "a".repeat(43),
          keyVersion: "1",
        },
        "unused",
      );
    });

    await expect(
      runTemporaryPreviewFault(
        { VISION_ENV: "preview", PREVIEW_ACCEPTANCE_SCENARIO: "r2_upload_failed" },
        { runR2Upload },
        write,
      ),
    ).rejects.toThrow("Backup storage write failed.");

    expect(runR2Upload).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledExactlyOnceWith({
      action: TEMPORARY_PREVIEW_FAULT_ACTION,
      evidence: {
        evidenceType: "vision.preview-fault/v1",
        scenario: "r2_upload_failed",
        outcome: "failed",
        category: "backup_storage_write_failed",
      },
    });
    expect(TEMPORARY_PREVIEW_FAULT_CRON).toBe("* * * * *");
  });
});

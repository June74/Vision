import { describe, expect, it } from "vitest";
import {
  parsePreviewAcceptanceContext,
  serializePreviewAcceptanceContext,
} from "../../../scripts/prepare-preview-acceptance-deploy-config";

const SHA = "a".repeat(40);

describe("preview acceptance context", () => {
  it("admits maintenance observe context with only the canonical scheduled tick", () => {
    const context = {
      version: "vision.preview-acceptance-context/v1" as const,
      kind: "observe" as const,
      reviewedCommit: SHA,
      evidenceFamily: "calendar_maintenance" as const,
      expectedOutcome: "maintenance_succeeded" as const,
      maintenanceScheduledAt: "2026-07-30T18:15:00.000Z",
    };

    expect(
      parsePreviewAcceptanceContext(
        "observe",
        serializePreviewAcceptanceContext(context),
      ).context,
    ).toEqual(context);
  });

  it("rejects the removed observerClosesAt key even when it equals tick plus 120 seconds", () => {
    expect(() =>
      parsePreviewAcceptanceContext(
        "observe",
        JSON.stringify({
          version: "vision.preview-acceptance-context/v1",
          kind: "observe",
          reviewedCommit: SHA,
          evidenceFamily: "calendar_maintenance",
          expectedOutcome: "maintenance_succeeded",
          maintenanceScheduledAt: "2026-07-30T18:15:00.000Z",
          observerClosesAt: "2026-07-30T18:17:00.000Z",
        }),
      ),
    ).toThrow("Preview acceptance workflow selection is invalid.");
  });
});

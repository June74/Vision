import { describe, expect, it } from "vitest";
import {
  parsePreviewAcceptanceContext,
  serializePreviewAcceptanceContext,
} from "../../../scripts/prepare-preview-acceptance-deploy-config";

const SHA = "a".repeat(40);

describe("preview acceptance context", () => {
  it.each([
    ["baseline", "baseline"],
    ["1201", "1202"],
  ] as const)(
    "binds normal deployment admission to the %s lifecycle pair",
    (candidateRunRef, rollbackClosureRunRef) => {
      const context = {
        version: "vision.preview-acceptance-context/v1" as const,
        kind: "none" as const,
        reviewedCommit: SHA,
        candidateRunRef,
        rollbackClosureRunRef,
      };

      expect(
        parsePreviewAcceptanceContext(
          "none",
          serializePreviewAcceptanceContext(context),
        ).context,
      ).toEqual(context);
    },
  );

  it.each([
    ["missing lifecycle pair", {}],
    ["mixed baseline pair", {
      candidateRunRef: "baseline",
      rollbackClosureRunRef: "1202",
    }],
    ["leading-zero candidate", {
      candidateRunRef: "01201",
      rollbackClosureRunRef: "1202",
    }],
    ["extra field", {
      candidateRunRef: "1201",
      rollbackClosureRunRef: "1202",
      extra: true,
    }],
  ])("rejects normal deployment context with %s", (_label, lifecycle) => {
    expect(() =>
      parsePreviewAcceptanceContext(
        "none",
        JSON.stringify({
          version: "vision.preview-acceptance-context/v1",
          kind: "none",
          reviewedCommit: SHA,
          ...lifecycle,
        }),
      ),
    ).toThrow("Preview acceptance workflow selection is invalid.");
  });

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

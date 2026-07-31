import { describe, expect, it } from "vitest";
import {
  parsePreviewAcceptanceContext,
  serializePreviewAcceptanceContext,
  type PreviewAcceptanceContext,
} from "../../../scripts/prepare-preview-acceptance-deploy-config";

const SHA = "a".repeat(40);

describe("preview acceptance context", () => {
  it("keeps AI window fields out of the non-AI observe type", () => {
    const nonAiObserveWithWindow = {
      version: "vision.preview-acceptance-context/v1",
      kind: "observe",
      reviewedCommit: SHA,
      evidenceFamily: "foundation_probe",
      expectedOutcome: "foundation_succeeded",
      evidenceScheduledAt: "2026-07-30T18:28:00.000Z",
      expiresAt: "2026-07-30T18:28:00.250Z",
    } as const;

    // @ts-expect-error AI window fields are not part of a non-AI observe variant.
    const rejected: PreviewAcceptanceContext = nonAiObserveWithWindow;
    expect(rejected).toBe(nonAiObserveWithWindow);
  });

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

  it.each([
    ["foundation", "foundation_probe", "foundation_succeeded", {}],
    [
      "fault",
      "preview_fault",
      "fault_expected",
      { faultScenario: "database_unavailable" },
    ],
    ["synchronization suppression", "sync_suppression", "sync_suppressed", {}],
    ["role probe", "role_probe", "role_probe_succeeded", {}],
    ["restore", "restore", "restore_succeeded", {}],
    [
      "maintenance success",
      "calendar_maintenance",
      "maintenance_succeeded",
      { maintenanceScheduledAt: "2026-07-30T18:15:00.000Z" },
    ],
    [
      "maintenance repair reservation",
      "calendar_maintenance",
      "maintenance_repair_reserved",
      { maintenanceScheduledAt: "2026-07-30T18:15:00.000Z" },
    ],
  ] as const)(
    "rejects AI-only window fields on the %s observe variant",
    (_label, evidenceFamily, expectedOutcome, variantFields) => {
      expect(() =>
        parsePreviewAcceptanceContext(
          "observe",
          JSON.stringify({
            version: "vision.preview-acceptance-context/v1",
            kind: "observe",
            reviewedCommit: SHA,
            evidenceFamily,
            expectedOutcome,
            ...variantFields,
            evidenceScheduledAt: "2026-07-30T18:28:00.000Z",
            expiresAt: "2026-07-30T18:28:00.250Z",
          }),
        ),
      ).toThrow("Preview acceptance workflow selection is invalid.");
    },
  );
});

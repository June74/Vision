import { describe, expect, it } from "vitest";
import { AI_HARD_STOP_CENTS } from "../../../src/domain/budget/ai-budget";
import {
  TEMPORARY_PREVIEW_FAULT_SCENARIOS,
  applyTemporaryPreviewFaultOverlay,
  parseTemporaryPreviewFaultScenario,
} from "../../../src/domain/operations/temporary-preview-fault";
import type { FoundationHealthFacts } from "../../../src/domain/operations/health";

const NOW = new Date("2026-07-28T12:00:00.000Z");

function facts(): FoundationHealthFacts {
  return {
    authorizationState: "connected",
    checkpointStatus: "connected",
    lastSuccessfulSyncAt: new Date("2026-07-28T11:59:00.000Z"),
    oldestQueuedJobAt: null,
    queueRetryCount: 0,
    failedJobCount: 0,
    channelExpiresAt: new Date("2026-07-30T12:00:00.000Z"),
    databaseAvailable: true,
    databaseUsageWarning: false,
    r2UsageWarning: false,
    aiMonthlyCents: 0,
    safeErrorCode: null,
  };
}

describe("temporary preview fault scenario admission", () => {
  it("admits only one exact preview deployment binding", () => {
    expect(TEMPORARY_PREVIEW_FAULT_SCENARIOS).toEqual([
      "queue_delayed",
      "job_failed",
      "channel_expired",
      "database_unavailable",
      "r2_upload_failed",
      "ai_stopped",
    ]);
    expect(Object.isFrozen(TEMPORARY_PREVIEW_FAULT_SCENARIOS)).toBe(true);
    expect(
      parseTemporaryPreviewFaultScenario({
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "queue_delayed",
      }),
    ).toBe("queue_delayed");
    expect(parseTemporaryPreviewFaultScenario({ VISION_ENV: "preview" })).toBeUndefined();

    for (const invalid of [
      { VISION_ENV: "production", PREVIEW_ACCEPTANCE_SCENARIO: "queue_delayed" },
      { VISION_ENV: "preview", PREVIEW_ACCEPTANCE_SCENARIO: "unknown" },
      { VISION_ENV: "preview", PREVIEW_ACCEPTANCE_SCENARIO: ["queue_delayed", "job_failed"] },
      { VISION_ENV: "preview", PREVIEW_ACCEPTANCE_SCENARIO: "queue_delayed,job_failed" },
      { VISION_ENV: "preview", PREVIEW_ACCEPTANCE_SCENARIO: 1 },
    ]) {
      expect(() => parseTemporaryPreviewFaultScenario(invalid)).toThrow(
        "Temporary preview fault scenario is invalid.",
      );
    }
  });

  it.each([
    "route",
    "query",
    "header",
    "cookie",
    "body",
    "queueMessage",
    "databaseRow",
    "modelOutput",
  ])("cannot activate from a nested %s value", (source) => {
    expect(
      parseTemporaryPreviewFaultScenario({
        VISION_ENV: "preview",
        [source]: { PREVIEW_ACCEPTANCE_SCENARIO: "job_failed" },
      }),
    ).toBeUndefined();
  });
});

describe("temporary preview fault overlays", () => {
  it.each([
    ["queue_delayed", { oldestQueuedJobAt: new Date("2026-07-28T11:45:00.000Z") }],
    ["job_failed", { failedJobCount: 1 }],
    ["channel_expired", { channelExpiresAt: new Date("2026-07-28T11:59:59.999Z") }],
    ["database_unavailable", { databaseAvailable: false }],
    ["ai_stopped", { aiMonthlyCents: AI_HARD_STOP_CENTS }],
  ] as const)("creates a copy-on-write %s diagnostic fact overlay", (scenario, expected) => {
    const original = facts();
    const result = applyTemporaryPreviewFaultOverlay(scenario, original, NOW);

    expect(result).toMatchObject(expected);
    expect(result).not.toBe(original);
    expect(original).toEqual(facts());
  });

  it("leaves R2 failure diagnostics on the normal read path", () => {
    const original = facts();

    expect(applyTemporaryPreviewFaultOverlay("r2_upload_failed", original, NOW)).toBe(original);
  });
});

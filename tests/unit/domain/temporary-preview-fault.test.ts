import { describe, expect, it } from "vitest";
import { AI_HARD_STOP_CENTS } from "../../../src/domain/budget/ai-budget";
import {
  TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS,
  TEMPORARY_PREVIEW_FAULT_SCENARIOS,
  applyTemporaryPreviewFaultOverlay,
  parseTemporaryPreviewAcceptanceAiGatewayAttestation,
  parseTemporaryPreviewAcceptanceSelector,
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
  it("keeps foundation and AI selectors separate from the strict fault tuple", () => {
    expect(TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS).toEqual([
      ...TEMPORARY_PREVIEW_FAULT_SCENARIOS,
      "foundation_probe",
      "ai_usage",
    ]);
    expect(Object.isFrozen(TEMPORARY_PREVIEW_ACCEPTANCE_SELECTORS)).toBe(true);
    expect(
      parseTemporaryPreviewAcceptanceSelector({
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
      }),
    ).toBe("foundation_probe");
    expect(
      parseTemporaryPreviewAcceptanceSelector({
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
        PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
      }),
    ).toBe("ai_usage");
    expect(
      parseTemporaryPreviewAcceptanceSelector({ VISION_ENV: "preview" }),
    ).toBeUndefined();

    for (const invalid of [
      {
        VISION_ENV: "production",
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
      },
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "unknown",
      },
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: [
          "foundation_probe",
          "ai_usage",
        ],
      },
    ]) {
      expect(() =>
        parseTemporaryPreviewAcceptanceSelector(invalid),
      ).toThrow("Temporary preview acceptance selector is invalid.");
    }
  });

  it("admits the exact Gateway boolean only for the dedicated AI selector", () => {
    expect(
      parseTemporaryPreviewAcceptanceAiGatewayAttestation({
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
        PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
      }),
    ).toBe(true);
    expect(
      parseTemporaryPreviewAcceptanceAiGatewayAttestation({
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
      }),
    ).toBe(false);
    expect(
      parseTemporaryPreviewAcceptanceAiGatewayAttestation({
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "ai_stopped",
      }),
    ).toBe(false);

    for (const invalid of [
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
      },
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
        PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: true,
      },
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
        PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "false",
      },
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
        PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
      },
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "ai_stopped",
        PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
      },
      {
        VISION_ENV: "production",
        PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
        PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
      },
    ]) {
      expect(() =>
        parseTemporaryPreviewAcceptanceAiGatewayAttestation(invalid),
      ).toThrow("Temporary preview AI Gateway attestation is invalid.");
    }
  });

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

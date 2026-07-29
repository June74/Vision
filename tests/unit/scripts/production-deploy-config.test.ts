import { describe, expect, it } from "vitest";
import { validateProductionDeployConfig } from "../../../scripts/validate-production-deploy-config";
import {
  AI_PRICING_POLICY_VALUES,
  type AiPricingBindingName,
} from "../../../src/server/ai-pricing-binding-contract";

const NORMAL_CRONS = ["*/15 * * * *", "5 6 * * *"] as const;

function productionArtifact() {
  return {
    targetEnvironment: "production",
    queues: {
      producers: [
        {
          binding: "CALENDAR_SYNC_QUEUE",
          queue: "vision-production-calendar-sync",
        },
      ],
      consumers: [
        {
          queue: "vision-production-calendar-sync",
          max_batch_size: 10,
          max_batch_timeout: 5,
          max_retries: 5,
          max_concurrency: 1,
        },
      ],
    },
    triggers: { crons: [...NORMAL_CRONS] },
    r2_buckets: [
      {
        binding: "BACKUP_BUCKET",
        bucket_name: "vision-production-backups",
      },
    ],
    vars: {
      VISION_ENV: "production",
      AI_MONTHLY_HARD_LIMIT_CENTS: "950",
      ...AI_PRICING_POLICY_VALUES,
      BACKUP_KEY_VERSION: "1",
      DATABASE_USAGE_WARNING_BYTES: "400000000",
      R2_USAGE_WARNING_BYTES: "8000000000",
      R2_USAGE_WARNING_OBJECTS: "100",
    },
  };
}

describe("production deploy artifact validation", () => {
  it("accepts the explicit generated production artifact", () => {
    expect(() => validateProductionDeployConfig(productionArtifact())).not.toThrow();
  });

  it.each(Object.keys(AI_PRICING_POLICY_VALUES) as AiPricingBindingName[])(
    "rejects an arbitrary nonnegative production value for %s",
    (name) => {
      const artifact = productionArtifact();
      artifact.vars[name] = String(
        Number(AI_PRICING_POLICY_VALUES[name]) + 1,
      );
      expect(() => validateProductionDeployConfig(artifact)).toThrow(
        /production deployment configuration is invalid/i,
      );
    },
  );

  it.each(["010", "1.0", 10, null])(
    "rejects malformed or wrong-typed production pricing %j",
    (invalid) => {
      const artifact = productionArtifact();
      (
        artifact.vars as Record<string, unknown>
      ).AI_ROUTINE_WORST_CASE_CENTS = invalid;
      expect(() => validateProductionDeployConfig(artifact)).toThrow(
        /production deployment configuration is invalid/i,
      );
    },
  );

  it.each([
    ["preview target", { targetEnvironment: "preview" }],
    [
      "preview queue",
      {
        queues: {
          producers: [
            { binding: "CALENDAR_SYNC_QUEUE", queue: "vision-calendar-sync" },
          ],
          consumers: [
            {
              queue: "vision-calendar-sync",
              max_batch_size: 10,
              max_batch_timeout: 5,
              max_retries: 5,
              max_concurrency: 1,
            },
          ],
        },
      },
    ],
    ["missing variables", { vars: {} }],
    [
      "temporary selector",
      {
        vars: {
          ...productionArtifact().vars,
          PREVIEW_ACCEPTANCE_SCENARIO: "job_failed",
        },
      },
    ],
    ["missing backup bucket", { r2_buckets: [] }],
    ["one-minute schedule", { triggers: { crons: [...NORMAL_CRONS, "* * * * *"] } }],
  ])("rejects a %s artifact", (_label, override) => {
    expect(() =>
      validateProductionDeployConfig({
        ...productionArtifact(),
        ...override,
      }),
    ).toThrow("Production deployment configuration is invalid.");
  });
});

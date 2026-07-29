import { describe, expect, it } from "vitest";
import { validateProductionDeployConfig } from "../../../scripts/validate-production-deploy-config";

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

/** Locks normal routing and the generated preview acceptance candidate boundary. */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  preparePreviewAcceptanceDeployConfig,
  validatePreviewAcceptanceWorkflowInputs,
  type PreviewAcceptanceSelector,
} from "../../../scripts/prepare-preview-acceptance-deploy-config";
import {
  validatePreviewAcceptanceDeployConfig,
  validatePreviewDeployConfig,
} from "../../../scripts/validate-preview-deploy-config";

const NORMAL_CRONS = ["*/15 * * * *", "5 6 * * *"] as const;
const ACCEPTANCE_CRON = "* * * * *";
const FAULT_SCENARIOS = [
  "queue_delayed",
  "job_failed",
  "channel_expired",
  "database_unavailable",
  "r2_upload_failed",
  "ai_stopped",
] as const;
const ACCEPTANCE_SELECTORS = [
  ...FAULT_SCENARIOS,
  "foundation_probe",
  "ai_usage",
] as const;

interface DeployConfig {
  targetEnvironment?: string;
  assets?: { run_worker_first?: string[] };
  queues?: {
    producers?: Array<{ binding?: string; queue?: string }>;
    consumers?: Array<{
      queue?: string;
      max_batch_size?: number;
      max_batch_timeout?: number;
      max_retries?: number;
      max_concurrency?: number;
    }>;
  };
  triggers?: { crons?: string[] };
  r2_buckets?: Array<{ binding?: string; bucket_name?: string }>;
  vars?: Record<string, string>;
  env?: Record<"preview" | "production", DeployConfig>;
}

function previewArtifact(): DeployConfig {
  return {
    targetEnvironment: "preview",
    assets: {
      run_worker_first: ["/api/*", "/webhooks/google/calendar"],
    },
    queues: {
      producers: [
        {
          binding: "CALENDAR_SYNC_QUEUE",
          queue: "vision-calendar-sync",
        },
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
    triggers: { crons: [...NORMAL_CRONS] },
    r2_buckets: [
      {
        binding: "BACKUP_BUCKET",
        bucket_name: "vision-preview-backups",
      },
    ],
    vars: {
      VISION_ENV: "preview",
      AI_MONTHLY_HARD_LIMIT_CENTS: "950",
      BACKUP_KEY_VERSION: "1",
      DATABASE_USAGE_WARNING_BYTES: "400000000",
      R2_USAGE_WARNING_BYTES: "8000000000",
      R2_USAGE_WARNING_OBJECTS: "100",
      GOOGLE_REDIRECT_URI:
        "https://vision-preview.june74.workers.dev/api/auth/google/callback",
    },
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe("Cloudflare asset and normal schedule routing", () => {
  it("keeps committed local, preview, and production configuration normal", async () => {
    const config = JSON.parse(
      await readFile(
        new URL("../../../wrangler.jsonc", import.meta.url),
        "utf8",
      ),
    ) as DeployConfig;

    expect(config.assets?.run_worker_first).toEqual([
      "/api/*",
      "/webhooks/google/calendar",
    ]);
    expect(config.queues?.producers).toEqual([
      {
        binding: "CALENDAR_SYNC_QUEUE",
        queue: "vision-calendar-sync",
      },
    ]);
    expect(config.queues?.consumers).toEqual([
      expect.objectContaining({
        queue: "vision-calendar-sync",
        max_retries: 5,
        max_concurrency: 1,
      }),
    ]);
    expect(config.triggers?.crons).toEqual(NORMAL_CRONS);
    expect(config.env?.preview.triggers?.crons).toEqual(NORMAL_CRONS);
    expect(config.env?.production.triggers?.crons).toEqual(NORMAL_CRONS);
    expect(config.r2_buckets).toBeUndefined();
    expect(config.env?.preview.r2_buckets).toEqual([
      {
        binding: "BACKUP_BUCKET",
        bucket_name: "vision-preview-backups",
      },
    ]);
    expect(config.env?.production.r2_buckets).toEqual([
      {
        binding: "BACKUP_BUCKET",
        bucket_name: "vision-production-backups",
      },
    ]);
    expect(config.env?.preview.r2_buckets?.[0]?.bucket_name).not.toBe(
      config.env?.production.r2_buckets?.[0]?.bucket_name,
    );
    for (const environment of ["preview", "production"] as const) {
      expect(config.env?.[environment].queues).toEqual(config.queues);
      expect(config.env?.[environment].vars?.BACKUP_KEY_VERSION).toBe("1");
      expect(config.env?.[environment].vars).toMatchObject({
        DATABASE_USAGE_WARNING_BYTES: "400000000",
        R2_USAGE_WARNING_BYTES: "8000000000",
        R2_USAGE_WARNING_OBJECTS: "100",
      });
      expect(config.env?.[environment].vars).not.toHaveProperty(
        "BACKUP_ENCRYPTION_KEY",
      );
      expect(
        Object.keys(config.env?.[environment].vars ?? {}).filter((name) =>
          name.startsWith("PREVIEW_ACCEPTANCE_"),
        ),
      ).toEqual([]);
    }
    expect(
      Object.keys(config.vars ?? {}).filter((name) =>
        name.startsWith("PREVIEW_ACCEPTANCE_"),
      ),
    ).toEqual([]);

    const [previewWorkflow, productionWorkflow] = await Promise.all([
      readFile(
        new URL("../../../.github/workflows/preview.yml", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../../../.github/workflows/production.yml", import.meta.url),
        "utf8",
      ),
    ]);
    expect(previewWorkflow).not.toContain("--env preview");
    expect(previewWorkflow).not.toContain("--var ");
    expect(previewWorkflow).toContain("pnpm deploy:check:preview");
    expect(productionWorkflow).toContain("--env production");
  });
});

describe("generated preview acceptance candidate", () => {
  it.each(FAULT_SCENARIOS)(
    "adds only the %s selector and one acceptance cron",
    (scenario) => {
      const source = previewArtifact();
      const before = clone(source);
      const candidate = preparePreviewAcceptanceDeployConfig({
        normalConfig: source,
        selector: scenario,
      }) as DeployConfig;

      expect(source).toEqual(before);
      expect(candidate).not.toBe(source);
      expect(candidate.triggers?.crons).toEqual([
        ...NORMAL_CRONS,
        ACCEPTANCE_CRON,
      ]);
      expect(candidate.vars).toEqual({
        ...source.vars,
        PREVIEW_ACCEPTANCE_SCENARIO: scenario,
      });
      expect(candidate.vars).not.toHaveProperty(
        "PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED",
      );
      expect(() =>
        validatePreviewAcceptanceDeployConfig(candidate, scenario),
      ).not.toThrow();
    },
  );

  it("keeps the foundation candidate separate from fault and AI evidence", () => {
    const candidate = preparePreviewAcceptanceDeployConfig({
      normalConfig: previewArtifact(),
      selector: "foundation_probe",
    });

    expect(candidate.vars).toMatchObject({
      PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
    });
    expect(candidate.vars).not.toHaveProperty(
      "PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED",
    );
    expect(() =>
      validatePreviewAcceptanceDeployConfig(candidate, "foundation_probe"),
    ).not.toThrow();
  });

  it("adds the same-run Gateway attestation only to the AI evidence candidate", () => {
    const candidate = preparePreviewAcceptanceDeployConfig({
      normalConfig: previewArtifact(),
      selector: "ai_usage",
      aiGatewayLimitAttested: true,
    });

    expect(candidate.vars).toMatchObject({
      PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
      PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
    });
    expect(() =>
      validatePreviewAcceptanceDeployConfig(candidate, "ai_usage"),
    ).not.toThrow();
  });

  it("rejects missing or misplaced Gateway attestation", () => {
    expect(() =>
      preparePreviewAcceptanceDeployConfig({
        normalConfig: previewArtifact(),
        selector: "ai_usage",
      }),
    ).toThrow(/acceptance deployment configuration/i);
    expect(() =>
      preparePreviewAcceptanceDeployConfig({
        normalConfig: previewArtifact(),
        selector: "foundation_probe",
        aiGatewayLimitAttested: true,
      }),
    ).toThrow(/acceptance deployment configuration/i);
    expect(() =>
      preparePreviewAcceptanceDeployConfig({
        normalConfig: previewArtifact(),
        selector: "ai_stopped",
        aiGatewayLimitAttested: true,
      }),
    ).toThrow(/acceptance deployment configuration/i);
  });

  it.each([
    [
      "production target",
      () => ({
        ...previewArtifact(),
        targetEnvironment: "production",
        vars: {
          ...previewArtifact().vars,
          VISION_ENV: "production",
        },
      }),
    ],
    [
      "missing normal cron",
      () => ({
        ...previewArtifact(),
        triggers: { crons: [NORMAL_CRONS[0]] },
      }),
    ],
    [
      "committed selector",
      () => ({
        ...previewArtifact(),
        vars: {
          ...previewArtifact().vars,
          PREVIEW_ACCEPTANCE_SCENARIO: "job_failed",
        },
      }),
    ],
    [
      "existing one-minute mutation",
      () => ({
        ...previewArtifact(),
        triggers: { crons: [...NORMAL_CRONS, ACCEPTANCE_CRON] },
      }),
    ],
    [
      "another terminal mode",
      () => ({
        ...previewArtifact(),
        vars: {
          ...previewArtifact().vars,
          PREVIEW_RESTORE_DATABASE_URL: "not-admitted",
        },
      }),
    ],
  ])("rejects a %s source artifact", (_label, makeConfig) => {
    expect(() =>
      preparePreviewAcceptanceDeployConfig({
        normalConfig: makeConfig(),
        selector: "foundation_probe",
      }),
    ).toThrow(/acceptance deployment configuration/i);
  });

  it("rejects unknown, multiple, and mismatched candidate selectors", () => {
    const candidate = preparePreviewAcceptanceDeployConfig({
      normalConfig: previewArtifact(),
      selector: "job_failed",
    });
    const unknown = clone(candidate) as DeployConfig;
    unknown.vars!.PREVIEW_ACCEPTANCE_SCENARIO = "unknown";
    const multiple = clone(candidate) as DeployConfig;
    multiple.vars!.PREVIEW_ACCEPTANCE_FOUNDATION_PROBE = "true";

    expect(() =>
      preparePreviewAcceptanceDeployConfig({
        normalConfig: previewArtifact(),
        selector: ["job_failed", "queue_delayed"] as never,
      }),
    ).toThrow(/acceptance deployment configuration/i);
    expect(() =>
      validatePreviewAcceptanceDeployConfig(unknown, "job_failed"),
    ).toThrow(/acceptance deployment configuration/i);
    expect(() =>
      validatePreviewAcceptanceDeployConfig(multiple, "job_failed"),
    ).toThrow(/acceptance deployment configuration/i);
    expect(() =>
      validatePreviewAcceptanceDeployConfig(candidate, "queue_delayed"),
    ).toThrow(/acceptance deployment configuration/i);
  });
});

describe("preview acceptance workflow input admission", () => {
  const validSelections: ReadonlyArray<
    readonly [string, string, string | undefined]
  > = [
    ["none", "none", undefined],
    ["observe", "none", undefined],
    ["deploy_foundation", "none", "foundation_probe"],
    ["deploy_ai", "none", "ai_usage"],
    ["rollback", "none", undefined],
    ...FAULT_SCENARIOS.map(
      (scenario): readonly [string, string, string] => [
        "deploy_fault",
        scenario,
        scenario,
      ],
    ),
  ];

  it.each(validSelections)(
    "admits operation %s with fault choice %s",
    (operation, faultScenario, expectedSelector) => {
      expect(
        validatePreviewAcceptanceWorkflowInputs(
          operation,
          faultScenario,
        ).selector,
      ).toBe(expectedSelector);
    },
  );

  it.each([
    ["unknown", "none"],
    ["none", "job_failed"],
    ["observe", "job_failed"],
    ["deploy_foundation", "job_failed"],
    ["deploy_ai", "ai_stopped"],
    ["deploy_fault", "none"],
    ["deploy_fault", "unknown"],
    ["rollback", "queue_delayed"],
  ])("rejects operation %s with fault choice %s", (operation, faultScenario) => {
    expect(() =>
      validatePreviewAcceptanceWorkflowInputs(operation, faultScenario),
    ).toThrow(/acceptance workflow selection/i);
  });

  it("keeps the exact eight-value selector vocabulary frozen", () => {
    const selected = ACCEPTANCE_SELECTORS.map((selector) =>
      preparePreviewAcceptanceDeployConfig({
        normalConfig: previewArtifact(),
        selector: selector as PreviewAcceptanceSelector,
        ...(selector === "ai_usage"
          ? { aiGatewayLimitAttested: true as const }
          : {}),
      }),
    );

    expect(selected).toHaveLength(8);
  });
});

describe("normal preview artifact validation", () => {
  it("accepts only the immutable two-cron normal artifact", () => {
    expect(() => validatePreviewDeployConfig(previewArtifact())).not.toThrow();

    for (const invalid of [
      {
        ...previewArtifact(),
        triggers: { crons: [...NORMAL_CRONS, ACCEPTANCE_CRON] },
      },
      {
        ...previewArtifact(),
        vars: {
          ...previewArtifact().vars,
          PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
        },
      },
      {
        ...previewArtifact(),
        targetEnvironment: "production",
      },
      {
        ...previewArtifact(),
        r2_buckets: [],
      },
      {
        ...previewArtifact(),
        queues: { producers: [], consumers: [] },
      },
      {
        ...previewArtifact(),
        vars: {
          ...previewArtifact().vars,
          R2_USAGE_WARNING_OBJECTS: "99",
        },
      },
    ]) {
      expect(() => validatePreviewDeployConfig(invalid)).toThrow(
        /preview deployment configuration/i,
      );
    }
  });
});

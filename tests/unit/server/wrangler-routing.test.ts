/** Locks normal routing and the generated preview acceptance candidate boundary. */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  preparePreviewAcceptanceDeployConfig,
  validatePreviewAcceptanceWorkflowInputs,
  type PreviewAcceptanceSelector,
} from "../../../scripts/prepare-preview-acceptance-deploy-config";
import {
  validateNormalPreviewProviderState,
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
const NORMAL_PREVIEW_PROVIDER_BINDINGS = [
  { name: "AI_COMPLEX_WORST_CASE_CENTS", type: "secret_text" },
  { name: "AI_INPUT_CENTS_PER_MILLION_TOKENS", type: "secret_text" },
  { name: "AI_MONTHLY_HARD_LIMIT_CENTS", type: "plain_text" },
  { name: "AI_OPTIONAL_WORST_CASE_CENTS", type: "secret_text" },
  { name: "AI_OUTPUT_CENTS_PER_MILLION_TOKENS", type: "secret_text" },
  { name: "AI_ROUTINE_WORST_CASE_CENTS", type: "secret_text" },
  { name: "BACKUP_BUCKET", type: "r2_bucket" },
  { name: "BACKUP_ENCRYPTION_KEY", type: "secret_text" },
  { name: "BACKUP_KEY_VERSION", type: "plain_text" },
  { name: "CALENDAR_SYNC_QUEUE", type: "queue" },
  { name: "DATABASE_URL", type: "secret_text" },
  { name: "DATABASE_USAGE_WARNING_BYTES", type: "plain_text" },
  { name: "GOOGLE_ALLOWED_EMAIL", type: "secret_text" },
  { name: "GOOGLE_ALLOWED_SUB", type: "secret_text" },
  { name: "GOOGLE_CLIENT_ID", type: "secret_text" },
  { name: "GOOGLE_CLIENT_SECRET", type: "secret_text" },
  { name: "GOOGLE_REDIRECT_URI", type: "plain_text" },
  { name: "KEY_ENCRYPTION_KEY", type: "secret_text" },
  { name: "OPENAI_API_KEY", type: "secret_text" },
  { name: "OPENAI_GATEWAY_BASE_URL", type: "secret_text" },
  { name: "R2_USAGE_WARNING_BYTES", type: "plain_text" },
  { name: "R2_USAGE_WARNING_OBJECTS", type: "plain_text" },
  { name: "VISION_ENV", type: "plain_text" },
  { name: "VISION_USER_TIME_ZONE", type: "secret_text" },
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

function normalProviderState(): {
  healthResponse: unknown;
  schedulesResponse: unknown;
  settingsResponse: unknown;
} {
  return {
    healthResponse: { status: "ok" },
    schedulesResponse: {
      success: true,
      result: NORMAL_CRONS.map((cron) => ({ cron })),
    },
    settingsResponse: {
      success: true,
      result: {
        bindings: structuredClone(NORMAL_PREVIEW_PROVIDER_BINDINGS),
      },
    },
  };
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
    expect(config.env?.preview.queues).toEqual(config.queues);
    expect(config.env?.production.queues?.producers).toEqual([
      {
        binding: "CALENDAR_SYNC_QUEUE",
        queue: "vision-production-calendar-sync",
      },
    ]);
    expect(config.env?.production.queues?.consumers).toEqual([
      expect.objectContaining({
        queue: "vision-production-calendar-sync",
        max_retries: 5,
        max_concurrency: 1,
      }),
    ]);
    expect(config.env?.production.queues).not.toEqual(config.env?.preview.queues);
    for (const environment of ["preview", "production"] as const) {
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
    expect(productionWorkflow).not.toContain("--env production");
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
    readonly [string, string, string, string | undefined]
  > = [
    ["none", "none", "not_verified", undefined],
    ["observe", "none", "not_verified", undefined],
    ["deploy_foundation", "none", "verified", "foundation_probe"],
    ["deploy_ai", "none", "verified", "ai_usage"],
    ["rollback", "none", "verified", undefined],
    ...FAULT_SCENARIOS.map(
      (scenario): readonly [string, string, string, string] => [
        "deploy_fault",
        scenario,
        "verified",
        scenario,
      ],
    ),
  ];

  it.each(validSelections)(
    "admits operation %s with fault choice %s",
    (operation, faultScenario, authenticatedReadsGate, expectedSelector) => {
      expect(
        validatePreviewAcceptanceWorkflowInputs(
          operation,
          faultScenario,
          authenticatedReadsGate,
        ).selector,
      ).toBe(expectedSelector);
    },
  );

  it.each([
    ["unknown", "none", "not_verified"],
    ["none", "job_failed", "not_verified"],
    ["observe", "job_failed", "not_verified"],
    ["deploy_foundation", "job_failed", "verified"],
    ["deploy_ai", "ai_stopped", "verified"],
    ["deploy_fault", "none", "verified"],
    ["deploy_fault", "unknown", "verified"],
    ["rollback", "queue_delayed", "verified"],
    ["deploy_foundation", "none", "not_verified"],
    ["deploy_ai", "none", "unknown"],
    ["deploy_fault", "job_failed", "not_verified"],
    ["rollback", "none", "not_verified"],
    ["none", "none", "verified"],
    ["observe", "none", "verified"],
  ])("rejects operation %s with fault choice %s and gate %s", (
    operation,
    faultScenario,
    authenticatedReadsGate,
  ) => {
    expect(() =>
      validatePreviewAcceptanceWorkflowInputs(
        operation,
        faultScenario,
        authenticatedReadsGate,
      ),
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

describe("normal preview live provider-state validation", () => {
  it("accepts healthy runtime, exactly two normal schedules, and the exact complete binding inventory", () => {
    expect(() =>
      validateNormalPreviewProviderState(normalProviderState()),
    ).not.toThrow();
    const nested = normalProviderState();
    (nested as { settingsResponse: unknown }).settingsResponse = {
      success: true,
      result: {
        settings: {
          bindings: structuredClone(NORMAL_PREVIEW_PROVIDER_BINDINGS)
            .slice()
            .reverse(),
        },
      },
    };
    expect(() => validateNormalPreviewProviderState(nested)).not.toThrow();
    const reversed = normalProviderState();
    reversed.schedulesResponse = {
      success: true,
      result: [...NORMAL_CRONS].reverse().map((cron) => ({ cron })),
    };
    expect(() => validateNormalPreviewProviderState(reversed)).not.toThrow();
  });

  it.each([
    ["missing settings result", undefined],
    ["empty bindings", { success: true, result: { bindings: [] } }],
    ["baseline subset", {
      success: true,
      result: {
        bindings: [
          { name: "VISION_ENV", type: "plain_text" },
          { name: "DATABASE_URL", type: "secret_text" },
        ],
      },
    }],
    ["null bindings", { success: true, result: { bindings: null } }],
    ["missing bindings", { success: true, result: {} }],
    ["malformed nested bindings", {
      success: true,
      result: { settings: { bindings: "not-an-array" } },
    }],
    ["binding without a name", {
      success: true,
      result: { bindings: [{ type: "plain_text" }] },
    }],
    ["binding with a non-string name", {
      success: true,
      result: { bindings: [{ name: null }] },
    }],
    ["temporary selector binding", {
      success: true,
      result: {
        bindings: [{ name: "PREVIEW_ACCEPTANCE_SCENARIO" }],
      },
    }],
    ["temporary attestation binding", {
      success: true,
      result: {
        bindings: [
          { name: "PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED" },
        ],
      },
    }],
    ["duplicate binding", {
      success: true,
      result: {
        bindings: [
          ...structuredClone(NORMAL_PREVIEW_PROVIDER_BINDINGS),
          { name: "VISION_ENV", type: "plain_text" },
        ],
      },
    }],
    ["unknown binding", {
      success: true,
      result: {
        bindings: [
          ...structuredClone(NORMAL_PREVIEW_PROVIDER_BINDINGS),
          { name: "UNKNOWN_BINDING", type: "plain_text" },
        ],
      },
    }],
    ["wrong binding type", {
      success: true,
      result: {
        bindings: structuredClone(NORMAL_PREVIEW_PROVIDER_BINDINGS).map(
          (binding) =>
            binding.name === "AI_INPUT_CENTS_PER_MILLION_TOKENS"
              ? { ...binding, type: "plain_text" }
              : binding,
        ),
      },
    }],
    ["missing AI reservation binding", {
      success: true,
      result: {
        bindings: structuredClone(NORMAL_PREVIEW_PROVIDER_BINDINGS).filter(
          ({ name }) => name !== "AI_COMPLEX_WORST_CASE_CENTS",
        ),
      },
    }],
  ])("fails closed for %s", (_label, settingsResponse) => {
    expect(() =>
      validateNormalPreviewProviderState({
        ...normalProviderState(),
        settingsResponse,
      }),
    ).toThrow(/normal preview provider state is invalid/i);
  });

  it.each([
    ["missing health", { healthResponse: undefined }],
    ["degraded health", { healthResponse: { status: "degraded" } }],
    ["missing schedules", { schedulesResponse: undefined }],
    ["failed schedules response", {
      schedulesResponse: {
        success: false,
        result: NORMAL_CRONS.map((cron) => ({ cron })),
      },
    }],
    ["one schedule", {
      schedulesResponse: {
        success: true,
        result: [{ cron: NORMAL_CRONS[0] }],
      },
    }],
    ["one-minute schedule", {
      schedulesResponse: {
        success: true,
        result: [
          ...NORMAL_CRONS.map((cron) => ({ cron })),
          { cron: ACCEPTANCE_CRON },
        ],
      },
    }],
    ["malformed schedule", {
      schedulesResponse: {
        success: true,
        result: [{ cron: NORMAL_CRONS[0] }, { cron: null }],
      },
    }],
  ])("rejects %s", (_label, override) => {
    expect(() =>
      validateNormalPreviewProviderState({
        ...normalProviderState(),
        ...override,
      }),
    ).toThrow(/normal preview provider state is invalid/i);
  });
});

/** Locks normal routing and the generated preview acceptance candidate boundary. */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
  preparePreviewAcceptanceDeployConfig,
  parsePreviewAcceptanceContext,
  serializePreviewAcceptanceContext,
  type PreviewAcceptanceContext,
  type PreviewAcceptanceSelector,
} from "../../../scripts/prepare-preview-acceptance-deploy-config";
import {
  validateNormalPreviewProviderState,
  validatePreviewProviderStateForCandidateIntent,
  validateTemporaryRestorePairProviderState,
  validatePreviewAcceptanceDeployConfig,
  validatePreviewDeployConfig,
} from "../../../scripts/validate-preview-deploy-config";
import {
  AI_PRICING_BINDING_CONTRACT,
  AI_PRICING_POLICY_VALUES,
} from "../../../src/server/ai-pricing-binding-contract";

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
  "sync_suppression",
  "role_probe",
  "restore",
] as const;
const REVIEWED_COMMIT = "a".repeat(40);
const NORMAL_PREVIEW_PROVIDER_BINDINGS = [
  ...AI_PRICING_BINDING_CONTRACT.map(({ name, type, value }) => ({
    name,
    type,
    text: value,
  })),
  { name: "AI_MONTHLY_HARD_LIMIT_CENTS", type: "plain_text" },
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
      ...AI_PRICING_POLICY_VALUES,
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
        activatedAt: new Date("2026-07-29T04:00:00.000Z"),
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
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-29T04:30:00.000Z",
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
      activatedAt: new Date("2026-07-29T04:00:00.000Z"),
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

  it("builds the exact ten-minute suppression artifact without a one-minute schedule", () => {
    const candidate = preparePreviewAcceptanceDeployConfig({
      normalConfig: previewArtifact(),
      selector: "sync_suppression",
      activatedAt: new Date("2026-07-29T04:00:00.000Z"),
    });

    expect(candidate.vars).toMatchObject({
      PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
      PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-29T04:10:00.000Z",
    });
    expect(candidate.triggers).toEqual({ crons: NORMAL_CRONS });
    expect(() =>
      validatePreviewAcceptanceDeployConfig(candidate, "sync_suppression"),
    ).not.toThrow();
  });

  it("rejects a missing, malformed, or unreviewed candidate deadline", () => {
    const candidate = preparePreviewAcceptanceDeployConfig({
      normalConfig: previewArtifact(),
      selector: "foundation_probe",
      activatedAt: new Date("2026-07-29T04:00:00.000Z"),
    });
    expect(candidate.vars).toMatchObject({
      PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-29T04:30:00.000Z",
    });
    for (const expiresAt of [
      undefined,
      "malformed",
      "2026-07-29T04:31:00Z",
      "2026-13-29T04:30:00.000Z",
    ]) {
      expect(() =>
        validatePreviewAcceptanceDeployConfig(
          {
            ...candidate,
            vars: {
              ...(candidate.vars as Record<string, unknown>),
              PREVIEW_ACCEPTANCE_EXPIRES_AT: expiresAt,
            },
          },
          "foundation_probe",
        ),
      ).toThrow(/acceptance deployment configuration/i);
    }
  });

  it("adds the same-run Gateway attestation only to the AI evidence candidate", () => {
    const candidate = preparePreviewAcceptanceDeployConfig({
      normalConfig: previewArtifact(),
      selector: "ai_usage",
      aiGatewayLimitAttested: true,
      activatedAt: new Date("2026-07-29T04:00:00.000Z"),
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
      activatedAt: new Date("2026-07-29T04:00:00.000Z"),
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
  const candidateLifecycle = {
    authenticatedReadsGate: "verified",
    candidateRunRef: "baseline",
    rollbackClosureRunRef: "baseline",
    observerDispatchStartedAt: "2026-07-29T04:00:00.000Z",
    observerDispatchCompletedAt: "2026-07-29T04:00:01.000Z",
  } as const;
  const context = <T extends PreviewAcceptanceContext>(value: T): T => value;

  const validContexts = [
    context({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "none",
      reviewedCommit: REVIEWED_COMMIT,
    }),
    context({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "observe",
      reviewedCommit: REVIEWED_COMMIT,
      evidenceFamily: "foundation_probe",
      expectedOutcome: "foundation_succeeded",
      observerClosesAt: "2026-07-29T04:02:00.000Z",
    }),
    context({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "observe",
      reviewedCommit: REVIEWED_COMMIT,
      evidenceFamily: "preview_fault",
      expectedOutcome: "fault_expected",
      observerClosesAt: "2026-07-29T04:02:00.000Z",
      faultScenario: "job_failed",
    }),
    context({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "deploy_foundation",
      reviewedCommit: REVIEWED_COMMIT,
      ...candidateLifecycle,
    }),
    context({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "deploy_sync_suppression",
      reviewedCommit: REVIEWED_COMMIT,
      ...candidateLifecycle,
    }),
    context({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "deploy_fault",
      reviewedCommit: REVIEWED_COMMIT,
      ...candidateLifecycle,
      faultScenario: "job_failed",
    }),
    context({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "deploy_ai",
      reviewedCommit: REVIEWED_COMMIT,
      ...candidateLifecycle,
    }),
    context({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "rollback",
      reviewedCommit: REVIEWED_COMMIT,
      candidateRunRef: "101",
    }),
    context({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "close_rollback",
      reviewedCommit: REVIEWED_COMMIT,
      candidateRunRef: "101",
      rollbackRunRef: "202",
      authenticatedReadsGate: "verified",
    }),
    context({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "verify_cleanup",
      reviewedCommit: REVIEWED_COMMIT,
      candidateRunRef: "101",
      rollbackClosureRunRef: "303",
    }),
  ] as const;

  it.each(validContexts)(
    "round-trips canonical context kind $kind as deeply frozen data",
    (value) => {
      const serialized = serializePreviewAcceptanceContext(value);
      const selection = parsePreviewAcceptanceContext(value.kind, serialized);

      expect(serialized).toBe(JSON.stringify(value));
      expect(Buffer.byteLength(serialized, "ascii")).toBeLessThanOrEqual(2_048);
      expect(selection.operation).toBe(value.kind);
      expect(selection.context).toEqual(value);
      expect(Object.isFrozen(selection)).toBe(true);
      expect(Object.isFrozen(selection.context)).toBe(true);
    },
  );

  it("rebuilds canonical output from reordered semantic context properties", () => {
    const reordered = context({
      observerDispatchCompletedAt: "2026-07-29T04:00:01.000Z",
      candidateRunRef: "baseline",
      kind: "deploy_foundation",
      authenticatedReadsGate: "verified",
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      observerDispatchStartedAt: "2026-07-29T04:00:00.000Z",
      reviewedCommit: REVIEWED_COMMIT,
      rollbackClosureRunRef: "baseline",
    });

    expect(Object.keys(reordered)).not.toEqual(Object.keys(validContexts[3]));
    expect(serializePreviewAcceptanceContext(reordered)).toBe(
      JSON.stringify(validContexts[3]),
    );
  });

  it("admits an explicit zero-width observer dispatch interval", () => {
    const zeroWidth = context({
      ...validContexts[3],
      observerDispatchCompletedAt:
        validContexts[3].observerDispatchStartedAt,
    });
    const serialized = serializePreviewAcceptanceContext(zeroWidth);

    expect(
      parsePreviewAcceptanceContext(zeroWidth.kind, serialized).context,
    ).toEqual(zeroWidth);
  });

  it("rejects unsafe serializer object shapes without invoking accessors", () => {
    let getterInvoked = false;
    const accessor = Object.defineProperty(
      { ...validContexts[0] },
      "reviewedCommit",
      {
        enumerable: true,
        get: () => {
          getterInvoked = true;
          return REVIEWED_COMMIT;
        },
      },
    );
    const nonEnumerableExtra = Object.defineProperty(
      { ...validContexts[0] },
      "extra",
      { value: true },
    );
    const symbolExtra = {
      ...validContexts[0],
      [Symbol("extra")]: true,
    };
    const customPrototype = Object.assign(
      Object.create(null) as Record<string, unknown>,
      validContexts[0],
    );

    for (const unsafe of [
      accessor,
      { ...validContexts[0], extra: true },
      nonEnumerableExtra,
      symbolExtra,
      customPrototype,
    ]) {
      expect(() =>
        serializePreviewAcceptanceContext(
          unsafe as unknown as PreviewAcceptanceContext,
        ),
      ).toThrow(/acceptance workflow selection/i);
    }
    expect(getterInvoked).toBe(false);
  });

  it("admits sync suppression as its own selector", () => {
    const value = validContexts.find(
      (candidate) => candidate.kind === "deploy_sync_suppression",
    )!;
    const selection = parsePreviewAcceptanceContext(
      value.kind,
      serializePreviewAcceptanceContext(value),
    );

    expect(selection).toMatchObject({
      operation: "deploy_sync_suppression",
      selector: "sync_suppression",
    });
  });

  it.each([
    [
      "operation mismatch",
      "deploy_ai",
      JSON.stringify(validContexts[0]),
    ],
    [
      "noncanonical whitespace",
      "none",
      `${JSON.stringify(validContexts[0])} `,
    ],
    [
      "non-ASCII",
      "none",
      `${JSON.stringify(validContexts[0])}\u00a0`,
    ],
    [
      "oversize",
      "none",
      "a".repeat(2_049),
    ],
    [
      "duplicate key",
      "none",
      `{"version":"${PREVIEW_ACCEPTANCE_CONTEXT_VERSION}","kind":"none","reviewedCommit":"${REVIEWED_COMMIT}","kind":"none"}`,
    ],
    [
      "wrong key order",
      "none",
      `{"kind":"none","version":"${PREVIEW_ACCEPTANCE_CONTEXT_VERSION}","reviewedCommit":"${REVIEWED_COMMIT}"}`,
    ],
    [
      "extra key",
      "none",
      `{"version":"${PREVIEW_ACCEPTANCE_CONTEXT_VERSION}","kind":"none","reviewedCommit":"${REVIEWED_COMMIT}","extra":true}`,
    ],
    [
      "uppercase reviewed commit",
      "none",
      JSON.stringify({
        ...validContexts[0],
        reviewedCommit: "A".repeat(40),
      }),
    ],
    [
      "leading-zero lifecycle ref",
      "rollback",
      JSON.stringify({ ...validContexts[7], candidateRunRef: "01" }),
    ],
    [
      "baseline action ref",
      "rollback",
      JSON.stringify({ ...validContexts[7], candidateRunRef: "baseline" }),
    ],
    [
      "noncanonical timestamp",
      "deploy_foundation",
      JSON.stringify({
        ...validContexts[3],
        observerDispatchStartedAt: "2026-07-29T04:00:00Z",
      }),
    ],
    [
      "reversed observer dispatch interval",
      "deploy_foundation",
      JSON.stringify({
        ...validContexts[3],
        observerDispatchStartedAt: "2026-07-29T04:00:02.000Z",
        observerDispatchCompletedAt: "2026-07-29T04:00:01.000Z",
      }),
    ],
    [
      "unsupported future AI field",
      "deploy_ai",
      JSON.stringify({ ...validContexts[6], aiScheduledAt: "pending" }),
    ],
    [
      "mismatched evidence family",
      "observe",
      JSON.stringify({
        ...validContexts[1],
        expectedOutcome: "ai_succeeded",
      }),
    ],
    [
      "fault outcome without scenario",
      "observe",
      JSON.stringify({
        version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
        kind: "observe",
        reviewedCommit: REVIEWED_COMMIT,
        evidenceFamily: "preview_fault",
        expectedOutcome: "fault_expected",
        observerClosesAt: "2026-07-29T04:02:00.000Z",
      }),
    ],
  ] as const)("rejects %s", (_label, operation, serialized) => {
    expect(() =>
      parsePreviewAcceptanceContext(operation as never, serialized),
    ).toThrow(/acceptance workflow selection/i);
  });

  it("atomically admits current-workflow role/restore and maintenance contexts", () => {
    const role = context({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "deploy_role_probe",
      reviewedCommit: REVIEWED_COMMIT,
      ...candidateLifecycle,
    });
    const restore = context({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "deploy_restore",
      reviewedCommit: REVIEWED_COMMIT,
      ...candidateLifecycle,
      restoreAdmissionGate: "verified",
    });
    const maintenance = context({
      version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
      kind: "observe",
      reviewedCommit: REVIEWED_COMMIT,
      evidenceFamily: "calendar_maintenance",
      expectedOutcome: "maintenance_repair_reserved",
      observerClosesAt: "2026-07-30T18:17:00.000Z",
      maintenanceScheduledAt: "2026-07-30T18:15:00.000Z",
    });

    expect(
      parsePreviewAcceptanceContext(
        role.kind,
        serializePreviewAcceptanceContext(role),
      ),
    ).toMatchObject({ operation: "deploy_role_probe", selector: "role_probe" });
    expect(
      parsePreviewAcceptanceContext(
        restore.kind,
        serializePreviewAcceptanceContext(restore),
      ),
    ).toMatchObject({ operation: "deploy_restore", selector: "restore" });
    expect(
      parsePreviewAcceptanceContext(
        maintenance.kind,
        serializePreviewAcceptanceContext(maintenance),
      ).context,
    ).toEqual(maintenance);
  });

  it("rejects restore gates and maintenance timestamps on every other context", () => {
    expect(() =>
      parsePreviewAcceptanceContext(
        "deploy_role_probe" as never,
        JSON.stringify({
          version: PREVIEW_ACCEPTANCE_CONTEXT_VERSION,
          kind: "deploy_role_probe",
          reviewedCommit: REVIEWED_COMMIT,
          ...candidateLifecycle,
          restoreAdmissionGate: "verified",
        }),
      ),
    ).toThrow(/acceptance workflow selection/i);
    expect(() =>
      parsePreviewAcceptanceContext(
        "observe",
        JSON.stringify({
          ...validContexts[1],
          maintenanceScheduledAt: "2026-07-30T18:15:00.000Z",
        }),
      ),
    ).toThrow(/acceptance workflow selection/i);
  });

  it("keeps the exact eleven-value selector vocabulary frozen", () => {
    const selected = ACCEPTANCE_SELECTORS.map((selector) =>
      preparePreviewAcceptanceDeployConfig({
        normalConfig: previewArtifact(),
        selector: selector as PreviewAcceptanceSelector,
        activatedAt: new Date("2026-07-29T04:00:00.000Z"),
        ...(selector === "ai_usage"
          ? { aiGatewayLimitAttested: true as const }
          : {}),
      }),
    );

    expect(selected).toHaveLength(11);
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
  it("selects normal or restore-pair validation only from the exact candidate intent", () => {
    const normal = normalProviderState();
    expect(() =>
      validatePreviewProviderStateForCandidateIntent({
        candidateIntent: {
          evidenceType: "vision.preview-candidate-intent/v1",
          candidateCommit: REVIEWED_COMMIT,
          candidateOperation: "deploy_foundation",
          bindingProfile: "normal",
        },
        expectedCommit: REVIEWED_COMMIT,
        ...normal,
      }),
    ).not.toThrow();

    const restorePair = normalProviderState();
    (
      restorePair.settingsResponse as { result: { bindings: unknown[] } }
    ).result.bindings.push(
      { name: "PREVIEW_RESTORE_DATABASE_URL", type: "secret_text" },
      { name: "PREVIEW_RESTORE_TARGET_ID", type: "secret_text" },
    );
    expect(() =>
      validatePreviewProviderStateForCandidateIntent({
        candidateIntent: {
          evidenceType: "vision.preview-candidate-intent/v1",
          candidateCommit: REVIEWED_COMMIT,
          candidateOperation: "deploy_restore",
          bindingProfile: "restore_pair",
        },
        expectedCommit: REVIEWED_COMMIT,
        ...restorePair,
      }),
    ).not.toThrow();

    for (const candidateIntent of [
      {
        evidenceType: "vision.preview-candidate-intent/v1",
        candidateCommit: REVIEWED_COMMIT,
        candidateOperation: "deploy_restore",
        bindingProfile: "normal",
      },
      {
        evidenceType: "vision.preview-candidate-intent/v1",
        candidateCommit: "b".repeat(40),
        candidateOperation: "deploy_restore",
        bindingProfile: "restore_pair",
      },
    ]) {
      expect(() =>
        validatePreviewProviderStateForCandidateIntent({
          candidateIntent,
          expectedCommit: REVIEWED_COMMIT,
          ...restorePair,
        }),
      ).toThrow();
    }
  });

  it("reuses normal health and permanent-schedule checks for the restore pair", () => {
    const normal = normalProviderState();
    const settings = structuredClone(normal.settingsResponse) as {
      result: { bindings: unknown[] };
    };
    settings.result.bindings.push(
      { name: "PREVIEW_RESTORE_DATABASE_URL", type: "secret_text" },
      { name: "PREVIEW_RESTORE_TARGET_ID", type: "secret_text" },
    );
    for (const override of [
      { healthResponse: { status: "failed" } },
      { schedulesResponse: { success: true, result: [] } },
      { schedulesResponse: { success: true, result: [{ cron: NORMAL_CRONS[0] }] } },
      { schedulesResponse: { success: true, result: [...NORMAL_CRONS.map((cron) => ({ cron })), { cron: "* * * * *" }] } },
    ]) {
      expect(() => validateTemporaryRestorePairProviderState({
        ...normal,
        settingsResponse: settings,
        ...override,
      })).toThrow("Temporary restore-pair provider state is invalid.");
    }
  });
  it("admits only the exact two temporary secret names and types for the restore pair", () => {
    const normal = normalProviderState();
    const settings = structuredClone(normal.settingsResponse) as {
      result: { bindings: unknown[] };
    };
    settings.result.bindings.push(
      { name: "PREVIEW_RESTORE_DATABASE_URL", type: "secret_text" },
      { name: "PREVIEW_RESTORE_TARGET_ID", type: "secret_text" },
    );
    expect(() =>
      validateTemporaryRestorePairProviderState({
        ...normal,
        settingsResponse: settings,
      }),
    ).not.toThrow();

    for (const bindings of [
      settings.result.bindings.slice(0, -1),
      [
        ...settings.result.bindings.slice(0, -2),
        { name: "PREVIEW_RESTORE_DATABASE_URL", type: "plain_text" },
        { name: "PREVIEW_RESTORE_TARGET_ID", type: "secret_text" },
      ],
      [
        ...settings.result.bindings,
        { name: "PREVIEW_RESTORE_TARGET_ID", type: "secret_text" },
      ],
      [...settings.result.bindings, { name: "EXTRA", type: "secret_text" }],
    ]) {
      expect(() =>
        validateTemporaryRestorePairProviderState({
          ...normal,
          settingsResponse: { result: { bindings } },
        }),
      ).toThrow("Temporary restore-pair provider state is invalid.");
    }
  });
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
              ? { ...binding, type: "secret_text" }
              : binding,
        ),
      },
    }],
    ["missing pricing text", {
      success: true,
      result: {
        bindings: structuredClone(NORMAL_PREVIEW_PROVIDER_BINDINGS).map(
          (binding) => {
            if (binding.name !== "AI_INPUT_CENTS_PER_MILLION_TOKENS") {
              return binding;
            }
            const { text: _missing, ...withoutText } = binding;
            return withoutText;
          },
        ),
      },
    }],
    ["stale pricing text", {
      success: true,
      result: {
        bindings: structuredClone(NORMAL_PREVIEW_PROVIDER_BINDINGS).map(
          (binding) =>
            binding.name === "AI_INPUT_CENTS_PER_MILLION_TOKENS"
              ? { ...binding, text: `${binding.text}0` }
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

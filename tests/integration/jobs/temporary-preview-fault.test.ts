import { describe, expect, it, vi } from "vitest";
import type { PreviewAiEvidenceWindow } from "../../../src/domain/operations/temporary-preview-fault";
import type { BackupObjectWriter } from "../../../src/jobs/create-daily-backup";
import {
  TEMPORARY_PREVIEW_FAULT_ACTION,
  TEMPORARY_PREVIEW_FAULT_CRON,
  createTemporaryPreviewFaultEvidence,
  runTemporaryPreviewFault,
  type TemporaryPreviewFaultEntry,
} from "../../../src/jobs/temporary-preview-fault";
import {
  CALENDAR_MAINTENANCE_CRON,
  DAILY_BACKUP_CRON,
  scheduled,
} from "../../../src/jobs/scheduled";
import type { Env } from "../../../src/server/env";

const NOW = new Date("2026-07-28T12:00:00.000Z");
const ACTIVE_UNTIL = "2026-07-28T12:30:00.000Z";
const AI_EVIDENCE_AT = new Date("2026-07-28T12:30:00.000Z");
const AI_EXPIRES_AT = "2026-07-28T12:30:00.001Z";
const CONTROLLER = {
  cron: TEMPORARY_PREVIEW_FAULT_CRON,
  scheduledTime: NOW.getTime(),
  noRetry: vi.fn(),
} as unknown as ScheduledController;

interface InjectedScheduledEntryDependencies {
  readonly currentTime: () => Date;
  readonly maintenance: (now: Date) => Promise<void>;
  readonly recovery: (now: Date) => Promise<void>;
  readonly temporaryRoleProbe: (now: Date) => Promise<void>;
  readonly foundationProbe: (now: Date) => Promise<void>;
  readonly aiUsageEvidence: (
    now: Date,
    window: PreviewAiEvidenceWindow,
  ) => Promise<void>;
  readonly temporaryFaultR2Upload: (
    now: Date,
    writer: BackupObjectWriter,
  ) => Promise<void>;
  readonly writeTemporaryFaultEvidence: (
    entry: TemporaryPreviewFaultEntry,
  ) => void;
}

const scheduledWithDependencies = scheduled as unknown as (
  controller: ScheduledController,
  environment: Env,
  context: ExecutionContext,
  dependencies: InjectedScheduledEntryDependencies,
) => Promise<void>;

const scheduledWithFactory = scheduled as unknown as (
  controller: ScheduledController,
  environment: Env,
  context: ExecutionContext,
  dependencies: InjectedScheduledEntryDependencies | undefined,
  factory: (environment: Env) => InjectedScheduledEntryDependencies,
) => Promise<void>;

function aiEnvironment(): Env {
  return {
    VISION_ENV: "preview",
    PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
    PREVIEW_ACCEPTANCE_EXPIRES_AT: AI_EXPIRES_AT,
    PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT:
      AI_EVIDENCE_AT.toISOString(),
    PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
  } as Env;
}

function scheduledDependencies(): {
  readonly dependencies: InjectedScheduledEntryDependencies;
  readonly writeTemporaryFaultEvidence: ReturnType<typeof vi.fn>;
} {
  const writeTemporaryFaultEvidence = vi.fn();
  return {
    dependencies: {
      currentTime: () => NOW,
      maintenance: vi.fn(async () => undefined),
      recovery: vi.fn(async () => undefined),
      temporaryRoleProbe: vi.fn(async () => undefined),
      foundationProbe: vi.fn(async () => undefined),
      aiUsageEvidence: vi.fn(async () => undefined),
      temporaryFaultR2Upload: vi.fn(async () => undefined),
      writeTemporaryFaultEvidence,
    },
    writeTemporaryFaultEvidence,
  };
}

function expectNoUnrelatedCandidateCalls(
  dependencies: InjectedScheduledEntryDependencies,
): void {
  expect(dependencies.maintenance).not.toHaveBeenCalled();
  expect(dependencies.recovery).not.toHaveBeenCalled();
  expect(dependencies.temporaryRoleProbe).not.toHaveBeenCalled();
  expect(dependencies.foundationProbe).not.toHaveBeenCalled();
  expect(dependencies.aiUsageEvidence).not.toHaveBeenCalled();
}

describe("temporary preview fault evidence", () => {
  it.each([
    ["queue_delayed", "succeeded", "none"],
    ["job_failed", "succeeded", "none"],
    ["channel_expired", "succeeded", "none"],
    ["database_unavailable", "succeeded", "none"],
    ["r2_upload_failed", "failed", "backup_storage_write_failed"],
    ["ai_stopped", "succeeded", "none"],
  ] as const)("creates the exact closed %s terminal record", (scenario, outcome, category) => {
    expect(createTemporaryPreviewFaultEvidence(scenario)).toEqual({
      evidenceType: "vision.preview-fault/v1",
      scenario,
      outcome,
      category,
    });
  });

  it("emits one success record without touching an R2 boundary for every diagnostic-only scenario", async () => {
    for (const scenario of [
      "queue_delayed",
      "job_failed",
      "channel_expired",
      "database_unavailable",
      "ai_stopped",
    ] as const) {
      const runR2Upload = vi.fn();
      const write = vi.fn();

      await runTemporaryPreviewFault(
        { VISION_ENV: "preview", PREVIEW_ACCEPTANCE_SCENARIO: scenario },
        { runR2Upload },
        write,
      );

      expect(runR2Upload).not.toHaveBeenCalled();
      expect(write).toHaveBeenCalledExactlyOnceWith({
        action: TEMPORARY_PREVIEW_FAULT_ACTION,
        evidence: createTemporaryPreviewFaultEvidence(scenario),
      });
    }
  });

  it("injects a failure before the R2 writer mutates and preserves the fixed scheduled failure", async () => {
    const write = vi.fn();
    const runR2Upload = vi.fn(async (writer: BackupObjectWriter) => {
      await writer.putIfAbsent(
        "unused",
        new Uint8Array(),
        {
          format: "vision-backup/v1",
          createdDate: "2026-07-28",
          ciphertextSha256: "a".repeat(43),
          keyVersion: "1",
        },
        "unused",
      );
    });

    await expect(
      runTemporaryPreviewFault(
        { VISION_ENV: "preview", PREVIEW_ACCEPTANCE_SCENARIO: "r2_upload_failed" },
        { runR2Upload },
        write,
      ),
    ).rejects.toThrow("Backup storage write failed.");

    expect(runR2Upload).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledExactlyOnceWith({
      action: TEMPORARY_PREVIEW_FAULT_ACTION,
      evidence: {
        evidenceType: "vision.preview-fault/v1",
        scenario: "r2_upload_failed",
        outcome: "failed",
        category: "backup_storage_write_failed",
      },
    });
    expect(TEMPORARY_PREVIEW_FAULT_CRON).toBe("* * * * *");
  });

  it("does not emit R2 write-failure evidence when the injected writer is ignored", async () => {
    const write = vi.fn();

    await expect(
      runTemporaryPreviewFault(
        { VISION_ENV: "preview", PREVIEW_ACCEPTANCE_SCENARIO: "r2_upload_failed" },
        { runR2Upload: vi.fn(async () => undefined) },
        write,
      ),
    ).rejects.toThrow("Temporary preview R2 fault was not observed.");

    expect(write).not.toHaveBeenCalled();
  });

  it("preserves an upstream R2 prerequisite failure without emitting write-failure evidence", async () => {
    const upstreamFailure = new Error("Backup storage read failed.");
    const write = vi.fn();

    await expect(
      runTemporaryPreviewFault(
        { VISION_ENV: "preview", PREVIEW_ACCEPTANCE_SCENARIO: "r2_upload_failed" },
        {
          runR2Upload: vi.fn(async () => {
            throw upstreamFailure;
          }),
        },
        write,
      ),
    ).rejects.toBe(upstreamFailure);

    expect(write).not.toHaveBeenCalled();
  });
});

describe("temporary preview fault scheduled entry", () => {
  it("dispatches the dedicated foundation candidate without entering any fault or AI boundary", async () => {
    const { dependencies, writeTemporaryFaultEvidence } =
      scheduledDependencies();

    await expect(
      scheduledWithDependencies(
        CONTROLLER,
        {
          VISION_ENV: "preview",
          PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
          PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_UNTIL,
        } as Env,
        {} as ExecutionContext,
        dependencies,
      ),
    ).resolves.toBeUndefined();

    expect(dependencies.foundationProbe).toHaveBeenCalledExactlyOnceWith(NOW);
    expect(dependencies.aiUsageEvidence).not.toHaveBeenCalled();
    expect(dependencies.temporaryFaultR2Upload).not.toHaveBeenCalled();
    expect(writeTemporaryFaultEvidence).not.toHaveBeenCalled();
    expect(dependencies.maintenance).not.toHaveBeenCalled();
    expect(dependencies.recovery).not.toHaveBeenCalled();
    expect(dependencies.temporaryRoleProbe).not.toHaveBeenCalled();
  });

  it("dispatches the dedicated attested AI candidate without entering any fault or foundation boundary", async () => {
    const { dependencies, writeTemporaryFaultEvidence } =
      scheduledDependencies();
    const exactDependencies = {
      ...dependencies,
      currentTime: () => new Date("2026-07-28T12:29:59.999Z"),
    };
    const exactController = {
      ...CONTROLLER,
      scheduledTime: AI_EVIDENCE_AT.getTime(),
    } as ScheduledController;

    await expect(
      scheduledWithDependencies(
        exactController,
        aiEnvironment(),
        {} as ExecutionContext,
        exactDependencies,
      ),
    ).resolves.toBeUndefined();

    expect(exactDependencies.aiUsageEvidence).toHaveBeenCalledExactlyOnceWith(
      AI_EVIDENCE_AT,
      {
        activatedAt: new Date("2026-07-28T12:00:00.001Z"),
        evidenceScheduledAt: AI_EVIDENCE_AT,
        expiresAt: new Date(AI_EXPIRES_AT),
      },
    );
    expect(dependencies.foundationProbe).not.toHaveBeenCalled();
    expect(dependencies.temporaryFaultR2Upload).not.toHaveBeenCalled();
    expect(writeTemporaryFaultEvidence).not.toHaveBeenCalled();
    expect(dependencies.maintenance).not.toHaveBeenCalled();
    expect(dependencies.recovery).not.toHaveBeenCalled();
    expect(dependencies.temporaryRoleProbe).not.toHaveBeenCalled();
  });

  it.each([-60_000, 60_000])(
    "returns for a noneligible AI tick at offset %i before lifetime, dependency construction, or evidence reads",
    async (offset) => {
      const factory = vi.fn(() => {
        throw new Error("Scheduled dependency factory reached.");
      });
      const controller = {
        ...CONTROLLER,
        scheduledTime: AI_EVIDENCE_AT.getTime() + offset,
      } as ScheduledController;

      await expect(
        scheduledWithFactory(
          controller,
          aiEnvironment(),
          {} as ExecutionContext,
          undefined,
          factory,
        ),
      ).resolves.toBeUndefined();

      expect(factory).not.toHaveBeenCalled();
    },
  );

  it("rejects delayed exact-tick delivery at expiry before AI evidence reads", async () => {
    const { dependencies } = scheduledDependencies();
    const delayedDependencies = {
      ...dependencies,
      currentTime: vi.fn(() => new Date(AI_EXPIRES_AT)),
    };

    await expect(
      scheduledWithDependencies(
        {
          ...CONTROLLER,
          scheduledTime: AI_EVIDENCE_AT.getTime(),
        } as ScheduledController,
        aiEnvironment(),
        {} as ExecutionContext,
        delayedDependencies,
      ),
    ).rejects.toThrow("Preview acceptance timing is unavailable.");

    expect(delayedDependencies.currentTime).toHaveBeenCalledOnce();
    expect(delayedDependencies.aiUsageEvidence).not.toHaveBeenCalled();
  });

  it.each([
    [CALENDAR_MAINTENANCE_CRON, "maintenance"],
    [DAILY_BACKUP_CRON, "recovery"],
  ] as const)(
    "keeps the %s permanent path outside AI tick matching",
    async (cron, expected) => {
      for (const scheduledTime of [
        AI_EVIDENCE_AT.getTime(),
        AI_EVIDENCE_AT.getTime() - 60_000,
      ]) {
        const { dependencies } = scheduledDependencies();
        const guardedDependencies = {
          ...dependencies,
          currentTime: () => new Date("2026-07-28T12:29:59.999Z"),
        };

        await expect(
          scheduledWithDependencies(
            { ...CONTROLLER, cron, scheduledTime } as ScheduledController,
            aiEnvironment(),
            {} as ExecutionContext,
            guardedDependencies,
          ),
        ).resolves.toBeUndefined();

        expect(guardedDependencies[expected]).toHaveBeenCalledExactlyOnceWith(
          new Date(scheduledTime),
        );
        expect(guardedDependencies.aiUsageEvidence).not.toHaveBeenCalled();
      }
    },
  );

  it("rejects a malformed AI window on a noneligible minute before dependency construction", async () => {
    const factory = vi.fn(() => {
      throw new Error("Scheduled dependency factory reached.");
    });

    await expect(
      scheduledWithFactory(
        {
          ...CONTROLLER,
          scheduledTime: AI_EVIDENCE_AT.getTime() - 60_000,
        } as ScheduledController,
        {
          ...aiEnvironment(),
          PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT: "malformed",
        } as Env,
        {} as ExecutionContext,
        undefined,
        factory,
      ),
    ).rejects.toThrow("Temporary preview AI evidence window is invalid.");

    expect(factory).not.toHaveBeenCalled();
  });

  it.each([CALENDAR_MAINTENANCE_CRON, DAILY_BACKUP_CRON])(
    "rejects malformed, expired, and protected candidates before %s permanent work",
    async (cron) => {
      const cases = [
        {
          environment: {
            ...aiEnvironment(),
            PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT: "malformed",
          } as Env,
          currentTime: new Date("2026-07-28T12:29:59.999Z"),
          expectedError: "Temporary preview AI evidence window is invalid.",
        },
        {
          environment: aiEnvironment(),
          currentTime: new Date(AI_EXPIRES_AT),
          expectedError: "Preview acceptance timing is unavailable.",
        },
        {
          environment: {
            ...aiEnvironment(),
            PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-28T06:05:00.001Z",
            PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT:
              "2026-07-28T06:05:00.000Z",
          } as Env,
          currentTime: new Date("2026-07-28T06:04:59.999Z"),
          expectedError: "Temporary preview AI evidence window is invalid.",
        },
      ];

      for (const testCase of cases) {
        const { dependencies } = scheduledDependencies();
        const guardedDependencies = {
          ...dependencies,
          currentTime: () => testCase.currentTime,
        };

        await expect(
          scheduledWithDependencies(
            {
              ...CONTROLLER,
              cron,
              scheduledTime: AI_EVIDENCE_AT.getTime(),
            } as ScheduledController,
            testCase.environment,
            {} as ExecutionContext,
            guardedDependencies,
          ),
        ).rejects.toThrow(testCase.expectedError);

        expect(guardedDependencies.maintenance).not.toHaveBeenCalled();
        expect(guardedDependencies.recovery).not.toHaveBeenCalled();
        expect(guardedDependencies.aiUsageEvidence).not.toHaveBeenCalled();
      }
    },
  );

  it("enforces the ten-minute suppression lifetime before a normal schedule", async () => {
    const { dependencies } = scheduledDependencies();
    const maintenanceController = {
      ...CONTROLLER,
      cron: CALENDAR_MAINTENANCE_CRON,
    } as ScheduledController;
    const exactEnvironment = {
      VISION_ENV: "preview",
      PREVIEW_ACCEPTANCE_SCENARIO: "sync_suppression",
      PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-28T12:10:00.000Z",
    } as Env;

    await expect(
      scheduledWithDependencies(
        maintenanceController,
        exactEnvironment,
        {} as ExecutionContext,
        dependencies,
      ),
    ).resolves.toBeUndefined();
    expect(dependencies.maintenance).toHaveBeenCalledExactlyOnceWith(NOW);

    vi.mocked(dependencies.maintenance).mockClear();
    await expect(
      scheduledWithDependencies(
        maintenanceController,
        {
          ...exactEnvironment,
          PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-28T12:10:00.001Z",
        } as Env,
        {} as ExecutionContext,
        dependencies,
      ),
    ).rejects.toThrow("Preview acceptance timing is unavailable.");
    expect(dependencies.maintenance).not.toHaveBeenCalled();
  });

  it.each([
    [
      "AI evidence without attestation",
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_UNTIL,
      },
    ],
    [
      "AI evidence with a non-string attestation",
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_UNTIL,
        PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: true,
      },
    ],
    [
      "foundation with an AI attestation",
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_UNTIL,
        PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
      },
    ],
    [
      "fault with an AI attestation",
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "ai_stopped",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_UNTIL,
        PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
      },
    ],
  ])(
    "rejects %s before any candidate boundary",
    async (_label, environment) => {
      const { dependencies, writeTemporaryFaultEvidence } =
        scheduledDependencies();

      await expect(
        scheduledWithDependencies(
          CONTROLLER,
          environment as Env,
          {} as ExecutionContext,
          dependencies,
        ),
      ).rejects.toThrow(/temporary preview .* is invalid/iu);

      expect(writeTemporaryFaultEvidence).not.toHaveBeenCalled();
      expect(dependencies.temporaryFaultR2Upload).not.toHaveBeenCalled();
      expectNoUnrelatedCandidateCalls(dependencies);
    },
  );

  it("blocks a delayed delivery whose execution occurs after candidate expiry", async () => {
    const { dependencies, writeTemporaryFaultEvidence } =
      scheduledDependencies();
    const delayedDependencies = {
      ...dependencies,
      currentTime: () => new Date("2026-07-28T12:30:00.001Z"),
    };

    await expect(
      scheduledWithDependencies(
        CONTROLLER,
        {
          VISION_ENV: "preview",
          PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
          PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_UNTIL,
        } as Env,
        {} as ExecutionContext,
        delayedDependencies,
      ),
    ).rejects.toThrow("Preview acceptance timing is unavailable.");

    expect(writeTemporaryFaultEvidence).not.toHaveBeenCalled();
    expect(delayedDependencies.foundationProbe).not.toHaveBeenCalled();
    expect(delayedDependencies.aiUsageEvidence).not.toHaveBeenCalled();
    expect(delayedDependencies.temporaryFaultR2Upload).not.toHaveBeenCalled();
    expectNoUnrelatedCandidateCalls(delayedDependencies);
  });

  it.each([
    {
      label: "expired still-deployed",
      scheduledAt: "2026-07-28T06:05:00.000Z",
      currentTime: "2026-07-28T06:05:00.000Z",
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-28T05:00:00.000Z",
      },
      expectedError: "Preview acceptance timing is unavailable.",
    },
    {
      label: "delayed-delivery",
      scheduledAt: "2026-07-28T04:59:59.999Z",
      currentTime: "2026-07-28T05:00:00.001Z",
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-28T05:00:00.000Z",
      },
      expectedError: "Preview acceptance timing is unavailable.",
    },
    {
      label: "protected-window",
      scheduledAt: "2026-07-28T05:34:59.999Z",
      currentTime: "2026-07-28T05:34:59.999Z",
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-28T05:35:00.001Z",
      },
      expectedError: "Preview acceptance timing is unavailable.",
    },
    {
      label: "missing-lifetime-attestation",
      scheduledAt: "2026-07-28T04:00:00.000Z",
      currentTime: "2026-07-28T04:00:00.000Z",
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
      },
      expectedError: "Preview acceptance timing is unavailable.",
    },
    {
      label: "malformed-lifetime-attestation",
      scheduledAt: "2026-07-28T04:00:00.000Z",
      currentTime: "2026-07-28T04:00:00.000Z",
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "malformed",
      },
      expectedError: "Preview acceptance timing is unavailable.",
    },
    {
      label: "orphaned-lifetime-attestation",
      scheduledAt: "2026-07-28T04:00:00.000Z",
      currentTime: "2026-07-28T04:00:00.000Z",
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-28T04:30:00.000Z",
      },
      expectedError: "Temporary preview acceptance candidate is invalid.",
    },
    {
      label: "missing-AI-attestation",
      scheduledAt: "2026-07-28T04:00:00.000Z",
      currentTime: "2026-07-28T04:00:00.000Z",
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-28T04:30:00.000Z",
      },
      expectedError:
        "Temporary preview AI Gateway attestation is invalid.",
    },
    {
      label: "malformed-AI-attestation",
      scheduledAt: "2026-07-28T04:00:00.000Z",
      currentTime: "2026-07-28T04:00:00.000Z",
      environment: {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "ai_usage",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-28T04:30:00.000Z",
        PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: true,
      },
      expectedError:
        "Temporary preview AI Gateway attestation is invalid.",
    },
  ])(
    "rejects a $label candidate before daily recovery",
    async ({ scheduledAt, currentTime, environment, expectedError }) => {
      const { dependencies } = scheduledDependencies();
      const dailyCron = {
        ...CONTROLLER,
        cron: DAILY_BACKUP_CRON,
        scheduledTime: new Date(scheduledAt).getTime(),
      } as ScheduledController;
      const guardedDependencies = {
        ...dependencies,
        currentTime: () => new Date(currentTime),
        recovery: vi.fn(async () => {
          throw new Error("Normal recovery boundary reached.");
        }),
      };

      await expect(
        scheduledWithDependencies(
          dailyCron,
          environment as Env,
          {} as ExecutionContext,
          guardedDependencies,
        ),
      ).rejects.toThrow(expectedError);

      expect(guardedDependencies.recovery).not.toHaveBeenCalled();
      expectNoUnrelatedCandidateCalls(guardedDependencies);
    },
  );

  it.each(["preview", "production"] as const)(
    "preserves normal %s non-candidate daily recovery",
    async (visionEnvironment) => {
      const { dependencies } = scheduledDependencies();
      const dailyCron = {
        ...CONTROLLER,
        cron: DAILY_BACKUP_CRON,
        scheduledTime: new Date("2026-07-28T06:05:00.000Z").getTime(),
      } as ScheduledController;

      await expect(
        scheduledWithDependencies(
          dailyCron,
          { VISION_ENV: visionEnvironment } as Env,
          {} as ExecutionContext,
          dependencies,
        ),
      ).resolves.toBeUndefined();

      expect(dependencies.recovery).toHaveBeenCalledExactlyOnceWith(
        new Date("2026-07-28T06:05:00.000Z"),
      );
      expect(dependencies.maintenance).not.toHaveBeenCalled();
      expect(dependencies.temporaryRoleProbe).not.toHaveBeenCalled();
      expect(dependencies.foundationProbe).not.toHaveBeenCalled();
      expect(dependencies.aiUsageEvidence).not.toHaveBeenCalled();
    },
  );

  it.each([
    "queue_delayed",
    "job_failed",
    "channel_expired",
    "database_unavailable",
    "r2_upload_failed",
    "ai_stopped",
  ] as const)(
    "dispatches only the admitted %s candidate through the real scheduled entry",
    async (scenario) => {
      const { dependencies, writeTemporaryFaultEvidence } =
        scheduledDependencies();
      if (scenario === "r2_upload_failed") {
        vi.mocked(dependencies.temporaryFaultR2Upload).mockImplementationOnce(
          async (_now, writer) => {
            await writer.putIfAbsent(
              "unused",
              new Uint8Array(),
              {
                format: "vision-backup/v1",
                createdDate: "2026-07-28",
                ciphertextSha256: "a".repeat(43),
                keyVersion: "1",
              },
              "unused",
            );
          },
        );
      }

      const result = scheduledWithDependencies(
        CONTROLLER,
        {
          VISION_ENV: "preview",
          PREVIEW_ACCEPTANCE_SCENARIO: scenario,
          PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_UNTIL,
        } as Env,
        {} as ExecutionContext,
        dependencies,
      );

      if (scenario === "r2_upload_failed") {
        await expect(result).rejects.toThrow("Backup storage write failed.");
        expect(dependencies.temporaryFaultR2Upload).toHaveBeenCalledOnce();
        expect(dependencies.temporaryFaultR2Upload).toHaveBeenCalledWith(
          NOW,
          expect.objectContaining({ putIfAbsent: expect.any(Function) }),
        );
      } else {
        await expect(result).resolves.toBeUndefined();
        expect(dependencies.temporaryFaultR2Upload).not.toHaveBeenCalled();
      }
      expect(writeTemporaryFaultEvidence).toHaveBeenCalledExactlyOnceWith({
        action: TEMPORARY_PREVIEW_FAULT_ACTION,
        evidence: createTemporaryPreviewFaultEvidence(scenario),
      });
      expectNoUnrelatedCandidateCalls(dependencies);
    },
  );

  it.each([
    [
      "expired",
      "2026-07-28T12:00:00.000Z",
      "2026-07-28T11:59:59.999Z",
    ],
    [
      "overlong",
      "2026-07-28T12:00:00.000Z",
      "2026-07-28T12:30:00.001Z",
    ],
    [
      "recovery overlap",
      "2026-07-28T05:34:59.999Z",
      "2026-07-28T05:35:00.001Z",
    ],
    ["malformed", "2026-07-28T12:00:00.000Z", "malformed"],
  ])(
    "blocks %s candidate lifetime before any dependency",
    async (_label, scheduledAt, expiresAt) => {
      const { dependencies, writeTemporaryFaultEvidence } =
        scheduledDependencies();
      const controller = {
        ...CONTROLLER,
        scheduledTime: new Date(scheduledAt).getTime(),
      } as ScheduledController;

      await expect(
        scheduledWithDependencies(
          controller,
          {
            VISION_ENV: "preview",
            PREVIEW_ACCEPTANCE_SCENARIO: "foundation_probe",
            PREVIEW_ACCEPTANCE_EXPIRES_AT: expiresAt,
          } as Env,
          {} as ExecutionContext,
          dependencies,
        ),
      ).rejects.toThrow("Preview acceptance timing is unavailable.");

      expect(writeTemporaryFaultEvidence).not.toHaveBeenCalled();
      expect(dependencies.foundationProbe).not.toHaveBeenCalled();
      expect(dependencies.aiUsageEvidence).not.toHaveBeenCalled();
      expect(dependencies.temporaryFaultR2Upload).not.toHaveBeenCalled();
      expectNoUnrelatedCandidateCalls(dependencies);
    },
  );

  it.each([
    ["missing", { VISION_ENV: "preview" }],
    [
      "malformed",
      {
        VISION_ENV: "preview",
        PREVIEW_ACCEPTANCE_SCENARIO: "unknown",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_UNTIL,
      },
    ],
    [
      "production",
      {
        VISION_ENV: "production",
        PREVIEW_ACCEPTANCE_SCENARIO: "job_failed",
        PREVIEW_ACCEPTANCE_EXPIRES_AT: ACTIVE_UNTIL,
      },
    ],
  ])(
    "fails closed for %s fault configuration without entering another candidate",
    async (_label, environment) => {
      const { dependencies, writeTemporaryFaultEvidence } =
        scheduledDependencies();

      await expect(
        scheduledWithDependencies(
          CONTROLLER,
          environment as Env,
          {} as ExecutionContext,
          dependencies,
        ),
      ).rejects.toThrow(
        /temporary preview (?:acceptance selector|candidate|fault scenario) is invalid/iu,
      );

      expect(writeTemporaryFaultEvidence).not.toHaveBeenCalled();
      expect(dependencies.temporaryFaultR2Upload).not.toHaveBeenCalled();
      expectNoUnrelatedCandidateCalls(dependencies);
    },
  );
});

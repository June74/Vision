import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validatePreviewProviderStateForCandidateIntent } from "../../../scripts/validate-preview-deploy-config";
import {
  assertPreviewCandidateMutationBoundary,
  assertPreviewCandidateIntent,
  assertPreviewRollbackClosure,
  assertPreviewRollbackProofChain,
  closePreviewRollback,
  createPreviewCandidateMutationBoundary,
  createPreviewCandidateIntent,
  createPreviewRollbackRestoreProof,
  derivePreviewBindingProfile,
  readLatestPreviewCandidateRunRef,
  readPreviewCandidateBindingProfile,
  readPreviewCandidateIntentDetails,
  readPreviewCandidateIntentVersion,
  readPreviewCandidateMutationState,
  validateCompletedPreviewLifecycleRun,
} from "../../../scripts/validate-preview-rollback-lifecycle";
import { AI_PRICING_BINDING_CONTRACT } from "../../../src/server/ai-pricing-binding-contract";

const COMMIT = "a".repeat(40);
const OTHER_COMMIT = "b".repeat(40);
const CANDIDATE_RUN_REF = "1201";
const NORMAL_CRONS = ["*/15 * * * *", "5 6 * * *"] as const;
const ACCEPTANCE_CRON = "* * * * *";
const NORMAL_PROVIDER_BINDINGS = [
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

function candidateConfig(operation = "deploy_foundation") {
  const selector = operation === "deploy_foundation"
    ? "foundation_probe"
    : operation === "deploy_sync_suppression"
      ? "sync_suppression"
      : operation === "deploy_ai"
        ? "ai_usage"
        : operation === "deploy_fault"
          ? "job_failed"
          : operation === "deploy_role_probe"
            ? "role_probe"
            : "restore";
  return {
    vars: {
      PREVIEW_ACCEPTANCE_SCENARIO: selector,
      PREVIEW_ACCEPTANCE_EXPIRES_AT: operation === "deploy_ai"
        ? "2026-07-30T18:30:00.001Z"
        : "2026-07-30T18:30:00.000Z",
      ...(operation === "deploy_ai"
        ? {
            PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT:
              "2026-07-30T18:30:00.000Z",
            PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true",
          }
        : {}),
    },
  };
}

function candidateIntent(operation = "deploy_foundation") {
  return createPreviewCandidateIntent({
    candidateCommit: COMMIT,
    operation,
    candidateConfig: candidateConfig(operation),
  });
}

function historicalV2AiIntent() {
  return {
    evidenceType: "vision.preview-candidate-intent/v2",
    candidateCommit: COMMIT,
    candidateOperation: "deploy_ai",
    bindingProfile: "normal",
    candidateConfigHash: "c".repeat(64),
    acceptanceBindings: {
      scenario: "ai_usage",
      expiresAt: "2026-07-30T18:30:00.000Z",
      aiGatewayLimitAttested: "true",
    },
  };
}

function aiProviderState(input: {
  readonly expiresAt: string;
  readonly evidenceScheduledAt?: string;
}) {
  return {
    healthResponse: { status: "ok" },
    schedulesResponse: {
      success: true,
      result: [...NORMAL_CRONS, ACCEPTANCE_CRON].map((cron) => ({ cron })),
    },
    settingsResponse: {
      success: true,
      result: {
        bindings: [
          ...structuredClone(NORMAL_PROVIDER_BINDINGS),
          {
            name: "PREVIEW_ACCEPTANCE_EXPIRES_AT",
            type: "plain_text",
            text: input.expiresAt,
          },
          {
            name: "PREVIEW_ACCEPTANCE_SCENARIO",
            type: "plain_text",
            text: "ai_usage",
          },
          ...(input.evidenceScheduledAt === undefined
            ? []
            : [{
                name: "PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT",
                type: "plain_text",
                text: input.evidenceScheduledAt,
              }]),
          {
            name: "PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED",
            type: "plain_text",
            text: "true",
          },
        ],
      },
    },
  };
}

function restoreProof(operation = "deploy_foundation") {
  return createPreviewRollbackRestoreProof({
    candidateIntent: createPreviewCandidateIntent({
      candidateCommit: COMMIT,
      operation,
      candidateConfig: candidateConfig(operation),
    }),
    candidateRunRef: CANDIDATE_RUN_REF,
    restoredCommit: COMMIT,
    restoredAt: "2026-07-29T07:00:00.000Z",
    providerVerifiedAt: "2026-07-29T07:01:00.000Z",
    normalProviderState: "verified",
  });
}

function closureProof(operation = "deploy_foundation") {
  return closePreviewRollback({
    restoreProof: restoreProof(operation),
    candidateRunRef: CANDIDATE_RUN_REF,
    restoredCommit: COMMIT,
    authenticatedReadsGate: "verified",
    closureProviderVerifiedAt: "2026-07-29T07:01:30.000Z",
    closedAt: "2026-07-29T07:02:00.000Z",
  });
}

/** Runs the file-only lifecycle verifier while capturing its fixed output. */
async function runLifecycleCli(arguments_: readonly string[]): Promise<{
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}> {
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      resolve(process.cwd(), "scripts", "validate-preview-rollback-lifecycle.ts"),
      ...arguments_,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const [exitCode] = (await once(child, "close")) as [number | null];
  return { exitCode, stdout, stderr };
}

function proofChain(
  operation = "deploy_foundation",
  {
    candidateRunRef = CANDIDATE_RUN_REF,
    commit = COMMIT,
    restoredAt = "2026-07-29T07:00:00.000Z",
    providerVerifiedAt = "2026-07-29T07:01:00.000Z",
    closureProviderVerifiedAt = "2026-07-29T07:01:30.000Z",
    closedAt = "2026-07-29T07:02:00.000Z",
  }: {
    readonly candidateRunRef?: string;
    readonly commit?: string;
    readonly restoredAt?: string;
    readonly providerVerifiedAt?: string;
    readonly closureProviderVerifiedAt?: string;
    readonly closedAt?: string;
  } = {},
) {
  const intent = createPreviewCandidateIntent({
    candidateCommit: commit,
    operation,
    candidateConfig: candidateConfig(operation),
  });
  const restored = createPreviewRollbackRestoreProof({
    candidateIntent: intent,
    candidateRunRef,
    restoredCommit: commit,
    restoredAt,
    providerVerifiedAt,
    normalProviderState: "verified",
  });
  const closed = closePreviewRollback({
    restoreProof: restored,
    candidateRunRef,
    restoredCommit: commit,
    authenticatedReadsGate: "verified",
    closureProviderVerifiedAt,
    closedAt,
  });
  return { intent, restored, closed };
}

describe("preview rollback lifecycle", () => {
  it("binds the mutation boundary to the exact intent and candidate run", () => {
    const intent = candidateIntent();
    const boundary = createPreviewCandidateMutationBoundary({
      candidateIntent: intent,
      candidateRunRef: CANDIDATE_RUN_REF,
      candidateConfig: candidateConfig(),
    });

    expect(boundary).toEqual({
      evidenceType: "vision.preview-candidate-mutation-boundary/v1",
      candidateIntentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      candidateRunRefHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(() =>
      assertPreviewCandidateMutationBoundary({
        candidateIntent: intent,
        mutationBoundary: boundary,
        candidateRunRef: CANDIDATE_RUN_REF,
        expectedCommit: COMMIT,
        candidateConfig: candidateConfig(),
      }),
    ).not.toThrow();

    for (const invalid of [
      { candidateIntent: candidateIntent("deploy_ai") },
      { candidateRunRef: "1202" },
      { expectedCommit: OTHER_COMMIT },
      { candidateConfig: candidateConfig("deploy_ai") },
      { mutationBoundary: { ...boundary, extra: true } },
    ]) {
      expect(() =>
        assertPreviewCandidateMutationBoundary({
          candidateIntent: intent,
          mutationBoundary: boundary,
          candidateRunRef: CANDIDATE_RUN_REF,
          expectedCommit: COMMIT,
          candidateConfig: candidateConfig(),
          ...invalid,
        }),
      ).toThrow("Preview rollback lifecycle proof is invalid.");
    }
  });

  it("preserves the exact legacy v1 lifecycle without admitting direct restore", () => {
    const legacyIntent = {
      evidenceType: "vision.preview-candidate-intent/v1",
      candidateCommit: COMMIT,
    };
    const legacyRestore = {
      evidenceType: "vision.preview-rollback-restored/v1",
      candidateRunRefHash: restoreProof().candidateRunRefHash,
      restoredCommit: COMMIT,
      normalProviderState: "verified",
      restoredAt: "2026-07-29T07:00:00.000Z",
      providerVerifiedAt: "2026-07-29T07:01:00.000Z",
    };
    const legacyClosure = {
      evidenceType: "vision.preview-rollback-closed/v1",
      candidateRunRefHash: legacyRestore.candidateRunRefHash,
      restoredCommit: COMMIT,
      normalProviderState: "verified",
      authenticatedReads: "verified",
      restoreProofHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      rollbackProviderVerifiedAt: "2026-07-29T07:01:00.000Z",
      closureProviderVerifiedAt: "2026-07-29T07:01:30.000Z",
      closedAt: "2026-07-29T07:02:00.000Z",
    };
    expect(() => assertPreviewCandidateIntent({
      candidateIntent: legacyIntent,
      expectedCommit: COMMIT,
      nextOperation: "deploy_foundation",
    })).not.toThrow();
    expect(() => assertPreviewCandidateIntent({
      candidateIntent: legacyIntent,
      expectedCommit: COMMIT,
      nextOperation: "deploy_restore",
    })).toThrow("Preview rollback lifecycle proof is invalid.");
    const closed = closePreviewRollback({
      restoreProof: legacyRestore,
      candidateRunRef: CANDIDATE_RUN_REF,
      restoredCommit: COMMIT,
      authenticatedReadsGate: "verified",
      closureProviderVerifiedAt: "2026-07-29T07:01:30.000Z",
      closedAt: "2026-07-29T07:02:00.000Z",
    });
    expect(closed).toEqual(legacyClosure);
  });

  it("emits AI-only v3 intent while preserving the exact non-AI v2 shape", () => {
    const nonAi = candidateIntent("deploy_foundation");
    const ai = candidateIntent("deploy_ai");

    expect(nonAi).toEqual({
      evidenceType: "vision.preview-candidate-intent/v2",
      candidateCommit: COMMIT,
      candidateOperation: "deploy_foundation",
      bindingProfile: "normal",
      candidateConfigHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      acceptanceBindings: {
        scenario: "foundation_probe",
        expiresAt: "2026-07-30T18:30:00.000Z",
        aiGatewayLimitAttested: null,
      },
    });
    expect(Object.keys(nonAi)).toEqual([
      "evidenceType",
      "candidateCommit",
      "candidateOperation",
      "bindingProfile",
      "candidateConfigHash",
      "acceptanceBindings",
    ]);
    expect(Object.keys(nonAi.acceptanceBindings)).toEqual([
      "scenario",
      "expiresAt",
      "aiGatewayLimitAttested",
    ]);
    expect(ai).toEqual({
      evidenceType: "vision.preview-candidate-intent/v3",
      candidateCommit: COMMIT,
      candidateOperation: "deploy_ai",
      bindingProfile: "normal",
      candidateConfigHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      acceptanceBindings: {
        scenario: "ai_usage",
        expiresAt: "2026-07-30T18:30:00.001Z",
        evidenceScheduledAt: "2026-07-30T18:30:00.000Z",
        aiGatewayLimitAttested: "true",
      },
    });
    expect(Object.keys(ai)).toEqual([
      "evidenceType",
      "candidateCommit",
      "candidateOperation",
      "bindingProfile",
      "candidateConfigHash",
      "acceptanceBindings",
    ]);
    expect(Object.keys(ai.acceptanceBindings)).toEqual([
      "scenario",
      "expiresAt",
      "evidenceScheduledAt",
      "aiGatewayLimitAttested",
    ]);
    expect(readPreviewCandidateIntentVersion(nonAi)).toBe("v2");
    expect(readPreviewCandidateIntentVersion(ai)).toBe("v3");
  });

  it("keeps exact historical v2 AI intent recoverable and rejects hybrids", () => {
    const historicalV2Ai = historicalV2AiIntent();

    expect(readPreviewCandidateIntentVersion(historicalV2Ai)).toBe("v2");
    expect(
      readPreviewCandidateIntentDetails({
        candidateIntent: historicalV2Ai,
        expectedCommit: COMMIT,
      }),
    ).toMatchObject({
      legacy: false,
      intentVersion: "v2",
      operation: "deploy_ai",
    });
    expect(() =>
      assertPreviewCandidateIntent({
        candidateIntent: {
          ...historicalV2Ai,
          acceptanceBindings: {
            ...historicalV2Ai.acceptanceBindings,
            evidenceScheduledAt: "2026-07-30T18:30:00.000Z",
          },
        },
        expectedCommit: COMMIT,
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
  });

  it("matches historical v2 AI without scheduled binding and v3 with exact stored schedule", () => {
    const historical = historicalV2AiIntent();
    const v3 = candidateIntent("deploy_ai");
    const exactV3 = aiProviderState({
      expiresAt: v3.acceptanceBindings.expiresAt,
      evidenceScheduledAt: v3.acceptanceBindings.evidenceScheduledAt,
    });

    expect(() =>
      validatePreviewProviderStateForCandidateIntent({
        candidateIntent: historical,
        expectedCommit: COMMIT,
        ...aiProviderState({
          expiresAt: historical.acceptanceBindings.expiresAt,
        }),
      }),
    ).not.toThrow();
    expect(() =>
      validatePreviewProviderStateForCandidateIntent({
        candidateIntent: v3,
        expectedCommit: COMMIT,
        ...exactV3,
      }),
    ).not.toThrow();
    for (const settingsResponse of [
      {
        success: true,
        result: {
          bindings: (
            exactV3.settingsResponse.result.bindings as Array<
              Record<string, unknown>
            >
          ).filter((binding) =>
            binding.name !==
              "PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT"
          ),
        },
      },
      {
        success: true,
        result: {
          bindings: exactV3.settingsResponse.result.bindings.map((binding) =>
            binding.name === "PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT"
              ? { ...binding, text: "2026-07-30T18:29:00.000Z" }
              : binding
          ),
        },
      },
    ]) {
      expect(() =>
        validatePreviewProviderStateForCandidateIntent({
          candidateIntent: v3,
          expectedCommit: COMMIT,
          ...exactV3,
          settingsResponse,
        }),
      ).toThrow("Normal preview provider state is invalid.");
    }
  });

  it("preserves the historical v1 AI gateway-attestation provider contract", () => {
    const legacyV1Ai = {
      evidenceType: "vision.preview-candidate-intent/v1",
      candidateCommit: COMMIT,
    };
    const exact = aiProviderState({
      expiresAt: "2026-07-30T18:30:00.000Z",
    });

    expect(() =>
      validatePreviewProviderStateForCandidateIntent({
        candidateIntent: legacyV1Ai,
        expectedCommit: COMMIT,
        ...exact,
      }),
    ).not.toThrow();
    expect(() =>
      validatePreviewProviderStateForCandidateIntent({
        candidateIntent: legacyV1Ai,
        expectedCommit: COMMIT,
        ...exact,
        settingsResponse: {
          success: true,
          result: {
            bindings: exact.settingsResponse.result.bindings.filter((binding) =>
              binding.name !== "PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED"
            ),
          },
        },
      }),
    ).toThrow("Normal preview provider state is invalid.");
  });

  it("rejects missing, invalid, or non-AI scheduled bindings", () => {
    const ai = candidateConfig("deploy_ai");
    const { PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT: _scheduled, ...missing } =
      ai.vars;
    for (const candidateConfigValue of [
      { vars: missing },
      {
        vars: {
          ...ai.vars,
          PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT:
            ai.vars.PREVIEW_ACCEPTANCE_EXPIRES_AT,
        },
      },
      {
        vars: {
          ...candidateConfig("deploy_foundation").vars,
          PREVIEW_ACCEPTANCE_AI_EVIDENCE_SCHEDULED_AT:
            "2026-07-30T18:30:00.000Z",
        },
      },
    ]) {
      expect(() =>
        createPreviewCandidateIntent({
          candidateCommit: COMMIT,
          operation: candidateConfigValue.vars.PREVIEW_ACCEPTANCE_SCENARIO ===
              "ai_usage"
            ? "deploy_ai"
            : "deploy_foundation",
          candidateConfig: candidateConfigValue,
        }),
      ).toThrow("Preview rollback lifecycle proof is invalid.");
    }
  });

  it("keeps mutation, restore, and closure proof generations unchanged for v3", () => {
    const intent = candidateIntent("deploy_ai");
    const boundary = createPreviewCandidateMutationBoundary({
      candidateIntent: intent,
      candidateRunRef: CANDIDATE_RUN_REF,
      candidateConfig: candidateConfig("deploy_ai"),
    });
    expect(
      readPreviewCandidateMutationState({
        candidateIntent: intent,
        artifactsResponse: { total_count: 0, artifacts: [] },
        candidateRunRef: CANDIDATE_RUN_REF,
      }),
    ).toBe("not_started");
    expect(() =>
      assertPreviewCandidateMutationBoundary({
        candidateIntent: intent,
        mutationBoundary: boundary,
        candidateRunRef: CANDIDATE_RUN_REF,
        expectedCommit: COMMIT,
        candidateConfig: candidateConfig("deploy_ai"),
      }),
    ).not.toThrow();
    expect(boundary.evidenceType).toBe(
      "vision.preview-candidate-mutation-boundary/v1",
    );
    expect(restoreProof("deploy_ai").evidenceType).toBe(
      "vision.preview-rollback-restored/v2",
    );
    expect(closureProof("deploy_ai").evidenceType).toBe(
      "vision.preview-rollback-closed/v2",
    );
  });

  it("classifies only zero or one exact mutation-boundary artifact for the candidate run", () => {
    expect(
      readPreviewCandidateMutationState({
        candidateIntent: candidateIntent(),
        artifactsResponse: { total_count: 0, artifacts: [] },
        candidateRunRef: CANDIDATE_RUN_REF,
      }),
    ).toBe("not_started");

    const artifact = {
      name: "vision-preview-candidate-mutation-boundary",
      expired: false,
      workflow_run: { id: Number(CANDIDATE_RUN_REF) },
    };
    expect(
      readPreviewCandidateMutationState({
        candidateIntent: candidateIntent(),
        artifactsResponse: { total_count: 1, artifacts: [artifact] },
        candidateRunRef: CANDIDATE_RUN_REF,
      }),
    ).toBe("may_have_started");

    for (const artifactsResponse of [
      { total_count: 1, artifacts: [] },
      { total_count: 2, artifacts: [artifact, artifact] },
      { total_count: 1, artifacts: [{ ...artifact, expired: true }] },
      { total_count: 1, artifacts: [{ ...artifact, name: "wrong" }] },
      {
        total_count: 1,
        artifacts: [{ ...artifact, workflow_run: { id: 1202 } }],
      },
    ]) {
      expect(() =>
        readPreviewCandidateMutationState({
          candidateIntent: candidateIntent(),
          artifactsResponse,
          candidateRunRef: CANDIDATE_RUN_REF,
        }),
      ).toThrow("Preview rollback lifecycle proof is invalid.");
    }
  });

  it("treats a missing v1-only mutation boundary conservatively", () => {
    const legacyIntent = {
      evidenceType: "vision.preview-candidate-intent/v1",
      candidateCommit: COMMIT,
    };
    expect(
      readPreviewCandidateMutationState({
        candidateIntent: legacyIntent,
        artifactsResponse: { total_count: 0, artifacts: [] },
        candidateRunRef: CANDIDATE_RUN_REF,
      }),
    ).toBe("may_have_started");
    expect(readPreviewCandidateIntentVersion(legacyIntent)).toBe("v1");
    expect(readPreviewCandidateIntentVersion(candidateIntent())).toBe("v2");

    const v2BoundaryArtifact = {
      name: "vision-preview-candidate-mutation-boundary",
      expired: false,
      workflow_run: { id: Number(CANDIDATE_RUN_REF) },
    };
    for (const candidateIntentValue of [
      legacyIntent,
      { ...legacyIntent, candidateOperation: "deploy_foundation" },
    ]) {
      expect(() =>
        readPreviewCandidateMutationState({
          candidateIntent: candidateIntentValue,
          artifactsResponse: {
            total_count: 1,
            artifacts: [v2BoundaryArtifact],
          },
          candidateRunRef: CANDIDATE_RUN_REF,
        }),
      ).toThrow("Preview rollback lifecycle proof is invalid.");
    }
    expect(() =>
      readPreviewCandidateIntentVersion({
        ...legacyIntent,
        candidateOperation: "deploy_foundation",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
  });

  it("admits normal deployment only at baseline or after the exact latest closure", () => {
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: null,
        latestCandidateRunRef: "baseline",
        expectedCommit: COMMIT,
        operation: "none",
      }),
    ).not.toThrow();
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: closureProof(),
        latestCandidateRunRef: CANDIDATE_RUN_REF,
        expectedCommit: OTHER_COMMIT,
        operation: "none",
        candidateIntent: candidateIntent(),
      }),
    ).not.toThrow();
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: null,
        latestCandidateRunRef: CANDIDATE_RUN_REF,
        expectedCommit: COMMIT,
        operation: "none",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: closureProof(),
        latestCandidateRunRef: "1202",
        expectedCommit: COMMIT,
        operation: "none",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
  });

  it.each([
    ["deploy_role_probe", "restore_pair"],
    ["deploy_restore", "restore_pair"],
    ["deploy_foundation", "normal"],
    ["deploy_sync_suppression", "normal"],
    ["deploy_ai", "normal"],
    ["deploy_fault", "normal"],
  ] as const)("derives %s binding profile without accepting caller selection", (operation, profile) => {
    expect(derivePreviewBindingProfile(operation)).toBe(profile);
  });

  it("allows only same-commit role closure to restore and restore closure to cleanup", () => {
    const roleIntent = createPreviewCandidateIntent({
      candidateCommit: COMMIT,
      operation: "deploy_role_probe",
      candidateConfig: candidateConfig("deploy_role_probe"),
    });
    const restoreIntent = createPreviewCandidateIntent({
      candidateCommit: COMMIT,
      operation: "deploy_restore",
      candidateConfig: candidateConfig("deploy_restore"),
    });
    expect(roleIntent).toMatchObject({
      candidateCommit: COMMIT,
      candidateOperation: "deploy_role_probe",
      bindingProfile: "restore_pair",
    });
    expect(restoreIntent).toMatchObject({
      candidateOperation: "deploy_restore",
      bindingProfile: "restore_pair",
    });
    expect(() =>
      assertPreviewCandidateIntent({
        candidateIntent: roleIntent,
        expectedCommit: COMMIT,
        nextOperation: "verify_cleanup",
      }),
    ).not.toThrow();
    expect(() =>
      assertPreviewCandidateIntent({
        candidateIntent: roleIntent,
        expectedCommit: COMMIT,
        nextOperation: "deploy_restore",
      }),
    ).not.toThrow();
    expect(() =>
      assertPreviewCandidateIntent({
        candidateIntent: roleIntent,
        expectedCommit: OTHER_COMMIT,
        nextOperation: "deploy_restore",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
    expect(() =>
      assertPreviewCandidateIntent({
        candidateIntent: restoreIntent,
        expectedCommit: COMMIT,
        nextOperation: "deploy_foundation",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
    expect(() =>
      assertPreviewCandidateIntent({
        candidateIntent: restoreIntent,
        expectedCommit: COMMIT,
        nextOperation: "verify_cleanup",
      }),
    ).not.toThrow();
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: closureProof("deploy_role_probe"),
        latestCandidateRunRef: CANDIDATE_RUN_REF,
        expectedCommit: COMMIT,
        operation: "deploy_restore",
      }),
    ).not.toThrow();
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: closureProof("deploy_role_probe"),
        latestCandidateRunRef: CANDIDATE_RUN_REF,
        expectedCommit: COMMIT,
        operation: "deploy_foundation",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: closureProof("deploy_restore"),
        latestCandidateRunRef: CANDIDATE_RUN_REF,
        expectedCommit: COMMIT,
        operation: "verify_cleanup",
      }),
    ).not.toThrow();
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: closureProof("deploy_restore"),
        latestCandidateRunRef: CANDIDATE_RUN_REF,
        expectedCommit: COMMIT,
        operation: "deploy_role_probe",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
  });
  it("binds candidate intent, restored commit, normal provider proof, post-restore authenticated reads, and closure", () => {
    const intent = createPreviewCandidateIntent({
      candidateCommit: COMMIT,
      operation: "deploy_foundation",
      candidateConfig: candidateConfig(),
    });
    const restored = restoreProof();
    const closed = closureProof();

    expect(intent).toEqual({
      evidenceType: "vision.preview-candidate-intent/v2",
      candidateCommit: COMMIT,
      candidateOperation: "deploy_foundation",
      bindingProfile: "normal",
      candidateConfigHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      acceptanceBindings: {
        scenario: "foundation_probe",
        expiresAt: "2026-07-30T18:30:00.000Z",
        aiGatewayLimitAttested: null,
      },
    });
    expect(() =>
      assertPreviewCandidateIntent({
        candidateIntent: intent,
        expectedCommit: COMMIT,
      }),
    ).not.toThrow();
    expect(() =>
      assertPreviewCandidateIntent({
        candidateIntent: intent,
        expectedCommit: OTHER_COMMIT,
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
    expect(restored).toEqual({
      evidenceType: "vision.preview-rollback-restored/v2",
      candidateRunRefHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      candidateOperation: "deploy_foundation",
      bindingProfile: "normal",
      restoredCommit: COMMIT,
      normalProviderState: "verified",
      restoredAt: "2026-07-29T07:00:00.000Z",
      providerVerifiedAt: "2026-07-29T07:01:00.000Z",
    });
    expect(closed).toEqual({
      evidenceType: "vision.preview-rollback-closed/v2",
      candidateRunRefHash: restored.candidateRunRefHash,
      candidateOperation: "deploy_foundation",
      bindingProfile: "normal",
      restoredCommit: COMMIT,
      normalProviderState: "verified",
      authenticatedReads: "verified",
      restoreProofHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      rollbackProviderVerifiedAt: "2026-07-29T07:01:00.000Z",
      closureProviderVerifiedAt: "2026-07-29T07:01:30.000Z",
      closedAt: "2026-07-29T07:02:00.000Z",
    });
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: closed,
        latestCandidateRunRef: CANDIDATE_RUN_REF,
        expectedCommit: COMMIT,
        operation: "deploy_ai",
      }),
    ).not.toThrow();
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: closed,
        latestCandidateRunRef: CANDIDATE_RUN_REF,
        expectedCommit: COMMIT,
        operation: "verify_cleanup",
      }),
    ).not.toThrow();
    expect(
      readPreviewCandidateBindingProfile({
        candidateIntent: intent,
        expectedCommit: COMMIT,
      }),
    ).toBe("normal");
    expect(
      readPreviewCandidateBindingProfile({
        candidateIntent: createPreviewCandidateIntent({
          candidateCommit: COMMIT,
          operation: "deploy_restore",
          candidateConfig: candidateConfig("deploy_restore"),
        }),
        expectedCommit: COMMIT,
      }),
    ).toBe("restore_pair");
  });

  it("cannot turn a pre-deploy-only assertion into rollback closure", () => {
    expect(() =>
      closePreviewRollback({
        restoreProof: undefined,
        candidateRunRef: CANDIDATE_RUN_REF,
        restoredCommit: COMMIT,
        authenticatedReadsGate: "verified",
        closureProviderVerifiedAt: "2026-07-29T07:01:30.000Z",
        closedAt: "2026-07-29T06:59:00.000Z",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");

    expect(() =>
      closePreviewRollback({
        restoreProof: {
          ...restoreProof(),
          authenticatedReads: "verified",
        },
        candidateRunRef: CANDIDATE_RUN_REF,
        restoredCommit: COMMIT,
        authenticatedReadsGate: "verified",
        closureProviderVerifiedAt: "2026-07-29T07:01:30.000Z",
        closedAt: "2026-07-29T07:02:00.000Z",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");

    expect(() =>
      closePreviewRollback({
        restoreProof: restoreProof(),
        candidateRunRef: CANDIDATE_RUN_REF,
        restoredCommit: COMMIT,
        authenticatedReadsGate: "verified",
        closureProviderVerifiedAt: "2026-07-29T07:01:00.000Z",
        closedAt: "2026-07-29T07:02:00.000Z",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
  });

  it("admits only the proven no-candidate baseline for a first candidate", () => {
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: null,
        latestCandidateRunRef: "baseline",
        expectedCommit: COMMIT,
        operation: "deploy_foundation",
      }),
    ).not.toThrow();
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: null,
        latestCandidateRunRef: "baseline",
        expectedCommit: COMMIT,
        operation: "verify_cleanup",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: null,
        latestCandidateRunRef: CANDIDATE_RUN_REF,
        expectedCommit: COMMIT,
        operation: "deploy_foundation",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: null,
        latestCandidateRunRef: "baseline",
        expectedCommit: COMMIT,
        operation: "deploy_restore",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: closureProof("deploy_foundation"),
        latestCandidateRunRef: CANDIDATE_RUN_REF,
        expectedCommit: COMMIT,
        operation: "deploy_restore",
      }),
    ).toThrow("Preview rollback lifecycle proof is invalid.");
    expect(() =>
      assertPreviewRollbackClosure({
        closureProof: closureProof("deploy_role_probe"),
        latestCandidateRunRef: CANDIDATE_RUN_REF,
        expectedCommit: COMMIT,
        operation: "deploy_restore",
      }),
    ).not.toThrow();
  });

  it.each([
    ["missing closure", undefined, CANDIDATE_RUN_REF, COMMIT],
    ["stale candidate", closureProof(), "1202", COMMIT],
    ["wrong restored commit", closureProof(), CANDIDATE_RUN_REF, OTHER_COMMIT],
    [
      "pre-provider closure",
      { ...closureProof(), closedAt: "2026-07-29T07:00:59.999Z" },
      CANDIDATE_RUN_REF,
      COMMIT,
    ],
    [
      "malformed provider proof",
      { ...closureProof(), normalProviderState: "not_verified" },
      CANDIDATE_RUN_REF,
      COMMIT,
    ],
  ])("blocks later candidate and cleanup paths for %s", (
    _label,
    proof,
    candidateRunRef,
    commit,
  ) => {
    for (const operation of ["deploy_foundation", "verify_cleanup"] as const) {
      expect(() =>
        assertPreviewRollbackClosure({
          closureProof: proof,
          latestCandidateRunRef: candidateRunRef,
          expectedCommit: commit,
          operation,
        }),
      ).toThrow("Preview rollback lifecycle proof is invalid.");
    }
  });

  it("derives only the latest active candidate run reference from provider artifact metadata", () => {
    expect(
      readLatestPreviewCandidateRunRef({
        total_count: 0,
        artifacts: [],
      }),
    ).toBe("baseline");
    expect(
      readLatestPreviewCandidateRunRef({
        total_count: 2,
        artifacts: [
          {
            name: "vision-preview-candidate-intent",
            expired: false,
            created_at: "2026-07-29T07:02:00Z",
            workflow_run: { id: 1202 },
          },
          {
            name: "vision-preview-candidate-intent",
            expired: false,
            created_at: "2026-07-29T07:01:00Z",
            workflow_run: { id: 1201 },
          },
        ],
      }),
    ).toBe("1202");

    for (const invalid of [
      undefined,
      { total_count: 1, artifacts: [] },
      {
        total_count: 1,
        artifacts: [
          {
            name: "wrong-name",
            expired: false,
            created_at: "2026-07-29T07:02:00.000Z",
            workflow_run: { id: 1202 },
          },
        ],
      },
      {
        total_count: 1,
        artifacts: [
          {
            name: "vision-preview-candidate-intent",
            expired: true,
            created_at: "2026-07-29T07:02:00.000Z",
            workflow_run: { id: 1202 },
          },
        ],
      },
    ]) {
      expect(() => readLatestPreviewCandidateRunRef(invalid)).toThrow(
        "Preview rollback lifecycle proof is invalid.",
      );
    }
  });

  it("accepts only a completed successful exact lifecycle job at the restored commit", () => {
    const run = {
      event: "workflow_dispatch",
      status: "completed",
      conclusion: "success",
      head_sha: COMMIT,
      path: ".github/workflows/preview.yml",
      run_started_at: "2026-07-29T07:00:00Z",
      updated_at: "2026-07-29T07:01:30Z",
    };
    const jobs = {
      jobs: [
        {
          name: "Restore immutable normal preview",
          status: "completed",
          conclusion: "success",
        },
      ],
    };

    expect(() =>
      validateCompletedPreviewLifecycleRun({
        run,
        jobs,
        expectedCommit: COMMIT,
        expectedJobName: "Restore immutable normal preview",
      }),
    ).not.toThrow();
    for (const invalid of [
      { run: { ...run, status: "in_progress", conclusion: null }, jobs },
      { run: { ...run, head_sha: OTHER_COMMIT }, jobs },
      {
        run,
        jobs: {
          jobs: [
            {
              name: "Restore immutable normal preview",
              status: "completed",
              conclusion: "failure",
            },
          ],
        },
      },
      {
        run,
        jobs: {
          jobs: [
            ...jobs.jobs,
            {
              name: "Restore immutable normal preview",
              status: "completed",
              conclusion: "success",
            },
          ],
        },
      },
    ]) {
      expect(() =>
        validateCompletedPreviewLifecycleRun({
          ...invalid,
          expectedCommit: COMMIT,
          expectedJobName: "Restore immutable normal preview",
        }),
      ).toThrow("Preview rollback lifecycle proof is invalid.");
    }
  });

  it("requires one exact candidate, restore, and closure proof chain", () => {
    const chain = proofChain();
    const exact = {
      candidateIntent: chain.intent,
      candidateRunRef: CANDIDATE_RUN_REF,
      expectedCommit: COMMIT,
      operation: "deploy_foundation",
      restoreProof: chain.restored,
      closureProof: chain.closed,
    } as const;

    expect(() => assertPreviewRollbackProofChain(exact)).not.toThrow();

    for (const invalid of [
      { operation: "deploy_ai" },
      { expectedCommit: OTHER_COMMIT },
      {
        closureProof: {
          ...chain.closed,
          closureProviderVerifiedAt: "2026-07-29T07:00:30.000Z",
        },
      },
    ]) {
      expect(() =>
        assertPreviewRollbackProofChain({ ...exact, ...invalid }),
      ).toThrow("Preview rollback lifecycle proof is invalid.");
    }
  });

  it("rejects a restore proof substituted from another candidate run", () => {
    const chain = proofChain();
    expect(() => assertPreviewRollbackProofChain({
      candidateIntent: chain.intent,
      candidateRunRef: CANDIDATE_RUN_REF,
      expectedCommit: COMMIT,
      operation: "deploy_foundation",
      restoreProof: proofChain("deploy_foundation", {
        candidateRunRef: "1202",
      }).restored,
      closureProof: chain.closed,
    })).toThrow("Preview rollback lifecycle proof is invalid.");
  });

  it("rejects a restore proof substituted from another operation", () => {
    const chain = proofChain();
    expect(() => assertPreviewRollbackProofChain({
      candidateIntent: chain.intent,
      candidateRunRef: CANDIDATE_RUN_REF,
      expectedCommit: COMMIT,
      operation: "deploy_foundation",
      restoreProof: proofChain("deploy_ai").restored,
      closureProof: chain.closed,
    })).toThrow("Preview rollback lifecycle proof is invalid.");
  });

  it("rejects a restore proof substituted from another commit", () => {
    const chain = proofChain();
    expect(() => assertPreviewRollbackProofChain({
      candidateIntent: chain.intent,
      candidateRunRef: CANDIDATE_RUN_REF,
      expectedCommit: COMMIT,
      operation: "deploy_foundation",
      restoreProof: proofChain("deploy_foundation", {
        commit: OTHER_COMMIT,
      }).restored,
      closureProof: chain.closed,
    })).toThrow("Preview rollback lifecycle proof is invalid.");
  });

  it("rejects a restore proof substituted from an older valid timestamp window", () => {
    const chain = proofChain();
    expect(() => assertPreviewRollbackProofChain({
      candidateIntent: chain.intent,
      candidateRunRef: CANDIDATE_RUN_REF,
      expectedCommit: COMMIT,
      operation: "deploy_foundation",
      restoreProof: proofChain("deploy_foundation", {
        restoredAt: "2026-07-28T07:00:00.000Z",
        providerVerifiedAt: "2026-07-28T07:01:00.000Z",
        closureProviderVerifiedAt: "2026-07-28T07:01:30.000Z",
        closedAt: "2026-07-28T07:02:00.000Z",
      }).restored,
      closureProof: chain.closed,
    })).toThrow("Preview rollback lifecycle proof is invalid.");
  });

  it("rejects a closure whose restore proof hash does not digest its supplied restore proof", () => {
    const chain = proofChain();
    expect(() => assertPreviewRollbackProofChain({
      candidateIntent: chain.intent,
      candidateRunRef: CANDIDATE_RUN_REF,
      expectedCommit: COMMIT,
      operation: "deploy_foundation",
      restoreProof: chain.restored,
      closureProof: {
        ...chain.closed,
        restoreProofHash: "c".repeat(64),
      },
    })).toThrow("Preview rollback lifecycle proof is invalid.");
  });

  it("verifies only the exact file-based closure chain with fixed safe output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "preview-proof-chain-"));
    try {
      const chain = proofChain();
      const candidateIntentPath = join(directory, "candidate-intent.json");
      const restoreProofPath = join(directory, "restore-proof.json");
      const closureProofPath = join(directory, "closure-proof.json");
      const invalidClosureProofPath = join(directory, "invalid-closure-proof.json");
      await Promise.all([
        writeFile(candidateIntentPath, JSON.stringify(chain.intent), "utf8"),
        writeFile(restoreProofPath, JSON.stringify(chain.restored), "utf8"),
        writeFile(closureProofPath, JSON.stringify(chain.closed), "utf8"),
        writeFile(
          invalidClosureProofPath,
          JSON.stringify({ ...chain.closed, restoreProofHash: "c".repeat(64) }),
          "utf8",
        ),
      ]);
      const arguments_ = [
        "--verify-exact-closure-chain",
        "--candidate-intent",
        candidateIntentPath,
        "--candidate-run-ref",
        CANDIDATE_RUN_REF,
        "--commit",
        COMMIT,
        "--operation",
        "deploy_foundation",
        "--restore-proof",
        restoreProofPath,
        "--closure-proof",
        closureProofPath,
      ] as const;

      await expect(runLifecycleCli(arguments_)).resolves.toEqual({
        exitCode: 0,
        stdout: "Preview rollback lifecycle proof is valid.\n",
        stderr: "",
      });
      await expect(
        runLifecycleCli([
          "--read-candidate-operation",
          "--candidate-intent",
          candidateIntentPath,
        ]),
      ).resolves.toEqual({
        exitCode: 0,
        stdout: "deploy_foundation\n",
        stderr: "",
      });
      await expect(
        runLifecycleCli([
          ...arguments_.slice(0, -1),
          invalidClosureProofPath,
        ]),
      ).resolves.toEqual({
        exitCode: 1,
        stdout: "",
        stderr: "Preview rollback lifecycle proof is invalid.\n",
      });
      for (const invalidArguments of [
        arguments_.slice(0, -2),
        [...arguments_, "--unexpected", "value"],
        [...arguments_, "--commit", COMMIT],
        [
          "--read-candidate-operation",
          "--candidate-intent",
          candidateIntentPath,
          "--unexpected",
          "value",
        ],
      ]) {
        await expect(runLifecycleCli(invalidArguments)).resolves.toEqual({
          exitCode: 1,
          stdout: "",
          stderr: "Preview rollback lifecycle proof is invalid.\n",
        });
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

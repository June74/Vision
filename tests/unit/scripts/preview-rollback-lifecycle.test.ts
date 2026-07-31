import { describe, expect, it } from "vitest";
import {
  assertPreviewCandidateMutationBoundary,
  assertPreviewCandidateIntent,
  assertPreviewRollbackClosure,
  closePreviewRollback,
  createPreviewCandidateMutationBoundary,
  createPreviewCandidateIntent,
  createPreviewRollbackRestoreProof,
  derivePreviewBindingProfile,
  readLatestPreviewCandidateRunRef,
  readPreviewCandidateBindingProfile,
  readPreviewCandidateIntentVersion,
  readPreviewCandidateMutationState,
  validateCompletedPreviewLifecycleRun,
} from "../../../scripts/validate-preview-rollback-lifecycle";

const COMMIT = "a".repeat(40);
const OTHER_COMMIT = "b".repeat(40);
const CANDIDATE_RUN_REF = "1201";

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
      PREVIEW_ACCEPTANCE_EXPIRES_AT: "2026-07-30T18:30:00.000Z",
      ...(operation === "deploy_ai"
        ? { PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED: "true" }
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
});

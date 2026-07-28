import { describe, expect, it, vi } from "vitest";
import { PhaseBFoundationProbeSourceError } from "../../../src/data/phase-b-foundation-probe";
import {
  createPhaseBFoundationProbeEvidence,
  emitPhaseBFoundationProbeEvidence,
  runPhaseBFoundationProbe,
  type PhaseBFoundationProbeCategory,
  type PhaseBFoundationProbeMeasurements,
} from "../../../src/jobs/phase-b-foundation-probe";

const OBSERVED_AT = new Date("2026-07-28T20:00:00.000Z");

function measurements(
  override: Partial<PhaseBFoundationProbeMeasurements> = {},
): PhaseBFoundationProbeMeasurements {
  return {
    roleMatches: true,
    schemaMatches: true,
    privilegesMatch: true,
    publicGrantCount: 0,
    identityViolations: 0,
    domainViolations: 0,
    privacyViolations: 0,
    provenanceViolations: 0,
    referenceViolations: 0,
    checkpointViolations: 0,
    protectedStorageMatches: true,
    sentinelStatus: "passed",
    backupContractMatches: true,
    databaseBytes: 1,
    r2ObjectCount: 1,
    r2Bytes: 1,
    ...override,
  };
}

describe("Phase B foundation probe job", () => {
  it("creates the exact all-green evidence record", () => {
    expect(createPhaseBFoundationProbeEvidence(measurements())).toEqual({
      evidenceType: "vision.phase-b-foundation-probe/v1",
      outcome: "succeeded",
      category: "none",
      roleMatches: true,
      schemaMatches: true,
      privilegesMatch: true,
      publicGrantCount: 0,
      identityViolations: 0,
      domainViolations: 0,
      privacyViolations: 0,
      provenanceViolations: 0,
      referenceViolations: 0,
      checkpointViolations: 0,
      protectedStorageMatches: true,
      sentinelStatus: "passed",
      backupContractMatches: true,
      databaseBytes: 1,
      r2ObjectCount: 1,
      r2Bytes: 1,
    });
  });

  it.each([
    ["role_mismatch", { roleMatches: false }],
    ["schema_mismatch", { schemaMatches: false }],
    ["privilege_mismatch", { privilegesMatch: false }],
    ["public_grants_present", { publicGrantCount: 1 }],
    ["identity_violation", { identityViolations: 1 }],
    ["domain_violation", { domainViolations: 1 }],
    ["privacy_violation", { privacyViolations: 1 }],
    ["provenance_violation", { provenanceViolations: 1 }],
    ["reference_violation", { referenceViolations: 1 }],
    ["checkpoint_violation", { checkpointViolations: 1 }],
    ["protected_storage_mismatch", { protectedStorageMatches: false }],
    ["sentinel_failed", { sentinelStatus: "failed" }],
    ["sentinel_failed", { sentinelStatus: "not_tested" }],
    ["backup_contract_mismatch", { backupContractMatches: false }],
  ] satisfies readonly [
    PhaseBFoundationProbeCategory,
    Partial<PhaseBFoundationProbeMeasurements>,
  ][])("selects deterministic category %s", (category, override) => {
    expect(createPhaseBFoundationProbeEvidence(measurements(override))).toMatchObject({
      outcome: "failed",
      category,
    });
  });

  it("uses interface order when multiple semantic checks fail", () => {
    expect(
      createPhaseBFoundationProbeEvidence(
        measurements({
          roleMatches: false,
          schemaMatches: false,
          privilegesMatch: false,
          publicGrantCount: 1,
        }),
      ),
    ).toMatchObject({
      outcome: "failed",
      category: "role_mismatch",
    });
  });

  it.each([
    ["negative", -1],
    ["fractional", 1.5],
    ["unsafe", Number.MAX_SAFE_INTEGER + 1],
  ])("never serializes a %s rejected integer", (_, rejected) => {
    const evidence = createPhaseBFoundationProbeEvidence(
      measurements({ identityViolations: rejected }),
    );

    expect(evidence).toMatchObject({
      outcome: "failed",
      category: "numeric_bound_exceeded",
      identityViolations: 0,
    });
    expect(JSON.stringify(evidence)).not.toContain(String(rejected));
  });

  it("rejects non-preview or non-exact configuration before source access", async () => {
    const read = vi.fn(async () => measurements());

    for (const environment of [
      { VISION_ENV: "production" },
      { VISION_ENV: "preview", extra: true },
      null,
    ]) {
      await expect(
        runPhaseBFoundationProbe(environment, OBSERVED_AT, { read }),
      ).resolves.toMatchObject({
        outcome: "failed",
        category: "configuration_invalid",
      });
    }
    expect(read).not.toHaveBeenCalled();
  });

  it("runs one admitted preview source and returns its deterministic evidence", async () => {
    const read = vi.fn(async () =>
      measurements({ checkpointViolations: 1 }),
    );

    await expect(
      runPhaseBFoundationProbe(
        { VISION_ENV: "preview" },
        OBSERVED_AT,
        { read },
      ),
    ).resolves.toMatchObject({
      outcome: "failed",
      category: "checkpoint_violation",
    });
    expect(read).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledWith(OBSERVED_AT);
  });

  it.each([
    "database_unavailable",
    "r2_unavailable",
    "numeric_bound_exceeded",
  ] as const)("maps the closed source category %s without provider detail", async (category) => {
    const read = vi.fn(async () => {
      throw new PhaseBFoundationProbeSourceError(category);
    });

    const evidence = await runPhaseBFoundationProbe(
      { VISION_ENV: "preview" },
      OBSERVED_AT,
      { read },
    );

    expect(evidence).toMatchObject({ outcome: "failed", category });
    expect(JSON.stringify(evidence)).not.toContain("Error");
  });

  it("maps unknown thrown detail to a closed database category and never logs it", async () => {
    const privateDetail = "private provider detail";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const evidence = await runPhaseBFoundationProbe(
      { VISION_ENV: "preview" },
      OBSERVED_AT,
      {
        read: async () => {
          throw new Error(privateDetail);
        },
      },
    );

    expect(evidence).toMatchObject({
      outcome: "failed",
      category: "database_unavailable",
    });
    expect(JSON.stringify(evidence)).not.toContain(privateDetail);
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    info.mockRestore();
    error.mockRestore();
  });

  it("emits only the fixed action and already-closed evidence", () => {
    const write = vi.fn();
    const evidence = createPhaseBFoundationProbeEvidence(measurements());

    emitPhaseBFoundationProbeEvidence(evidence, write);

    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith({
      action: "acceptance.phase-b-foundation",
      evidence,
    });
  });
});

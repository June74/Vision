import { describe, expect, it } from "vitest";
import {
  CategoryDecisionSchema,
  CategoryEvaluationPolicySchema,
  CategoryProposalSchema,
  applyCategoryProposal,
} from "../../../src/domain/categorization/proposal";

const policy = { evaluatedConfidenceThreshold: 0.8 };

const highConfidencePersonal = {
  domain: "personal" as const,
  confidence: 0.91,
  evidenceIds: ["event:title:1"],
  ambiguous: false,
  rationaleCode: "personal_context" as const,
  audit: {
    modelId: "category-model",
    requestId: "request-1",
    policyVersion: "category-v1",
  },
};

describe("applyCategoryProposal", () => {
  it("does not override an explicit user category", () => {
    const explicitWork = {
      domain: "work" as const,
      state: "confirmed" as const,
      basis: "explicit" as const,
    };

    expect(applyCategoryProposal(explicitWork, highConfidencePersonal, policy)).toEqual(explicitWork);
  });

  it("does not override a confirmed source association", () => {
    const confirmedSchool = {
      domain: "school" as const,
      state: "confirmed" as const,
      basis: "confirmed_source" as const,
    };

    expect(applyCategoryProposal(confirmedSchool, highConfidencePersonal, policy)).toEqual(confirmedSchool);
  });

  it("keeps an ambiguous proposal unresolved", () => {
    const unresolved = { domain: "unresolved" as const, state: "unresolved" as const, basis: "none" as const };

    expect(
      applyCategoryProposal(
        unresolved,
        {
          domain: "school",
          confidence: 0.91,
          evidenceIds: ["event:title:1"],
          ambiguous: true,
          rationaleCode: "mixed_context",
        },
        policy,
      ),
    ).toEqual(unresolved);
  });

  it.each(["mixed_context", "insufficient_evidence"] as const)(
    "keeps %s proposals unresolved even at high confidence",
    (rationaleCode) => {
      const unresolved = { domain: "unresolved" as const, state: "unresolved" as const, basis: "none" as const };
      const evidenceIds =
        rationaleCode === "mixed_context"
          ? ["event:title:1", "source:calendar:2"]
          : ["event:title:1"];

      expect(
        applyCategoryProposal(
          unresolved,
          {
            domain: "school",
            confidence: 0.99,
            evidenceIds,
            ambiguous: true,
            rationaleCode,
          },
          policy,
        ),
      ).toEqual(unresolved);
    },
  );

  it.each([
    ["personal", "work_context"],
    ["personal", "school_context"],
    ["work", "personal_context"],
    ["work", "school_context"],
    ["school", "personal_context"],
    ["school", "work_context"],
  ] as const)("fails closed for contradictory %s/%s proposals", (domain, rationaleCode) => {
    const unresolved = { domain: "unresolved" as const, state: "unresolved" as const, basis: "none" as const };

    expect(
      applyCategoryProposal(
        unresolved,
        {
          domain,
          confidence: 0.99,
          evidenceIds: ["event:title:1"],
          ambiguous: false,
          rationaleCode,
        },
        policy,
      ),
    ).toEqual(unresolved);
  });

  it("keeps confidence exactly at the evaluated threshold unresolved", () => {
    const unresolved = { domain: "unresolved" as const, state: "unresolved" as const, basis: "none" as const };

    expect(
      applyCategoryProposal(
        unresolved,
        { ...highConfidencePersonal, confidence: policy.evaluatedConfidenceThreshold },
        policy,
      ),
    ).toEqual(unresolved);
  });

  it("keeps confidence below the evaluated threshold unresolved", () => {
    const unresolved = { domain: "unresolved" as const, state: "unresolved" as const, basis: "none" as const };

    expect(
      applyCategoryProposal(unresolved, { ...highConfidencePersonal, confidence: 0.79 }, policy),
    ).toEqual(unresolved);
  });

  it("accepts a non-ambiguous proposal strictly above the evaluated threshold", () => {
    const unresolved = { domain: "unresolved" as const, state: "unresolved" as const, basis: "none" as const };

    expect(applyCategoryProposal(unresolved, highConfidencePersonal, policy)).toEqual({
      domain: "personal",
      state: "inferred",
      basis: "inference",
      confidence: 0.91,
      evidenceIds: ["event:title:1"],
      rationaleCode: "personal_context",
      audit: {
        modelId: "category-model",
        requestId: "request-1",
        policyVersion: "category-v1",
      },
    });
  });

  it("replaces weaker inference only when a new proposal passes policy", () => {
    const current = {
      domain: "school" as const,
      state: "inferred" as const,
      basis: "inference" as const,
      confidence: 0.82,
      evidenceIds: ["event:title:old"],
      rationaleCode: "school_context" as const,
    };

    expect(applyCategoryProposal(current, highConfidencePersonal, policy)).toMatchObject({
      domain: "personal",
      state: "inferred",
      confidence: 0.91,
    });
  });
});

describe("category proposal policy and decision schemas", () => {
  it("requires a finite threshold strictly between zero and one", () => {
    expect(CategoryEvaluationPolicySchema.safeParse({ evaluatedConfidenceThreshold: Number.NaN }).success).toBe(false);
    expect(CategoryEvaluationPolicySchema.safeParse({ evaluatedConfidenceThreshold: 0 }).success).toBe(false);
    expect(CategoryEvaluationPolicySchema.safeParse({ evaluatedConfidenceThreshold: 1 }).success).toBe(false);
  });

  it("requires non-empty bounded unique evidence identifiers", () => {
    expect(CategoryProposalSchema.safeParse({ ...highConfidencePersonal, evidenceIds: [] }).success).toBe(false);
    expect(
      CategoryProposalSchema.safeParse({
        ...highConfidencePersonal,
        evidenceIds: ["event:title:1", "event:title:1"],
      }).success,
    ).toBe(false);
    expect(
      CategoryProposalSchema.safeParse({
        ...highConfidencePersonal,
        evidenceIds: ["x".repeat(129)],
      }).success,
    ).toBe(false);
  });

  it("does not retain free-form model reasoning", () => {
    expect(
      CategoryProposalSchema.safeParse({
        ...highConfidencePersonal,
        reasoning: "private chain of thought",
      }).success,
    ).toBe(false);
  });

  it.each([
    ["personal", "personal_context"],
    ["work", "work_context"],
    ["school", "school_context"],
    ["personal", "source_association"],
    ["work", "source_association"],
    ["school", "source_association"],
    ["personal", "schedule_pattern"],
    ["work", "schedule_pattern"],
    ["school", "schedule_pattern"],
  ] as const)("accepts the allowed non-ambiguous %s/%s combination", (domain, rationaleCode) => {
    const evidenceIds =
      rationaleCode === "source_association"
        ? ["source:calendar:1"]
        : rationaleCode === "schedule_pattern"
          ? ["schedule:weekday:1"]
          : ["event:title:1"];

    expect(
      CategoryProposalSchema.safeParse({
        domain,
        confidence: 0.9,
        evidenceIds,
        ambiguous: false,
        rationaleCode,
      }).success,
    ).toBe(true);
  });

  it.each(["mixed_context", "insufficient_evidence"] as const)(
    "requires ambiguous=true for %s",
    (rationaleCode) => {
      expect(
        CategoryProposalSchema.safeParse({
          domain: "work",
          confidence: 0.9,
          evidenceIds:
            rationaleCode === "mixed_context"
              ? ["event:title:1", "source:calendar:1"]
              : ["event:title:1"],
          ambiguous: false,
          rationaleCode,
        }).success,
      ).toBe(false);
    },
  );

  it("requires at least two evidence facts for mixed context", () => {
    expect(
      CategoryProposalSchema.safeParse({
        domain: "work",
        confidence: 0.9,
        evidenceIds: ["event:title:1"],
        ambiguous: true,
        rationaleCode: "mixed_context",
      }).success,
    ).toBe(false);
  });

  it.each([
    ["source_association", ["event:title:1"]],
    ["schedule_pattern", ["event:title:1"]],
  ] as const)("requires rationale-specific evidence for %s", (rationaleCode, evidenceIds) => {
    expect(
      CategoryProposalSchema.safeParse({
        domain: "work",
        confidence: 0.9,
        evidenceIds,
        ambiguous: false,
        rationaleCode,
      }).success,
    ).toBe(false);
  });

  it("validates inferred decision audit metadata without requiring it", () => {
    expect(
      CategoryDecisionSchema.safeParse({
        domain: "work",
        state: "inferred",
        basis: "inference",
        confidence: 0.9,
        evidenceIds: ["source:work"],
        rationaleCode: "source_association",
      }).success,
    ).toBe(true);
  });

  it.each([
    new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("prototype trap");
        },
      },
    ),
    new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("own keys trap");
        },
      },
    ),
    Object.defineProperty(
      {
        confidence: 0.9,
        evidenceIds: ["event:title:1"],
        ambiguous: false,
        rationaleCode: "work_context",
      },
      "domain",
      {
        enumerable: true,
        get() {
          throw new Error("getter trap");
        },
      },
    ),
  ])("returns a safe parse failure for accessor or proxy traps", (hostile) => {
    expect(() => CategoryProposalSchema.safeParse(hostile)).not.toThrow();
    expect(CategoryProposalSchema.safeParse(hostile).success).toBe(false);
  });
});

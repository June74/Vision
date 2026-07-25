/** Defines provider-neutral, non-authoritative category proposals and deterministic acceptance policy. */
import { z } from "zod";

const ConcreteDomainSchema = z.enum(["personal", "work", "school"]);
const OpaqueIdentifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, "Expected a bounded opaque identifier.")
  .refine(
    (identifier) =>
      !/^(?:action|admin|delete|grant|ignore|permission|privacy|public|share|tool)(?:[._:/-]|$)/i.test(
        identifier,
      ),
    "Authority-bearing text is not an evidence identifier.",
  );

const EvidenceIdsSchema = z
  .array(OpaqueIdentifierSchema)
  .min(1)
  .max(16)
  .refine((ids) => new Set(ids).size === ids.length, "Evidence identifiers must be unique.");

/** Enumerates auditable, non-free-form reasons a category may be proposed. */
export const CategoryRationaleCodeSchema = z.enum([
  "personal_context",
  "work_context",
  "school_context",
  "source_association",
  "schedule_pattern",
  "mixed_context",
  "insufficient_evidence",
]);

/** Carries trusted adapter metadata for audit without retaining model reasoning. */
export const CategoryProposalAuditSchema = z
  .object({
    modelId: OpaqueIdentifierSchema,
    requestId: OpaqueIdentifierSchema,
    policyVersion: OpaqueIdentifierSchema,
  })
  .strict();

const CategoryProposalCoreObjectSchema = z
  .object({
    domain: ConcreteDomainSchema,
    confidence: z.number().finite().min(0).max(1),
    evidenceIds: EvidenceIdsSchema,
    ambiguous: z.boolean(),
    rationaleCode: CategoryRationaleCodeSchema,
  })
  .strict();

type CategoryProposalCore = z.infer<typeof CategoryProposalCoreObjectSchema>;

/**
 * Adds semantic issues that cannot be represented by independent field schemas.
 */
function validateProposalSemantics(proposal: CategoryProposalCore, context: z.RefinementCtx): void {
  if (
    (proposal.rationaleCode === "mixed_context" ||
      proposal.rationaleCode === "insufficient_evidence") &&
    !proposal.ambiguous
  ) {
    context.addIssue({
      code: "custom",
      path: ["ambiguous"],
      message: `${proposal.rationaleCode} requires an ambiguous proposal.`,
    });
  }

  const requiredDomain =
    proposal.rationaleCode === "personal_context"
      ? "personal"
      : proposal.rationaleCode === "work_context"
        ? "work"
        : proposal.rationaleCode === "school_context"
          ? "school"
          : undefined;
  if (requiredDomain !== undefined && proposal.domain !== requiredDomain) {
    context.addIssue({
      code: "custom",
      path: ["domain"],
      message: `${proposal.rationaleCode} requires the ${requiredDomain} domain.`,
    });
  }

  if (
    proposal.rationaleCode === "source_association" &&
    !proposal.evidenceIds.some((identifier) => identifier.startsWith("source:"))
  ) {
    context.addIssue({
      code: "custom",
      path: ["evidenceIds"],
      message: "Source association requires a source evidence identifier.",
    });
  }

  if (
    proposal.rationaleCode === "schedule_pattern" &&
    !proposal.evidenceIds.some((identifier) => identifier.startsWith("schedule:"))
  ) {
    context.addIssue({
      code: "custom",
      path: ["evidenceIds"],
      message: "Schedule pattern requires a schedule evidence identifier.",
    });
  }

  if (proposal.rationaleCode === "mixed_context" && proposal.evidenceIds.length < 2) {
    context.addIssue({
      code: "custom",
      path: ["evidenceIds"],
      message: "Mixed context requires at least two distinct evidence identifiers.",
    });
  }
}

/**
 * Validates the untrusted proposal facts that a model may return.
 *
 * Audit metadata is structurally absent so generated JSON Schema cannot expose
 * adapter-owned facts to a model.
 */
export const UntrustedCategoryProposalSchema =
  CategoryProposalCoreObjectSchema.superRefine(validateProposalSemantics);

const TrustedCategoryProposalObjectSchema = CategoryProposalCoreObjectSchema.extend({
  audit: CategoryProposalAuditSchema.optional(),
}).superRefine(validateProposalSemantics);

const INVALID_JSON_DATA = Symbol("invalid-json-data");

/**
 * Copies JSON-like data without invoking accessors and catches hostile proxy traps.
 */
function normalizeJsonData(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): unknown | typeof INVALID_JSON_DATA {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value !== "object" || depth > 8) {
    return INVALID_JSON_DATA;
  }

  try {
    if (seen.has(value)) {
      return INVALID_JSON_DATA;
    }
    seen.add(value);

    const prototype = Object.getPrototypeOf(value);
    const isArray = Array.isArray(value);
    if (
      (isArray && prototype !== Array.prototype && prototype !== null) ||
      (!isArray && prototype !== Object.prototype && prototype !== null)
    ) {
      return INVALID_JSON_DATA;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const symbolKeys = Object.getOwnPropertySymbols(value);
    if (symbolKeys.length > 0) {
      return INVALID_JSON_DATA;
    }

    if (isArray) {
      const lengthDescriptor = descriptors.length;
      if (
        lengthDescriptor === undefined ||
        "get" in lengthDescriptor ||
        typeof lengthDescriptor.value !== "number" ||
        lengthDescriptor.value > 64
      ) {
        return INVALID_JSON_DATA;
      }

      const result: unknown[] = [];
      for (let index = 0; index < lengthDescriptor.value; index += 1) {
        const descriptor = descriptors[String(index)];
        if (descriptor === undefined || "get" in descriptor || "set" in descriptor) {
          return INVALID_JSON_DATA;
        }
        const normalized = normalizeJsonData(descriptor.value, seen, depth + 1);
        if (normalized === INVALID_JSON_DATA) {
          return INVALID_JSON_DATA;
        }
        result.push(normalized);
      }
      if (
        Object.keys(descriptors).some(
          (key) => key !== "length" && !/^(?:0|[1-9][0-9]*)$/.test(key),
        )
      ) {
        return INVALID_JSON_DATA;
      }
      return result;
    }

    const names = Object.keys(descriptors);
    if (
      names.length > 32 ||
      names.some(
        (name) => name === "__proto__" || name === "prototype" || name === "constructor",
      )
    ) {
      return INVALID_JSON_DATA;
    }

    const result = Object.create(null) as Record<string, unknown>;
    for (const name of names) {
      const descriptor = descriptors[name];
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        "get" in descriptor ||
        "set" in descriptor
      ) {
        return INVALID_JSON_DATA;
      }
      const normalized = normalizeJsonData(descriptor.value, seen, depth + 1);
      if (normalized === INVALID_JSON_DATA) {
        return INVALID_JSON_DATA;
      }
      Object.defineProperty(result, name, {
        configurable: true,
        enumerable: true,
        value: normalized,
        writable: true,
      });
    }
    return result;
  } catch {
    return INVALID_JSON_DATA;
  } finally {
    try {
      seen.delete(value);
    } catch {
      // A hostile proxy cannot escape validation through cleanup.
    }
  }
}

/**
 * Normalizes a public proposal input without invoking getters or leaking proxy errors.
 */
export const SafeCategoryProposalInputSchema = z.unknown().transform((value, context) => {
  const normalized = normalizeJsonData(value, new WeakSet(), 0);
  if (normalized === INVALID_JSON_DATA) {
    context.addIssue({
      code: "custom",
      message: "Expected plain JSON category proposal data.",
    });
    return z.NEVER;
  }
  return normalized;
});

/**
 * Validates the complete trusted provider proposal boundary.
 *
 * Safe normalization prevents inherited, accessor, proxy, or extra
 * authority-bearing fields from entering deterministic domain logic.
 */
export const CategoryProposalSchema = SafeCategoryProposalInputSchema.pipe(
  TrustedCategoryProposalObjectSchema,
);

/** Validates the caller-owned policy used to evaluate untrusted confidence. */
export const CategoryEvaluationPolicySchema = z
  .object({
    evaluatedConfidenceThreshold: z.number().finite().gt(0).lt(1),
  })
  .strict();

const ConfirmedCategoryDecisionSchema = z.discriminatedUnion("basis", [
  z
    .object({
      domain: ConcreteDomainSchema,
      state: z.literal("confirmed"),
      basis: z.literal("explicit"),
    })
    .strict(),
  z
    .object({
      domain: ConcreteDomainSchema,
      state: z.literal("confirmed"),
      basis: z.literal("confirmed_source"),
    })
    .strict(),
]);

const InferredCategoryDecisionSchema = z
  .object({
    domain: ConcreteDomainSchema,
    state: z.literal("inferred"),
    basis: z.literal("inference"),
    confidence: z.number().finite().min(0).max(1),
    evidenceIds: EvidenceIdsSchema,
    rationaleCode: z.enum([
      "personal_context",
      "work_context",
      "school_context",
      "source_association",
      "schedule_pattern",
    ]),
    audit: CategoryProposalAuditSchema.optional(),
  })
  .strict()
  .superRefine((decision, context) => {
    validateProposalSemantics({ ...decision, ambiguous: false }, context);
  });

const UnresolvedCategoryDecisionSchema = z
  .object({
    domain: z.literal("unresolved"),
    state: z.literal("unresolved"),
    basis: z.literal("none"),
  })
  .strict();

/** Validates a category decision with explicit authority provenance. */
export const CategoryDecisionSchema = z.union([
  ConfirmedCategoryDecisionSchema,
  InferredCategoryDecisionSchema,
  UnresolvedCategoryDecisionSchema,
]);

/** A provider-neutral, untrusted category suggestion. */
export type CategoryProposal = z.infer<typeof CategoryProposalSchema>;

/** A deterministic category decision safe for later persistence. */
export type CategoryDecision = z.infer<typeof CategoryDecisionSchema>;

/** Caller-owned confidence acceptance policy. */
export type CategoryEvaluationPolicy = z.infer<typeof CategoryEvaluationPolicySchema>;

/**
 * Applies an untrusted proposal without overriding stronger category authority.
 *
 * Confidence is accepted only when it is strictly above the explicitly supplied
 * evaluated threshold. Ambiguous or weaker proposals remain unresolved.
 */
export function applyCategoryProposal(
  current: CategoryDecision,
  proposal: CategoryProposal,
  policy: CategoryEvaluationPolicy,
): CategoryDecision {
  const parsedCurrent = CategoryDecisionSchema.parse(current);
  const parsedPolicy = CategoryEvaluationPolicySchema.parse(policy);
  const proposalResult = CategoryProposalSchema.safeParse(proposal);

  if (parsedCurrent.basis === "explicit" || parsedCurrent.basis === "confirmed_source") {
    return parsedCurrent;
  }

  if (!proposalResult.success) {
    return { domain: "unresolved", state: "unresolved", basis: "none" };
  }
  const parsedProposal = proposalResult.data;

  if (
    parsedProposal.ambiguous ||
    parsedProposal.rationaleCode === "mixed_context" ||
    parsedProposal.rationaleCode === "insufficient_evidence" ||
    parsedProposal.confidence <= parsedPolicy.evaluatedConfidenceThreshold
  ) {
    return { domain: "unresolved", state: "unresolved", basis: "none" };
  }

  return {
    domain: parsedProposal.domain,
    state: "inferred",
    basis: "inference",
    confidence: parsedProposal.confidence,
    evidenceIds: parsedProposal.evidenceIds,
    rationaleCode: parsedProposal.rationaleCode,
    ...(parsedProposal.audit ? { audit: parsedProposal.audit } : {}),
  };
}

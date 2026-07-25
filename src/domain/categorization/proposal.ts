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

const CategoryProposalObjectSchema = z
  .object({
    domain: ConcreteDomainSchema,
    confidence: z.number().finite().min(0).max(1),
    evidenceIds: EvidenceIdsSchema,
    ambiguous: z.boolean(),
    rationaleCode: CategoryRationaleCodeSchema,
    audit: CategoryProposalAuditSchema.optional(),
  })
  .strict();

const PlainCategoryRecordSchema = z.custom<Record<string, unknown>>(
  (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }

    const names = Object.getOwnPropertyNames(value);
    return !names.some((name) => name === "__proto__" || name === "prototype" || name === "constructor");
  },
  { message: "Expected a plain category proposal record." },
);

/**
 * Validates the complete category proposal boundary.
 *
 * The plain-record gate and strict object shape prevent inherited or extra
 * authority-bearing fields from entering deterministic domain logic.
 */
export const CategoryProposalSchema = PlainCategoryRecordSchema.pipe(CategoryProposalObjectSchema);

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
    rationaleCode: CategoryRationaleCodeSchema,
    audit: CategoryProposalAuditSchema.optional(),
  })
  .strict();

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
  const parsedProposal = CategoryProposalSchema.parse(proposal);
  const parsedPolicy = CategoryEvaluationPolicySchema.parse(policy);

  if (parsedCurrent.basis === "explicit" || parsedCurrent.basis === "confirmed_source") {
    return parsedCurrent;
  }

  if (
    parsedProposal.ambiguous ||
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

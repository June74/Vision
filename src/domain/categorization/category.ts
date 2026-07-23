/** Defines deterministic internal-domain categorization with no authority to change privacy. */
import { z } from "zod";

/** Accepts Vision's internal categories and the intentional unresolved state. */
export const DomainSchema = z.enum(["school", "work", "personal", "unresolved"]);

/** Records whether a category was confirmed, inferred, or deliberately left unresolved. */
export const DomainStateSchema = z.enum(["confirmed", "inferred", "unresolved"]);

/** Validates a model suggestion without accepting unrelated authority-bearing fields. */
export const DomainInferenceSchema = z
  .object({
    domain: z.enum(["school", "work", "personal"]),
    confidence: z.number().min(0).max(1),
  })
  .strict();

/** Describes the inputs that may influence a category decision in their documented order. */
export const DomainResolutionInputSchema = z
  .object({
    explicit: z.enum(["school", "work", "personal"]).optional(),
    confirmedSource: z.enum(["school", "work", "personal"]).optional(),
    inference: DomainInferenceSchema.optional(),
  })
  .strict();

/** Captures the provenance of a resolved category decision. */
export const DomainDecisionSchema = z.discriminatedUnion("basis", [
  z.object({ domain: z.enum(["school", "work", "personal"]), state: z.literal("confirmed"), basis: z.literal("explicit") }).strict(),
  z.object({ domain: z.enum(["school", "work", "personal"]), state: z.literal("confirmed"), basis: z.literal("confirmed_source") }).strict(),
  z
    .object({
      domain: z.enum(["school", "work", "personal"]),
      state: z.literal("inferred"),
      basis: z.literal("inference"),
      confidence: z.number().min(0).max(1),
    })
    .strict(),
  z.object({ domain: z.literal("unresolved"), state: z.literal("unresolved"), basis: z.literal("none") }).strict(),
]);

/** A category that can be stored on a canonical node. */
export type Domain = z.infer<typeof DomainSchema>;

/** Confidence state for a stored category. */
export type DomainState = z.infer<typeof DomainStateSchema>;

/** A validated model-supported category suggestion. */
export type DomainInference = z.infer<typeof DomainInferenceSchema>;

/** Inputs considered by deterministic category resolution. */
export type DomainResolutionInput = z.infer<typeof DomainResolutionInputSchema>;

/** A category decision and the evidence tier that produced it. */
export type DomainDecision = z.infer<typeof DomainDecisionSchema>;

/** Returns whether a domain value and confidence state form a canonical category assignment. */
export function isValidDomainStateCombination(domain: Domain, state: DomainState): boolean {
  return domain === "unresolved" ? state === "unresolved" : state === "confirmed" || state === "inferred";
}

/** Resolves a domain using explicit choice, confirmed source, inference, then unresolved precedence. */
export function resolveDomain(input: DomainResolutionInput): DomainDecision {
  const parsed = DomainResolutionInputSchema.parse(input);

  if (parsed.explicit) {
    return { domain: parsed.explicit, state: "confirmed", basis: "explicit" };
  }

  if (parsed.confirmedSource) {
    return { domain: parsed.confirmedSource, state: "confirmed", basis: "confirmed_source" };
  }

  if (parsed.inference) {
    return {
      domain: parsed.inference.domain,
      state: "inferred",
      basis: "inference",
      confidence: parsed.inference.confidence,
    };
  }

  return { domain: "unresolved", state: "unresolved", basis: "none" };
}

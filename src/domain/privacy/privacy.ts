/** Defines Vision's closed privacy levels and the non-delegable inference boundary. */
import { z } from "zod";

/** Accepts the only privacy levels that can be stored in Vision's canonical graph. */
export const PrivacyLevelSchema = z.enum(["planning", "private", "restricted"]);

/** Identifies the source proposing a privacy value. */
export const PrivacyBasisSchema = z.enum(["explicit", "confirmed_source", "inference"]);

/** Describes a privacy proposal before the pure policy resolves it. */
export const PrivacyResolutionInputSchema = z
  .object({
    current: PrivacyLevelSchema,
    proposed: PrivacyLevelSchema.optional(),
    basis: PrivacyBasisSchema,
  })
  .strict();

/** Represents the privacy level that policy permits together with its sharing decision. */
export const PrivacyDecisionSchema = z
  .object({
    level: PrivacyLevelSchema,
    sharingAuthorized: z.literal(false),
  })
  .strict();

/** A closed privacy value stored on a graph object. */
export type PrivacyLevel = z.infer<typeof PrivacyLevelSchema>;

/** The origin of a proposed privacy value. */
export type PrivacyBasis = z.infer<typeof PrivacyBasisSchema>;

/** Input accepted by the privacy resolver. */
export type PrivacyResolutionInput = z.infer<typeof PrivacyResolutionInputSchema>;

/** Privacy result safe for downstream policy evaluation. */
export type PrivacyDecision = z.infer<typeof PrivacyDecisionSchema>;

const privacyRanks: Record<PrivacyLevel, number> = {
  planning: 0,
  private: 1,
  restricted: 2,
};

/** Returns whether a proposed value keeps at least the current level of privacy protection. */
export function doesNotReducePrivacy(current: PrivacyLevel, proposed: PrivacyLevel): boolean {
  return privacyRanks[proposed] >= privacyRanks[current];
}

/** Resolves a privacy proposal without allowing an inference to reduce protection or grant sharing. */
export function resolvePrivacy(input: PrivacyResolutionInput): PrivacyDecision {
  const parsed = PrivacyResolutionInputSchema.parse(input);
  const proposed = parsed.proposed ?? parsed.current;

  if (parsed.basis === "inference" && !doesNotReducePrivacy(parsed.current, proposed)) {
    // Model output may make a record more protective, but it cannot make it less protected.
    return { level: parsed.current, sharingAuthorized: false };
  }

  // Categorization and privacy resolution are not an authority grant; sharing needs a separate approval path.
  return { level: proposed, sharingAuthorized: false };
}

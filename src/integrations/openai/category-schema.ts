/** Defines the strict untrusted structured-output shape accepted from OpenAI categorization. */
import { CategoryProposalSchema } from "../../domain/categorization/proposal";

/**
 * Validates only model-supplied proposal facts.
 *
 * Adapter-owned model, request, and policy metadata must be attached after this
 * boundary so a model cannot impersonate trusted audit facts.
 */
export const OpenAiCategoryOutputSchema = CategoryProposalSchema.refine(
  (proposal) => proposal.audit === undefined,
  "Model output cannot supply trusted audit metadata.",
);

/** An OpenAI category response after strict structural validation. */
export type OpenAiCategoryOutput = typeof OpenAiCategoryOutputSchema._output;

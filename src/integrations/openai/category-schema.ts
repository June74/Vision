/** Defines the strict untrusted structured-output shape accepted from OpenAI categorization. */
import {
  SafeCategoryProposalInputSchema,
  UntrustedCategoryProposalSchema,
} from "../../domain/categorization/proposal";

/**
 * Validates only model-supplied proposal facts.
 *
 * Adapter-owned model, request, and policy metadata must be attached after this
 * boundary so a model cannot impersonate trusted audit facts.
 */
export const OpenAiCategoryOutputSchema = UntrustedCategoryProposalSchema;

const SafeOpenAiCategoryOutputSchema = SafeCategoryProposalInputSchema.pipe(
  OpenAiCategoryOutputSchema,
);

/** Parses a model output without allowing getter or proxy exceptions to escape. */
export function safeParseOpenAiCategoryOutput(input: unknown) {
  return SafeOpenAiCategoryOutputSchema.safeParse(input);
}

/** An OpenAI category response after strict structural validation. */
export type OpenAiCategoryOutput = typeof OpenAiCategoryOutputSchema._output;

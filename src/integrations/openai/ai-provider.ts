/** Defines the provider-neutral AI category proposal port without network or persistence authority. */
import type { CategoryProposal } from "../../domain/categorization/proposal";

/** Contains only the caller-approved, provider-neutral context for one category request. */
export interface CategoryProposalRequest {
  readonly subjectId: string;
  readonly evidenceIds: readonly string[];
  readonly policyVersion: string;
  readonly context: Readonly<Record<string, unknown>>;
}

/** Allows a replaceable AI adapter to return an untrusted category proposal. */
export interface AiProvider {
  proposeCategory(request: CategoryProposalRequest): Promise<CategoryProposal>;
}

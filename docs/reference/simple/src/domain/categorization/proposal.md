# `src/domain/categorization/proposal.ts`

This module treats AI category output as a suggestion, never as authority. A user category wins, then a confirmed source category. Only a clear proposal strictly above the caller's evaluated confidence threshold may become an inferred category.

## `CategoryProposalSchema`

Accepts only personal, work, or school plus bounded confidence, opaque evidence IDs, an ambiguity flag, and a closed rationale code. It rejects extra fields and does not store free-form model reasoning.

## `CategoryEvaluationPolicySchema`

Requires the application to supply and validate the confidence threshold explicitly.

## `CategoryDecisionSchema`

Records whether a decision came from the user, a confirmed source, inference, or no sufficient evidence.

## `applyCategoryProposal`

Preserves explicit and confirmed-source decisions. Ambiguous proposals and confidence at or below the configured threshold remain unresolved.

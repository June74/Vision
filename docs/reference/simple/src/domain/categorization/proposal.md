# `src/domain/categorization/proposal.ts`

This module treats AI category output as a suggestion, never as authority. A user category wins, then a confirmed source category. Only a clear proposal strictly above the caller's evaluated confidence threshold may become an inferred category.

## `CategoryProposalSchema`

Accepts only personal, work, or school plus bounded confidence, opaque evidence IDs, an ambiguity flag, and a closed rationale code. Domain-specific reasons must match their domain; mixed or insufficient evidence must be marked ambiguous. Source and schedule reasons require matching evidence identifiers. It rejects extra fields and does not store free-form model reasoning.

## `validateProposalSemantics`

Checks that a proposal's domain, rationale, ambiguity, and evidence agree with each other.

## `normalizeJsonData`

Safely copies plain JSON-like proposal data without invoking getters. Invalid objects and trapped proxy operations are rejected.

## `CategoryEvaluationPolicySchema`

Requires the application to supply and validate the confidence threshold explicitly.

## `CategoryDecisionSchema`

Records whether a decision came from the user, a confirmed source, inference, or no sufficient evidence.

## `applyCategoryProposal`

Preserves explicit and confirmed-source decisions. Invalid or contradictory input, mixed or insufficient evidence, ambiguity, and confidence at or below the configured threshold remain unresolved.

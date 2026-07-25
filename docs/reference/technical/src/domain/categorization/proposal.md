# `src/domain/categorization/proposal.ts`

This pure module is the deterministic trust boundary between untrusted AI output and category decisions. It has no provider, persistence, privacy, sharing, deletion, permission, or external-action surface.

## `CategoryProposalSchema`

The schema first rejects non-plain or prototype-bearing objects, then applies a strict closed Zod object. Domains are limited to `personal`, `work`, and `school`; confidence must be finite and between zero and one; evidence contains one to sixteen unique opaque identifiers of at most 128 characters; rationale uses a closed enum. Optional audit metadata is bounded and contains no free-form reasoning.

## `CategoryEvaluationPolicySchema`

The caller must supply `evaluatedConfidenceThreshold` as a finite number strictly between zero and one. There is no hidden global threshold.

## `CategoryDecisionSchema`

The union preserves authority provenance:

- `explicit` and `confirmed_source` are confirmed.
- `inference` retains confidence, evidence IDs, rationale code, and trusted adapter audit metadata.
- `none` is unresolved.

## `applyCategoryProposal`

**Signature:** `applyCategoryProposal(current, proposal, policy): CategoryDecision`

All inputs are parsed at runtime. Explicit user and confirmed-source decisions return unchanged. A proposal is inferred only when it is non-ambiguous and its confidence is strictly greater than the evaluated threshold; exact-boundary and weaker values return unresolved. The function performs no side effects.

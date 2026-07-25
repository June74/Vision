# `src/domain/categorization/proposal.ts`

This pure module is the deterministic trust boundary between untrusted AI output and category decisions. It has no provider, persistence, privacy, sharing, deletion, permission, or external-action surface.

## `CategoryProposalSchema`

The public schema first normalizes JSON-like data without invoking accessors, then applies a strict closed Zod object. Domains are limited to `personal`, `work`, and `school`; confidence must be finite and between zero and one; evidence contains one to sixteen unique opaque identifiers of at most 128 characters; rationale uses a closed enum. Optional trusted audit metadata is bounded and contains no free-form reasoning.

The structurally separate `UntrustedCategoryProposalSchema` has no audit field. This lets provider structured-output JSON Schema advertise only the five model-controlled proposal fields.

## `validateProposalSemantics`

**Signature:** `validateProposalSemantics(proposal, context): void`

The shared refinement requires `personal_context`, `work_context`, and `school_context` to agree with the domain. `mixed_context` and `insufficient_evidence` require ambiguity; mixed context requires two distinct evidence identifiers. `source_association` requires `source:` evidence and `schedule_pattern` requires `schedule:` evidence.

## `normalizeJsonData`

**Signature:** `normalizeJsonData(value, seen, depth): unknown`

This internal copier accepts bounded JSON-like primitives, arrays, and plain records. It inspects property descriptors instead of reading values, rejects accessors, symbols, cycles, excessive depth/width, special prototype keys, and non-plain prototypes, and catches proxy traps around prototype, key, and descriptor inspection.

## `CategoryEvaluationPolicySchema`

The caller must supply `evaluatedConfidenceThreshold` as a finite number strictly between zero and one. There is no hidden global threshold.

## `CategoryDecisionSchema`

The union preserves authority provenance:

- `explicit` and `confirmed_source` are confirmed.
- `inference` retains confidence, evidence IDs, rationale code, and trusted adapter audit metadata.
- `none` is unresolved.

## `applyCategoryProposal`

**Signature:** `applyCategoryProposal(current, proposal, policy): CategoryDecision`

All inputs are parsed at runtime. Explicit user and confirmed-source decisions return unchanged. Invalid and contradictory proposals fail closed. A proposal is inferred only when it is non-ambiguous, has an inferable rationale, and its confidence is strictly greater than the evaluated threshold; mixed, insufficient, exact-boundary, and weaker values return unresolved. The function performs no side effects.

# `src/integrations/openai/ai-provider.ts`

This module defines the provider-neutral dependency-inversion port for categorization.

## `CategoryProposalRequest`

The request contains only caller-approved provider-neutral values: an opaque subject identifier, evidence identifiers, policy version, and immutable context record. Task-specific adapters are responsible for constructing the minimum context.

## `AiProvider`

**Signature:** `proposeCategory(request: CategoryProposalRequest): Promise<CategoryProposal>`

The port exposes no credentials, persistence, tools, event writes, privacy mutation, or authorization methods. Returned proposals must still pass deterministic policy.

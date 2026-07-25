# `src/server/api/ai-category-proposal-routes.ts`

This module exposes one authenticated AI category-proposal boundary. It validates the server session and CSRF token before streaming at most 32 KiB, prevents callers from choosing request class, and defers the allowlisted context builder until the durable budget reservation succeeds.

## `registerAiCategoryProposalRoute`

Registers `POST /api/ai/category-proposals` before the generic API fallback. Only a validated proposal is returned; accounting and provider metadata remain internal.

## `createProductionAiCategoryProposalDependencies`

Builds the encrypted session authority, least-privileged AI repository, canonical Cloudflare Gateway OpenAI adapter, exact injected pricing, and owner-bound budget wrapper from validated Worker bindings.

## `createBudgetedProvider`

Creates a routine-capable `BudgetedAiProvider` bound to the authenticated owner and durable repository.

## `buildCategoryRequest`

Uses `buildCategoryContext` to copy a bounded minimum-context packet, then derives subject, evidence, and policy fields from that accepted packet.

## `requestFactory`

Invokes the allowlisted context builder only inside the budget wrapper after reservation admission.

## `now`

Provides fresh timestamps for active-session lookup, reservation expiry, and cost settlement.

## `createReservationId`

Generates a UUID used only as the opaque durable reservation identity.

## `authenticateAiRequest`

Resolves the opaque cookie through the encrypted session repository before any body processing or AI construction.

## `requireAiCsrf`

Compares the supplied header to the decrypted session token through the shared constant-work digest verifier.

## `readBoundedJson`

Rejects non-JSON and oversized declared bodies, streams with an independent 32 KiB cap, decodes strict UTF-8, and rejects malformed JSON.

## `resolveRouteDependencies`

Collapses configuration or production dependency failures into one privacy-safe availability response.

## `throwBudgetedUnavailable`

Returns the exact hard-stop code at 950 cents, preserves duplicate semantics, and hides accounting/concurrency details behind stable safe messages.

## `invalidAiCategoryRequest`

Builds the constant 400 error for malformed, oversized, or non-allowlisted input.

## `aiCategoryUnavailable`

Builds the constant 503 response for provider, configuration, or unclassified accounting failure.

# `src/server/api/ai-category-proposal-routes.ts`

This module exposes one authenticated AI category-proposal boundary. It validates the server session and CSRF token before streaming at most 32 KiB, accepts only an opaque event reference and idempotency key, and defers protected event access until the durable budget reservation succeeds.

## `registerAiCategoryProposalRoute`

Registers `POST /api/ai/category-proposals` before the generic API fallback. Only a validated proposal is returned; accounting and provider metadata remain internal.

## `createProductionAiCategoryProposalDependencies`

Builds the encrypted session authority, least-privileged AI repository, canonical Cloudflare Gateway OpenAI adapter, exact injected pricing, and an owner-bound protected-event loader from validated Worker bindings.

## `createBudgetedProvider`

Creates a routine-capable `BudgetedAiProvider` bound to the authenticated owner and durable repository.

## `createContextLoader`

Creates the protected repository capability for the authenticated owner only inside the admitted request factory.

## `load`

Looks up the opaque event reference through the owner-scoped encrypted repository and returns only the server-policy-minimized category request.

## `requestFactory`

Invokes the owner-bound loader only inside the budget wrapper after reservation admission, so budget or concurrency denial performs no event lookup or decryption.

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

## `aiEventNotAvailable`

Builds the constant 404 response shared by missing, cross-owner, restricted, and cancelled references so callers cannot probe protected-event existence.

## `aiCategoryUnavailable`

Builds the constant 503 response for provider, configuration, or unclassified accounting failure.

# `scripts/configure-ai-gateway-budget.ts`

Provides the one-shot preview operator boundary for the Cloudflare AI Gateway
spend limit. It validates protected environment credentials, requires the
existing `vision-preview` gateway, sends only `spend_limits`, and verifies the
returned configuration before emitting evidence.

The exact rule is one enabled, unscoped cost budget: $9.50 over a fixed
2,592,000-second window. The absence of metadata, model, and provider
dimensions makes the bucket global.

## `isRecord`

Narrows untrusted Cloudflare JSON to a non-null, non-array record.

## `hasExactSpendLimit`

Requires one enabled cost rule with the approved limit, fixed window, and no
metadata, model, or provider dimension.

## `createBudgetEvidence`

Returns the immutable allowlisted evidence object shared by the read-only and
write-then-verify success paths.

## `classifyAiGatewayBudgetError`

Maps only the command's own fixed configuration, authorization, not-found,
lookup, update, and verification errors to allowlisted categories. Unknown
thrown values remain `unknown_failure`.

## `configureAiGatewayBudget`

Performs the authenticated list and detail lookup. If the detail already
matches the exact global rule, it succeeds without write access; otherwise it
performs the partial update and applies the same strict verification.

## `main`

Maps every configuration, network, parsing, or verification failure to one
generic error and never writes provider-controlled response content.

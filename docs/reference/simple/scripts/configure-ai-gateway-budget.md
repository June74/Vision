# configure-ai-gateway-budget

Applies Vision's approved preview AI budget directly to the existing
Cloudflare AI Gateway. The rule is global, fixed, $9.50, and 30 days. The
command prints only whether that exact rule was returned.

## `isRecord`

Checks that an API value is an object before reading it.

## `classifyAiGatewayBudgetError`

Maps a failure to one safe stage name without copying Cloudflare's response.

## `configureAiGatewayBudget`

Finds the existing preview gateway, applies the exact cost rule, and fails
unless Cloudflare returns the same global rule.

## `main`

Reads provider credentials only from the protected environment and prints one
safe result or one generic failure.

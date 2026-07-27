# configure-ai-gateway-budget

Applies Vision's approved preview AI budget directly to the existing
Cloudflare AI Gateway. The rule is global, fixed, $9.50, and 30 days. The
command prints only whether that exact rule was returned.

## `isRecord`

Checks that an API value is an object before reading it.

## `hasExactSpendLimit`

Checks that the gateway has exactly Vision's one enabled, global $9.50 rule.

## `createBudgetEvidence`

Builds the fixed safe result returned after either read-only verification or a
successful update.

## `classifyAiGatewayBudgetError`

Maps a failure to one safe stage name, including authorization and not-found
lookup results, without copying Cloudflare's response.

## `configureAiGatewayBudget`

Finds the existing preview gateway and reads its current settings. It returns
success without an update when the exact rule already exists; otherwise it
applies the rule and verifies Cloudflare's returned settings.

## `main`

Reads provider credentials only from the protected environment and prints one
safe result or one generic failure.

# AI category proposal route

The single Phase B AI endpoint requires a live session and CSRF token, reads a small strict request, and reserves the monthly budget before building or sending AI context.

## `registerAiCategoryProposalRoute`

Registers the authenticated category proposal POST route.

## `createProductionAiCategoryProposalDependencies`

Connects sessions, AI accounting, approved context copying, and the OpenAI Gateway adapter.

## `createBudgetedProvider`

Creates an owner-bound budget wrapper.

## `buildCategoryRequest`

Copies only explicitly permitted event facts into an AI request.

## `requestFactory`

Defers permitted context copying until budget admission.

## `now`

Reads current time for session and accounting decisions.

## `createReservationId`

Generates an opaque AI reservation ID.

## `authenticateAiRequest`

Requires an active server session before reading request content.

## `requireAiCsrf`

Protects the state-changing POST route.

## `readBoundedJson`

Streams strict JSON within a fixed byte limit.

## `resolveRouteDependencies`

Hides configuration failures.

## `throwBudgetedUnavailable`

Maps budget admission outcomes to safe errors.

## `invalidAiCategoryRequest`

Returns the safe input error.

## `aiCategoryUnavailable`

Returns the safe availability error.

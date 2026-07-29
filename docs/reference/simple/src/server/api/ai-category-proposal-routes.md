# AI category proposal route

The single Phase B AI endpoint requires a live session and CSRF token, accepts only an opaque event reference, and reserves the monthly budget before loading, decrypting, or sending AI context.

## `registerAiCategoryProposalRoute`

Registers the authenticated category proposal POST route. It validates the
complete candidate selector and AI attestation, but only the strict
`ai_stopped` fault activates the synthetic hard stop.

## `createProductionAiCategoryProposalDependencies`

Connects sessions, AI accounting, the owner-bound trusted event loader, and the OpenAI Gateway adapter.

## `createBudgetedProvider`

Creates an owner-bound budget wrapper.

## `createContextLoader`

Creates an owner-bound event loader only after budget admission.

## `load`

Loads the referenced event through the protected repository and applies the server disclosure policy.

## `requestFactory`

Defers event loading, decryption, and permitted context copying until budget admission.

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

## `aiEventNotAvailable`

Returns one indistinguishable safe error for missing, cross-owner, restricted, or cancelled events.

## `aiCategoryUnavailable`

Returns the safe availability error.

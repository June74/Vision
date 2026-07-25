# `src/domain/budget/ai-budget.ts`

This pure module owns the private-pilot thresholds: warning and Luna-only at 800 cents, optional stop at 900, and hard stop at 950. Complex/Terra eligibility exists only below 800. Invalid amounts and request classes fail closed. Month keys use a fixed `Intl.DateTimeFormat` for America/Chicago rather than process-local timezone state.

## `evaluateAiBudget`

Accepts safe non-negative integer cents and a closed request class. Returns an admission, model mode, warning state, Terra eligibility, and optional safe code without side effects.

## `getChicagoBudgetMonth`

Uses calendar parts rendered in America/Chicago, preserving correct month rollover across standard and daylight offsets.

## `evaluateFoundationCapability`

Makes the isolation contract explicit: event listing, sync status, category correction, and template diagnostics remain available; only the AI proposal delegates to the hard budget decision.

## `blocked`

Constructs the immutable blocked shape used for invalid input and threshold failures.

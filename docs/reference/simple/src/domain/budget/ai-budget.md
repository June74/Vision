# `src/domain/budget/ai-budget.ts`

This module applies Vision's exact personal AI limits and keeps calendar functions available when AI stops.

## `evaluateAiBudget`

Allows normal AI below 800 cents, Luna-only work from 800 cents, stops optional work at 900 cents, and stops every new AI request at 950 cents.

## `getChicagoBudgetMonth`

Maps an instant to its `YYYY-MM` accounting month in America/Chicago.

## `evaluateFoundationCapability`

Returns HTTP 200 availability for non-AI foundation functions even when AI is exhausted.

## `blocked`

Builds the common fail-closed budget decision.

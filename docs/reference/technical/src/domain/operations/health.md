# `src/domain/operations/health.ts`

This pure module applies the approved precedence `Disconnected` → `Action required` → `Delayed` → `Healthy` while retaining all applicable allowlisted warnings. Freshness is evaluated against one caller-supplied observation instant.

## `calculateFoundationHealth`

**Signature:** `calculateFoundationHealth(facts: FoundationHealthFacts, now: Date): FoundationHealth`

Validates every input, derives sync and oldest-job ages, applies the 20-minute sync window, 15-minute queue window, and 24-hour channel-renewal window, then classifies exact AI cent thresholds. AI tier never disables or degrades deterministic calendar health by itself.

## `classifyAiSpend`

Returns `normal` through 799 cents, `warning` from 800, `optional_stopped` from 900, and `stopped` from 950.

## `validateFoundationHealthFacts`

Requires finite non-future sync/job timestamps, a finite channel expiry, closed authorization/checkpoint values, nonnegative safe-integer counts and cents, and boolean availability flags. Invalid facts fail closed instead of producing false health.

## `validDate`

Local timestamp predicate used for nullable sync/job facts. It intentionally rejects future values because negative delay would mask bad monitoring state.

## Covering tests

`tests/unit/domain/health.test.ts` covers precedence, exact freshness edges, channel state, database/R2 failures, revoked authorization, and every AI threshold.

# `src/data/phase-b-ai-usage-source.ts`

## `query`
Builds parameterized aggregate-only SQL.
## `read`
Checks totals before returning `monthlyCents`.
## `decode`
Accepts canonical safe integer cells only.

Provides the temporary `PhaseBAiUsageSource` boundary over `VisionDatabase`.

## `createPhaseBAiUsageSource`

The reader binds owner and Chicago accounting month through a Drizzle SQL
template and returns a frozen `{ monthlyCents }` aggregate only. Its query
compares one `ai_usage_months` row with ledger-derived settled and reserved
totals, checks owner/month joins and transitions as counts, and never projects
ledger/request/provider identifiers.

## `PhaseBAiUsageSourceError`

The source exposes only `unavailable` and `inconsistent` categories; raw
database failures never cross its job boundary.

# `src/data/phase-b-ai-usage-source.ts`

## `phaseBAiUsageQuery`
Builds parameterized aggregate-only SQL.
## `read`
Checks totals before returning `monthlyCents`.
## `readStatus`
Executes the fixed owner-scoped status aggregate.
## `readCalendar`
Executes the fixed owner-scoped active-event count.
## `readAvailabilityAggregate`
Requires exactly one safe count row and discards the count.
## `decodeAggregateCell`
Accepts canonical safe integer cells only.

Provides the temporary `PhaseBAiUsageSource` boundary over `VisionDatabase`.

## `createPhaseBAiUsageSource`

The reader binds owner and Chicago accounting month through a Drizzle SQL
template and returns a frozen `{ monthlyCents }` aggregate only. Its query
anchors on guaranteed one-row aggregates, compares `ai_usage_months` with one
canonical contribution per reservation, and never projects
ledger/request/provider identifiers. It validates exact event counts, temporal
order, terminal values, current reservation agreement, and owner/month
attribution. `settled_estimate` followed by late `settled` replaces the
conservative amount instead of being summed twice. A missing month row is
consistent only when reservation and ledger activity are both absent.

## `createPhaseBNonAiReadSource`

Creates fixed aggregate-only reads over diagnostic status tables and the
owner-scoped active calendar projection. The methods return no content; query
or decoder failure becomes the same closed unavailable source error.

## `PhaseBAiUsageSourceError`

The source exposes only `unavailable` and `inconsistent` categories; raw
database failures never cross its job boundary.

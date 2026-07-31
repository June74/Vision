# `src/data/phase-b-ai-usage-source.ts`

## `phaseBAiLifecycleValidationCtes`
Builds reusable exact lifecycle-validation CTEs.
## `phaseBAiActiveRequestCountQuery`
Builds one owner-wide, cross-month aggregate statement.
## `phaseBAiCandidateRequestCountsQuery`
Builds one atomic candidate-window aggregate statement.
## `phaseBAiUsageQuery`
Builds parameterized aggregate-only SQL.
## `read`
Checks totals before returning `monthlyCents`.
## `countActiveRequests`
Validates and returns the owner-wide in-flight count.
## `readCandidateRequestCounts`
Validates and returns both candidate-window counts.
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

## `countActiveRequests`

Runs one guaranteed-row SQL statement over every reservation for the bound
owner, independent of accounting month. Shared CTEs validate exact event
counts, event ordering, ledger values, current-row timestamps, and owner/month
attribution before the method returns only the safe integer count of
`reserved` plus `dispatched` rows. Any mismatch becomes `inconsistent`.

## `readCandidateRequestCounts`

Snapshots the two input `Date` values, requires a forward interval within one
Chicago accounting month, and performs zero SQL reads when the interval is
invalid. One parameterized SQL statement selects bound-owner reservations with
an inclusive activation and strict evidence boundary, validates their complete
ledger histories, and returns both counts. The created count is unfiltered by
lifecycle. Eligibility additionally requires exact current status `settled`
and completion strictly before evidence. An in-window row whose saved month
differs from the activation month is inconsistent rather than silently
excluded. Only decoded nonnegative safe integers cross the data boundary, and
the returned aggregate is frozen.

## `createPhaseBNonAiReadSource`

Creates fixed aggregate-only reads over diagnostic status tables and the
owner-scoped active calendar projection. The methods return no content; query
or decoder failure becomes the same closed unavailable source error.

## `PhaseBAiUsageSourceError`

The source exposes only `unavailable` and `inconsistent` categories; raw
database failures never cross its job boundary.

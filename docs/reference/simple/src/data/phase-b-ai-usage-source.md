# `src/data/phase-b-ai-usage-source.ts`

## `phaseBAiLifecycleValidationCtes`
Builds the shared exact reservation-history checks.
## `phaseBAiActiveRequestCountQuery`
Builds the owner-wide active-request count.
## `phaseBAiCandidateRequestCountsQuery`
Builds both temporary candidate counts in one snapshot.
## `phaseBAiUsageQuery`
Builds the bound aggregate query.
## `read`
Returns only the admitted monthly total.
## `countActiveRequests`
Returns the owner-wide active request count.
## `readCandidateRequestCounts`
Returns frozen created and eligible candidate counts.
## `readStatus`
Checks that owner status aggregates remain readable.
## `readCalendar`
Checks that the owner calendar projection remains readable.
## `readAvailabilityAggregate`
Decodes one non-AI availability count without returning its value.
## `decodeAggregateCell`
Admits safe aggregate cells.

Reads one owner's monthly AI total without returning any individual request,
provider, model, token, reservation, or ledger identity.

## `createPhaseBAiUsageSource`

Creates a read-only, parameterized owner/month reader.

## `read`

Checks the saved settled and reserved totals against aggregate ledger facts and
returns only their safe monthly sum. Unavailable or inconsistent data becomes a
closed category instead of an error message.

The aggregate rebuilds one contribution per current reservation and validates
the exact allowed reserve, dispatch, release, conservative-settlement, direct
settlement, and late exact-settlement histories. An owner/month with no rows is
zero only when it also has no reservation or ledger activity.

## `countActiveRequests`

Counts only `reserved` and `dispatched` requests for the bound owner across all
Chicago accounting months. The count is returned only after the same exact
current-row and append-only-ledger lifecycle checks pass in that SQL snapshot.

## `readCandidateRequestCounts`

Counts every bound-owner request created from activation up to, but not
including, the evidence instant. It separately counts the exact `settled`
subset completed before that instant. Status and completion never remove a row
from the created count, while a wrong candidate month or inconsistent history
fails closed. The two safe integer counts are returned together in one frozen
aggregate and no request identity is returned.

## `createPhaseBNonAiReadSource`

Creates two content-free owner-scoped checks: one over status tables and one
over the active calendar projection. Successful AI evidence must perform both.

# `src/data/phase-b-ai-usage-source.ts`

## `phaseBAiUsageQuery`
Builds the bound aggregate query.
## `read`
Returns only the admitted monthly total.
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

## `createPhaseBNonAiReadSource`

Creates two content-free owner-scoped checks: one over status tables and one
over the active calendar projection. Successful AI evidence must perform both.

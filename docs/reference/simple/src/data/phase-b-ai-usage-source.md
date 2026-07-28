# `src/data/phase-b-ai-usage-source.ts`

## `query`
Builds the bound aggregate query.
## `read`
Returns only the admitted monthly total.
## `decode`
Admits safe aggregate cells.

Reads one owner's monthly AI total without returning any individual request,
provider, model, token, reservation, or ledger identity.

## `createPhaseBAiUsageSource`

Creates a read-only, parameterized owner/month reader.

## `read`

Checks the saved settled and reserved totals against aggregate ledger facts and
returns only their safe monthly sum. Unavailable or inconsistent data becomes a
closed category instead of an error message.

# Phase B cost review

**Status:** In progress
**Environment:** Preview private pilot
**Measured at:** 2026-07-26
**Budget ceiling:** Approximately $20 per month

This review uses provider dashboards only for fixed plan states and aggregate
usage. It contains no account identifiers, credentials, database URLs, tokens,
email addresses, protected calendar content, or secret values.

## Current measured usage

| Service | Current state | Conservative monthly projection | Budget result |
|---|---|---:|---|
| Neon PostgreSQL | Free plan; 0.87 CU-hours and 0.03 GB used since July 24 | About 9 CU-hours and 0.03 GB if the first three days repeat for a 31-day month | Within the 100 CU-hour and 0.5 GB per-project free allowances |
| Cloudflare Workers | Preview Worker healthy; private-pilot traffic only | Far below 100,000 Worker requests per day | Within Workers Free request allowance |
| Cloudflare Queues | One private synchronization queue; low-volume single-user messages | Far below 10,000 operations per day | Within Workers Free Queue allowance |
| Cloudflare R2 | Paid R2 subscription active at zero fixed monthly charge; one private Standard bucket | Thirty encrypted daily objects plus verification reads are far below 10 GB-month, 1 million Class A, and 10 million Class B free allowances | Expected $0 at private-pilot scale |
| Google Calendar API | Push notifications plus 15-minute repair/renewal maintenance | Far below 10,000 requests/minute per project, 600 requests/minute per user, and 1,000,000 requests/day | Expected $0 |
| OpenAI through AI Gateway | One global fixed 30-day $9.50 Gateway spend rule is live and independently verified | Application hard stop is 950 cents per Chicago accounting month | Provider-side ceiling passes; one harmless live category request and aggregate usage evidence remain |

The measured infrastructure subtotal is currently $0. The application AI
barrier and independently verified Gateway rule both limit AI dispatch to
$9.50, leaving more than $10 of the personal budget for unexpected
managed-service usage. Phase B is not cost-accepted until one harmless live
category request and fixed-shape aggregate usage evidence pass.

The dedicated AI acceptance candidate does not configure or raise the Gateway
limit. Its guarded workflow first runs the existing verifier in read-only mode
and admits only that same-run success boolean into the generated candidate.
The boolean is temporary, server-only, and valid only for `ai_usage`; it is
rejected for every other candidate and absent from the committed normal
configuration. The separate rollback must restore the normal artifact and
verify that both the attestation and one-minute schedule are absent.
Every later candidate must independently pass the fail-closed live normal-state
preflight first; a missing or malformed provider binding response cannot be
treated as an empty safe binding list.

## Authenticated storage warnings

The owner-only diagnostics status now measures storage instead of injecting
static warning flags:

- PostgreSQL uses the read-only
  `pg_database_size(current_database())` aggregate and warns at or above
  400,000,000 bytes.
- R2 lists only the fixed `backups/v1/` namespace in bounded pages, sums only
  admitted integer object sizes, and warns at or above 8,000,000,000 bytes or
  100 admitted objects.
- Database and R2 measurements fail independently. A failed or malformed
  measurement makes that service's warning actionable while preserving the
  other service's successful result.
- Object keys, cursors, metadata, raw provider errors, URLs, credentials, and
  calendar content never enter the diagnostics response or logs.

The three approved thresholds are required positive safe-integer server
bindings in preview and production. Deployment validation pins their exact
values, and the client bundle scanner rejects their binding names.

## Deterministic AI protections

- Warning mode begins at 800 cents.
- Optional requests stop at 900 cents.
- Every new AI request stops at 950 cents.
- Calendar viewing and deterministic synchronization remain available when AI
  is stopped.
- Provider rates are injected configuration, so a pricing change cannot be
  silently hidden in source code.

At current OpenAI standard pricing, the routine `gpt-5.6-luna` route is listed
at $1.00 per million input tokens, $0.10 per million cached input tokens,
$1.25 per million cache-write tokens, and $6.00 per million output tokens. The
application must refresh injected rates whenever the provider price changes.

## AI pricing binding attestation

The **AI integration owner** checks the exact source-controlled policy against
the official OpenAI API model and pricing pages before every preview AI acceptance
and before every production release. Repeat the check after a
provider price change or any model/request-bound change. The reviewed policy is
the single source for the normal Worker artifact, runtime schema, provider
binding proof, preview AI gate, and production release gate.

The attestation fails closed on missing, stale, malformed, extra, or arbitrary
values. Its command reports only whether the policy is valid and does not print the values:

| Binding | Cloudflare type |
|---|---|
| `AI_COMPLEX_WORST_CASE_CENTS` | `plain_text` |
| `AI_INPUT_CENTS_PER_MILLION_TOKENS` | `plain_text` |
| `AI_OPTIONAL_WORST_CASE_CENTS` | `plain_text` |
| `AI_OUTPUT_CENTS_PER_MILLION_TOKENS` | `plain_text` |
| `AI_ROUTINE_WORST_CASE_CENTS` | `plain_text` |

## Provider references

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Neon pricing](https://neon.com/pricing)
- [Google Calendar API quotas](https://developers.google.com/workspace/calendar/api/guides/quota)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)

## Release decision

**Pending.** Current measured and projected infrastructure usage is compatible
with the ceiling, and the provider-side $9.50 rule is verified. The remaining
cost gate is a harmless live OpenAI category request through the configured
Gateway, followed by fixed-shape usage evidence from the guarded dedicated AI
candidate and verified normal rollback.

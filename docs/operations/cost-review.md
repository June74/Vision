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
| OpenAI through AI Gateway | No live preview usage has yet been accepted | Application hard stop is 950 cents per Chicago accounting month | Blocked pending one approved live request and provider usage evidence |

The measured infrastructure subtotal is currently $0. The application AI
barrier limits OpenAI dispatch to $9.50 per accounting month, leaving more than
$10 of the personal budget for unexpected managed-service usage. Phase B is not
cost-accepted until the live AI path is configured and its dashboard usage is
checked.

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

## Provider references

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Neon pricing](https://neon.com/pricing)
- [Google Calendar API quotas](https://developers.google.com/workspace/calendar/api/guides/quota)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)

## Release decision

**Pending.** Current measured and projected infrastructure usage is compatible
with the ceiling. The remaining cost gate is a harmless live OpenAI category
request through the configured Gateway, followed by fixed-shape usage evidence.


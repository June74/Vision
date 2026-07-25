# `src/data/schema/ai-usage.ts`

`ai_usage_months` is the locked monthly accumulator. `ai_usage_reservations` is the current reservation/lease projection with owner-month idempotency and a partial unique index enforcing one in-flight request per owner. `ai_usage_ledger` appends content-free transition facts and has no prompt, response, or JSON field. Checks constrain cents, token counts, lifecycle timestamps, and status consistency.

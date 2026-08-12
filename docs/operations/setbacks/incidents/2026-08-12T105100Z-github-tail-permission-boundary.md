# SB-20260812-105100 — GitHub observer tail permission boundary identified

- **Status:** contained
- **Detected:** 2026-08-12T10:51:00Z
- **Area:** Phase B permanent maintenance baseline / GitHub observer
- **Evidence:** The GitHub observer job passed checkout, exact-tip verification, dependency installation, and workflow setup; only its allowlisted tail step failed with exit code 1. Its supervisor intentionally discards the provider stderr, so the raw permission response is not exposed. A separate local Wrangler tail using the saved local authentication stayed connected, captured a health invocation, and reported no tail/auth error.
- **Likely boundary:** The GitHub `preview` environment token used by `CLOUDFLARE_API_TOKEN_PREVIEW` does not have `Workers Tail Read`, even though the Worker’s observability setting is enabled. Cloudflare documents `Workers Tail Read` as the permission required by `wrangler tail`.
- **Impact:** No application, database, R2, Queue, backup key, or Worker configuration mutation occurred. The live maintenance gate remains pending only because the CI observer cannot read the tail with its current token.
- **Follow-up evidence:** The replacement token metadata was updated before the next run, whose safe log classification showed no 401/403/permission or HTTP marker. A later local read-only probe captured successful maintenance evidence, so the initial missing-Tail-Read hypothesis is not established as the sole cause.
- **Next action:** Keep the replacement token in the GitHub preview environment and diagnose the remaining acceptance/correlation result at the next scheduled boundary; no deployment or provider configuration change is needed.

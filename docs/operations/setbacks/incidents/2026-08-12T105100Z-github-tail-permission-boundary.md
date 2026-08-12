# SB-20260812-105100 — GitHub observer tail permission boundary identified

- **Status:** awaiting owner action
- **Detected:** 2026-08-12T10:51:00Z
- **Area:** Phase B permanent maintenance baseline / GitHub observer
- **Evidence:** The GitHub observer job passed checkout, exact-tip verification, dependency installation, and workflow setup; only its allowlisted tail step failed with exit code 1. Its supervisor intentionally discards the provider stderr, so the raw permission response is not exposed. A separate local Wrangler tail using the saved local authentication stayed connected, captured a health invocation, and reported no tail/auth error.
- **Likely boundary:** The GitHub `preview` environment token used by `CLOUDFLARE_API_TOKEN_PREVIEW` does not have `Workers Tail Read`, even though the Worker’s observability setting is enabled. Cloudflare documents `Workers Tail Read` as the permission required by `wrangler tail`.
- **Impact:** No application, database, R2, Queue, backup key, or Worker configuration mutation occurred. The live maintenance gate remains pending only because the CI observer cannot read the tail with its current token.
- **Next action:** Edit or replace the token stored in the GitHub `preview` environment secret `CLOUDFLARE_API_TOKEN_PREVIEW` so it retains the existing deploy permissions and adds `Workers Tail Read`; keep `CLOUDFLARE_ACCOUNT_ID_PREVIEW` unchanged. Never paste the token into chat. Then rerun one bounded maintenance observer; no new deployment is required for this credential-only repair.

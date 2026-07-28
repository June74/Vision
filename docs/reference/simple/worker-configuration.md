# `worker-configuration.d.ts`

This generated file tells TypeScript which non-secret Worker bindings exist. Regenerate it with `pnpm exec wrangler types` after changing `wrangler.jsonc`.

Vision's deployable Worker configuration also carries three server-only
storage warning thresholds: 400,000,000 database bytes, 8,000,000,000 R2
bytes, and 100 R2 backup objects. The authenticated status check compares
bounded measurements with those values. If one measurement cannot be trusted,
that service shows an actionable warning; no storage identity or provider
error is sent to the browser.

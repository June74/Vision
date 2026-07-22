# `src/worker.ts`

This module creates the default Hono Worker application with `Env` bindings. `GET /api/health` returns HTTP 200 and the exact immutable JSON body `{ status: "ok", service: "vision" }`. The final catch-all route calls `c.env.ASSETS.fetch(c.req.raw)`, preserving the request for Cloudflare static-asset and single-page-application handling. The Worker performs no authentication, database, provider, or AI operation in this task.

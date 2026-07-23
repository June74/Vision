# `src/server/env.ts`

## `RuntimeEnvSchema`

**Signature:** `z.ZodObject<{ VISION_ENV: z.ZodEnum<["local", "preview", "production"]> }>`

The schema accepts exactly one required non-secret binding, `VISION_ENV`. `parse` returns a validated value or throws a Zod validation error for missing or unsupported deployment values. `tests/unit/server/env.test.ts` covers the missing-binding failure.

## `RuntimeEnv`

**Signature:** `z.infer<typeof RuntimeEnvSchema>`

This type keeps TypeScript consumers aligned with the runtime schema. It has no side effects and does not validate values by itself.

## `Env`

**Signature:** `interface Env extends RuntimeEnv { ASSETS: Fetcher }`

`Env` is the Hono binding contract for the Worker. `ASSETS.fetch` serves static browser routes and `DATABASE_URL` is a Worker-only secret consumed by the data boundary. It must authenticate as a least-privileged application role, never `neondb_owner`; the runtime schema intentionally validates only non-secret bindings.

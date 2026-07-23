# `src/server/env.ts`

## `RuntimeEnvSchema`

**Signature:** `z.ZodObject<{ VISION_ENV: z.ZodEnum<["local", "preview", "production"]>; DATABASE_URL: z.ZodString }>`

The schema accepts `VISION_ENV` and the Worker-only `DATABASE_URL`. It safely parses the URL but never includes it in a validation message; the username must be exactly `vision_app`, rejecting `neondb_owner` and every other role. `tests/unit/server/env.test.ts` covers missing and privileged bindings.

## `RuntimeEnv`

**Signature:** `z.infer<typeof RuntimeEnvSchema>`

This type keeps TypeScript consumers aligned with the runtime schema. It has no side effects and does not validate values by itself.

## `Env`

**Signature:** `interface Env extends RuntimeEnv { ASSETS: Fetcher }`

`Env` is the Hono binding contract for the Worker. `ASSETS.fetch` serves static browser routes. `DATABASE_URL` is part of the validated runtime environment and is consumed only by the server-side data boundary.

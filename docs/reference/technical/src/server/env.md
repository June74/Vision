# `src/server/env.ts`

## `RuntimeEnvSchema`

**Signature:** `z.ZodObject<{ VISION_ENV: z.ZodEnum<["local", "preview", "production"]> }>`

The schema accepts exactly one required non-secret binding, `VISION_ENV`. `parse` returns a validated value or throws a Zod validation error for missing or unsupported deployment values. `tests/unit/server/env.test.ts` covers the missing-binding failure.

## `RuntimeEnv`

**Signature:** `z.infer<typeof RuntimeEnvSchema>`

This type keeps TypeScript consumers aligned with the runtime schema. It has no side effects and does not validate values by itself.

## `Env`

**Signature:** `interface Env extends RuntimeEnv { ASSETS: Fetcher }`

`Env` is the Hono binding contract for the initial Worker. `ASSETS.fetch` serves static browser routes. Neither this interface nor the runtime schema contains credential bindings.

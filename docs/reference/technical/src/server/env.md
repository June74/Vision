# `src/server/env.ts`

## `RuntimeEnvSchema`

**Signature:** `z.ZodObject<{ VISION_ENV; DATABASE_URL; KEY_ENCRYPTION_KEY }>`

The schema accepts `VISION_ENV`, Worker-only `DATABASE_URL`, and Worker-only `KEY_ENCRYPTION_KEY`. The key is prebounded to 43 characters, canonically decoded, re-encoded by the shared decoder, and required to produce exactly 32 bytes. This accepts all 16 legal final-character classes while rejecting padding, noncanonical trailing bits, and incorrect lengths. A `finally` block calls `fill(0)` on the application-controlled mutable decoded buffer after both successful validation and decoded-length rejection. Errors never copy either secret. This is best-effort local-buffer clearing, not a claim that immutable JavaScript strings, Web Crypto copies, or engine temporaries are erased.

## `RuntimeEnv`

**Signature:** `z.infer<typeof RuntimeEnvSchema>`

This server-only, secret-bearing type keeps TypeScript consumers aligned with the runtime schema. It has no side effects and does not validate values by itself.

## `parseVisionDatabaseUrl`

**Signature:** `(databaseUrl: unknown) => string`

Validates a runtime value at the database factory boundary through the same `DATABASE_URL` schema. Its failure messages state only the required `vision_app` role and never serialize the URL or password.

## `parseVisionKeyEncryptionKey`

**Signature:** `(keyEncryptionKey: unknown) => string`

Validates a root wrapping secret through the same `KEY_ENCRYPTION_KEY` schema. It is a server-only helper, its constant failure message never serializes the provided key, and schema cleanup clears the application-controlled mutable decoded-byte buffer after acceptance or rejection. It cannot erase the immutable input string or runtime-internal copies.

## `Env`

**Signature:** `interface Env extends RuntimeEnv { ASSETS: Fetcher }`

`Env` is the Hono binding contract for the Worker. `ASSETS.fetch` serves static browser routes. `DATABASE_URL` and `KEY_ENCRYPTION_KEY` are validated runtime secrets consumed only by server-side data and cryptographic boundaries.

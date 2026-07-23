# `src/server/env.ts`

## `RuntimeEnvSchema`

**Signature:** `z.ZodObject<{ VISION_ENV; DATABASE_URL; KEY_ENCRYPTION_KEY }>`

The schema accepts `VISION_ENV`, Worker-only `DATABASE_URL`, and Worker-only `KEY_ENCRYPTION_KEY`. It safely parses the URL but never includes it in a validation message; the username must be exactly `vision_app`. The key must be a canonical unpadded base64url encoding of exactly 32 bytes: 43 allowed characters with a canonical final character. Error messages state only the contract and never copy either secret. `tests/unit/server/env.test.ts` covers missing, privileged, malformed, and secret-containing bindings.

## `RuntimeEnv`

**Signature:** `z.infer<typeof RuntimeEnvSchema>`

This server-only, secret-bearing type keeps TypeScript consumers aligned with the runtime schema. It has no side effects and does not validate values by itself.

## `parseVisionDatabaseUrl`

**Signature:** `(databaseUrl: unknown) => string`

Validates a runtime value at the database factory boundary through the same `DATABASE_URL` schema. Its failure messages state only the required `vision_app` role and never serialize the URL or password.

## `parseVisionKeyEncryptionKey`

**Signature:** `(keyEncryptionKey: unknown) => string`

Validates a root wrapping secret through the same `KEY_ENCRYPTION_KEY` schema. It is a server-only helper and its constant failure message never serializes the provided key.

## `Env`

**Signature:** `interface Env extends RuntimeEnv { ASSETS: Fetcher }`

`Env` is the Hono binding contract for the Worker. `ASSETS.fetch` serves static browser routes. `DATABASE_URL` and `KEY_ENCRYPTION_KEY` are validated runtime secrets consumed only by server-side data and cryptographic boundaries.

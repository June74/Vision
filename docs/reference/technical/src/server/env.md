# `src/server/env.ts`

## Signatures

```ts
parseVisionDatabaseUrl(databaseUrl: unknown): string;
parseVisionKeyEncryptionKey(keyEncryptionKey: unknown): string;
parseGoogleAuthEnvironment(environment: unknown): z.infer<typeof GoogleAuthEnvSchema>;
```

## Dependencies

Uses Zod plus the shared canonical base64url decoder for the 256-bit root key. It has no database, provider, logger, or filesystem dependency.

## Inputs and outputs

Consumes unknown Worker binding values and returns validated strings or the complete Google auth environment. `RuntimeEnv`/`Env` expose the corresponding server-only TypeScript contracts.

## Side effects

Validation is local. The key schema best-effort clears its mutable decoded-byte copy in `finally`; no external call or persistent write occurs.

## Failure behavior

Malformed URLs, wrong role, noncanonical key, partial OAuth configuration, insecure callback, credentialed URL, query/fragment, or wrong path reject through bounded schema messages that do not serialize secrets.

## Privacy and authorization

All bindings are Worker-only. `GOOGLE_ALLOWED_SUB` and email define the private-pilot server allowlist; browser code cannot choose them. Secrets are never copied into validation messages.

## Covering tests

`tests/unit/server/env.test.ts` covers database/key and complete Google environment acceptance/rejection. `tests/worker/auth.test.ts` covers safe missing-binding behavior.

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

## `parseGoogleAuthEnvironment`

**Signature:** `(environment: unknown) => GoogleAuthRuntimeEnv`

Parses the Google OAuth client ID and secret, exact callback URI, allowed subject, allowed email, and environment together. Preview and production require HTTPS. Local permits HTTP only for loopback. Credentials, query, fragment, and any path other than `/api/auth/google/callback` are rejected with constant schema messages.

## `Env`

**Signature:** `interface Env extends RuntimeEnv { ASSETS: Fetcher }`

`Env` is the Hono binding contract for the Worker. `ASSETS.fetch` serves static browser routes. `DATABASE_URL` and `KEY_ENCRYPTION_KEY` are validated runtime secrets consumed only by server-side data and cryptographic boundaries.
## `parseVisionUserTimeZone`

Requires a bounded IANA-style zone or `UTC`; request bodies cannot choose it.

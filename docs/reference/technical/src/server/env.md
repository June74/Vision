# `src/server/env.ts`

`RuntimeEnvSchema` consumes the canonical domain selector tuple. The
`sync_suppression` selector therefore inherits the same preview-only,
paired-expiry, strict-variable boundary without becoming a fault scenario.

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

The schema accepts `VISION_ENV`, Worker-only `DATABASE_URL`, Worker-only
`KEY_ENCRYPTION_KEY`, and the server-only preview candidate bindings. The
candidate selector admits the frozen six faults plus `foundation_probe` and
`ai_usage` only in preview. `PREVIEW_ACCEPTANCE_AI_GATEWAY_LIMIT_ATTESTED` must
be exactly `"true"` if and only if the selector is `ai_usage`. The key is
prebounded to 43 characters, canonically decoded, re-encoded by the shared
decoder, and required to produce exactly 32 bytes. This accepts all 16 legal
final-character classes while rejecting padding, noncanonical trailing bits,
and incorrect lengths. A `finally` block calls `fill(0)` on the
application-controlled mutable decoded buffer after both successful validation
and decoded-length rejection. Errors never copy either secret. This is
best-effort local-buffer clearing, not a claim that immutable JavaScript
strings, Web Crypto copies, or engine temporaries are erased.

## `RuntimeEnv`

**Signature:** `z.infer<typeof RuntimeEnvSchema>`

This server-only, secret-bearing type keeps TypeScript consumers aligned with the runtime schema. It has no side effects and does not validate values by itself.

## `TemporaryRoleProbeEnvSchema`

**Signature:** strict Zod object containing only `VISION_ENV: "preview"` and
`PREVIEW_RESTORE_DATABASE_URL`.

The database binding reuses the existing Worker-only database URL validator,
while the object-level strictness rejects every unrelated capability. Invalid
URL text remains a normal closed schema rejection and is never rethrown by the
role refinement.

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

## `parseOpenAiEnvironment`

Validates the exact server-only OpenAI adapter binding pair. The base URL must be credential-free HTTPS; the API key remains an injected secret and is never included in validation messages or client bindings.

## `parseAiBudgetEnvironment`

Validates the exact hard limit and requires all five canonical
source-controlled per-token and reservation policy strings before converting
them to runtime cents.

## `exactPricingCentsSchema`

Builds a literal-string Zod schema from one approved policy value and
transforms only that exact string to a number.

## `parseUsageWarningThresholds`

**Signature:** `(environment: unknown) => UsageWarningThresholds`

Parses all three required server-only storage threshold bindings into an
immutable domain-shaped record. Each value must be a positive safe integer;
the helper performs no provider call and returns no binding names to clients.

## `parseBackupEnvironment`

Validates `BACKUP_ENCRYPTION_KEY` as a canonical 32-byte base64url secret, coerces `BACKUP_KEY_VERSION` to a positive
safe integer, and rejects equality with `KEY_ENCRYPTION_KEY` when the application key is supplied. The returned
immutable record includes only the backup key and version.

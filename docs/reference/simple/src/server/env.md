# `src/server/env.ts`

## `RuntimeEnvSchema`

`RuntimeEnvSchema` checks the deployment environment, private database URL,
root wrapping key, and server-only preview candidate bindings. It accepts only
the `vision_app` database role and a canonical 256-bit base64url key. The eight
temporary selectors are preview-only. The AI selector alone requires the exact
temporary Gateway attestation, which is rejected everywhere else. After
checking the key, it clears the temporary mutable byte buffer that this code
created; this best-effort cleanup does not claim to erase the original
JavaScript string or runtime-internal copies.

## `RuntimeEnv`

`RuntimeEnv` is the TypeScript description of a checked deployment environment.

## `TemporaryRoleProbeEnvSchema`

Accepts exactly `VISION_ENV=preview` and the temporary restore database
binding. Extra fields, the normal database binding, target identity, storage,
and encryption-key settings are rejected.

## `parseVisionDatabaseUrl`

Checks a server-only database URL and accepts only the `vision_app` role without repeating the secret in errors.

## `parseVisionKeyEncryptionKey`

Checks the server-only root wrapping key format without repeating the secret in errors. It also clears the temporary mutable decoded-byte buffer after either acceptance or rejection.

## `parseGoogleAuthEnvironment`

Requires the complete server-only Google client, exact callback, and private-pilot allowlist configuration.

## `Env`

`Env` adds the static-asset binding. Its database URL and root key remain Worker-only, and the browser never receives them.
## `parseVisionUserTimeZone`

Checks the private-pilot time zone used for calendar creation.

## `parseOpenAiEnvironment`

Checks the server-only AI Gateway base URL and OpenAI provider key without exposing their values.

## `parseAiBudgetEnvironment`

Checks the exact Gateway barrier and all five exact source-controlled pricing
and reservation bindings.

## `exactPricingCentsSchema`

Accepts one exact canonical policy string and converts it to runtime cents.

## `parseUsageWarningThresholds`

Checks the three server-only storage warning thresholds and returns their
database-byte, R2-byte, and R2-object values as positive safe integers.

## `parseBackupEnvironment`

Checks the separate canonical backup encryption key and its positive version. If the application wrapping key is
present, the backup key must be different.

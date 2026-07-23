# `src/server/env.ts`

## `RuntimeEnvSchema`

`RuntimeEnvSchema` checks the deployment environment, private database URL, and root wrapping key. It accepts only the `vision_app` database role and a canonical 256-bit base64url key.

## `RuntimeEnv`

`RuntimeEnv` is the TypeScript description of a checked deployment environment.

## `parseVisionDatabaseUrl`

Checks a server-only database URL and accepts only the `vision_app` role without repeating the secret in errors.

## `parseVisionKeyEncryptionKey`

Checks the server-only root wrapping key format without repeating the secret in errors.

## `Env`

`Env` adds the static-asset binding. Its database URL and root key remain Worker-only, and the browser never receives them.

# `src/server/env.ts`

## `RuntimeEnvSchema`

`RuntimeEnvSchema` checks the deployment environment and private database URL. It accepts only the `vision_app` database role.

## `RuntimeEnv`

`RuntimeEnv` is the TypeScript description of a checked deployment environment.

## `parseVisionDatabaseUrl`

Checks a server-only database URL and accepts only the `vision_app` role without repeating the secret in errors.

## `Env`

`Env` adds the static-asset binding. Its database URL is checked before database setup, and the browser never receives it.

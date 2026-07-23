# `src/server/env.ts`

## `RuntimeEnvSchema`

`RuntimeEnvSchema` checks the deployment environment and private database URL. It accepts only the `vision_app` database role.

## `RuntimeEnv`

`RuntimeEnv` is the TypeScript description of a checked deployment environment.

## `Env`

`Env` adds the static-asset binding. Its database URL is checked before database setup, and the browser never receives it.

# `src/server/env.ts`

## `RuntimeEnvSchema`

`RuntimeEnvSchema` checks that the deployment environment is `local`, `preview`, or `production`.

## `RuntimeEnv`

`RuntimeEnv` is the TypeScript description of a checked deployment environment.

## `Env`

`Env` adds the static-asset binding and the Worker-only database URL secret. The browser never receives this secret.

# `scripts/validate-preview-deploy-config.ts`

`validatePreviewDeployConfig` validates the generated
`dist/vision/wrangler.json` boundary. It requires
`targetEnvironment=preview`, `VISION_ENV=preview`,
`BACKUP_KEY_VERSION=1`, the fixed monthly AI hard limit, the exact preview
redirect configuration, exactly one `BACKUP_BUCKET` binding to
`vision-preview-backups`, the exact calendar Queue producer/consumer policy,
and both maintenance and daily recovery crons. It rejects a serialized
`BACKUP_ENCRYPTION_KEY`.

The command exits nonzero with one generic message when the artifact is
missing, malformed, or unsafe.

## `validatePreviewDeployConfig`

Requires `targetEnvironment=preview`, the complete preview application
variables, no serialized backup encryption key, exactly one `BACKUP_BUCKET`
binding to `vision-preview-backups`, the bounded calendar Queue contract, and
the two approved cron expressions.

## `main`

Parses the generated artifact after the environment-selected Vite build and maps every read, JSON, or contract failure
to one non-sensitive error and a nonzero exit status.

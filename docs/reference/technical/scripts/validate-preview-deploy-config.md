# `scripts/validate-preview-deploy-config.ts`

`validatePreviewDeployConfig` validates the generated
`dist/vision/wrangler.json` boundary. It requires
`targetEnvironment=preview`, `VISION_ENV=preview`,
`BACKUP_KEY_VERSION=1`, and exactly one `BACKUP_BUCKET` binding to
`vision-preview-backups`; it rejects a serialized `BACKUP_ENCRYPTION_KEY`.

The command exits nonzero with one generic message when the artifact is
missing, malformed, or unsafe.

## `validatePreviewDeployConfig`

Requires `targetEnvironment=preview`, preview application variables, no serialized backup encryption key, and exactly
one `BACKUP_BUCKET` binding to `vision-preview-backups`.

## `main`

Parses the generated artifact after the environment-selected Vite build and maps every read, JSON, or contract failure
to one non-sensitive error and a nonzero exit status.

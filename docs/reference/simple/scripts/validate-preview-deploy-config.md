# validate-preview-deploy-config

Checks the generated Cloudflare deployment file before preview deployment.
It stops deployment unless the file selects the preview environment, contains
the required non-secret limits and redirect setting, binds `BACKUP_BUCKET` only
to `vision-preview-backups`, connects the calendar Queue as both producer and
consumer, and contains both maintenance schedules. It also rejects a backup
key that was accidentally written into ordinary deployment variables.

## `validatePreviewDeployConfig`

Checks the parsed generated file for the exact preview environment, variables,
private bucket, Queue behavior, and schedules.

## `main`

Reads `dist/vision/wrangler.json` and exits with one safe error when it is missing or unsafe.

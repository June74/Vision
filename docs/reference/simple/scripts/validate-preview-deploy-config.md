# validate-preview-deploy-config

Checks the generated Cloudflare deployment file before preview deployment.
It stops deployment unless the file selects the preview environment and binds
`BACKUP_BUCKET` only to `vision-preview-backups`. It also rejects a backup key
that was accidentally written into ordinary deployment variables.

## `validatePreviewDeployConfig`

Checks the parsed generated file for the exact preview environment, key version, and private preview bucket.

## `main`

Reads `dist/vision/wrangler.json` and exits with one safe error when it is missing or unsafe.

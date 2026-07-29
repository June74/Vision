# validate-preview-deploy-config

Checks the generated Cloudflare deployment file before preview deployment.
It stops deployment unless the file selects the preview environment, contains
the required non-secret limits and redirect setting, binds `BACKUP_BUCKET` only
to `vision-preview-backups`, connects the calendar Queue as both producer and
consumer, and contains both maintenance schedules. It also rejects a backup
key that was accidentally written into ordinary deployment variables.

## `validatePreviewDeployConfig`

Checks the parsed normal file for the exact preview environment, variables,
private bucket, Queue behavior, and two normal schedules.

## `validatePreviewAcceptanceDeployConfig`

Checks a generated candidate for exactly one expected selector, the one-minute
schedule, and the AI-only attestation.

## `validate`

Applies the shared preview resources and exact normal-or-candidate mode.

## `exactStringRecord`

Rejects missing, extra, inherited, accessor, symbol, or changed variables.

## `exactStringArray`

Requires schedule strings in the exact approved order.

## `validBucket`

Requires only the fixed private preview backup bucket.

## `validQueue`

Requires the one exact Queue producer and bounded consumer.

## `exactOwnRecord`

Checks simple binding records without invoking accessors.

## `isPlainDataObject`

Rejects arrays, null values, and objects with a custom prototype.

## `main`

Reads `dist/vision/wrangler.json` and exits with one safe error when it is missing or unsafe.

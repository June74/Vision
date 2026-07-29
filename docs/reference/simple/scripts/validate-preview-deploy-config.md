# validate-preview-deploy-config

Checks the generated Cloudflare deployment file before preview deployment.
It stops deployment unless the file selects the preview environment, contains
the required non-secret limits and redirect setting, binds `BACKUP_BUCKET` only
to `vision-preview-backups`, connects the calendar Queue as both producer and
consumer, and contains both maintenance schedules. It also rejects a backup
key that was accidentally written into ordinary deployment variables.
With `--verify-provider-state`, it instead checks sanitized live health,
schedule, and settings response files before a candidate or after rollback.
Missing or malformed responses are unsafe.

## `NormalPreviewProviderState`

Groups the three sanitized provider responses required to prove the live
preview is back in its normal state.

## `validatePreviewDeployConfig`

Checks the parsed normal file for the exact preview environment, variables,
private bucket, Queue behavior, and two normal schedules.

## `validatePreviewAcceptanceDeployConfig`

Checks a generated candidate for exactly one expected selector, the one-minute
schedule, and the AI-only attestation.

## `validateNormalPreviewProviderState`

Requires healthy runtime, exactly the two normal schedules, and an explicit
binding list with no temporary preview binding. It fails closed for missing,
null, malformed, or failed provider data.

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

## `ownDataValue`

Reads only an ordinary own data property without invoking inherited values or
accessors.

## `readProviderBindings`

Accepts only the supported successful provider settings shapes and returns an
explicit binding array. Missing, ambiguous, or malformed binding data is
rejected.

## `main`

Reads `dist/vision/wrangler.json` in normal mode. In
`--verify-provider-state` mode it reads the three sanitized provider response
files. Either mode exits with one safe error when input is missing or unsafe.

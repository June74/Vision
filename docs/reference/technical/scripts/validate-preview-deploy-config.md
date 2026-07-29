# `scripts/validate-preview-deploy-config.ts`

`validatePreviewDeployConfig` validates the generated
`dist/vision/wrangler.json` boundary. It requires
`targetEnvironment=preview`, `VISION_ENV=preview`,
`BACKUP_KEY_VERSION=1`, the fixed monthly AI hard limit, the exact preview
redirect configuration, exactly one `BACKUP_BUCKET` binding to
`vision-preview-backups`, the exact calendar Queue producer/consumer policy,
and both maintenance and daily recovery crons. It rejects a serialized
`BACKUP_ENCRYPTION_KEY`.

`validatePreviewAcceptanceDeployConfig` separately admits one expected
generated selector, the additional one-minute cron, and an attestation only
for the AI evidence selector. The command entry point validates only the normal
artifact and exits nonzero with one generic message when it is missing,
malformed, or unsafe.

The separate `--verify-provider-state <health> <schedules> <settings>` mode
validates sanitized live provider responses. It requires a healthy Worker,
exactly the two normal crons in either provider order, and one explicit binding
array with no `PREVIEW_ACCEPTANCE_` binding. Missing, null, ambiguous,
accessor-backed, or malformed provider data fails closed.

## `NormalPreviewProviderState`

Carries the untrusted health, schedule, and settings responses into the live
normal-state validator.

## `validatePreviewDeployConfig`

Requires `targetEnvironment=preview`, the complete preview application
variables, no serialized backup encryption key, exactly one `BACKUP_BUCKET`
binding to `vision-preview-backups`, the bounded calendar Queue contract, and
the two approved cron expressions.

## `validatePreviewAcceptanceDeployConfig`

Requires one admitted selector and applies the acceptance artifact contract.

## `validateNormalPreviewProviderState`

Validates the live normal preview boundary independently of the generated
artifact. It requires successful provider envelopes, `health.status=ok`, the
exact normal cron set, and an explicit array of plain bindings with non-empty
string names and no temporary acceptance name.

## `validate`

Builds the exact expected variables and schedules for normal or acceptance
mode, then validates the common Queue and R2 resources.

## `exactStringRecord`

Compares own enumerable data properties to the exact expected variable record
without invoking accessors.

## `exactStringArray`

Compares the complete ordered cron array without coercion.

## `validBucket`

Requires one exact `BACKUP_BUCKET` binding to `vision-preview-backups`.

## `validQueue`

Requires the exact calendar Queue producer and the fixed bounded consumer
settings.

## `exactOwnRecord`

Checks exact keys and primitive values on a plain data object.

## `isPlainDataObject`

Admits only non-null, non-array objects whose prototype is exactly
`Object.prototype`.

## `ownDataValue`

Reads an own property descriptor and returns only a plain data value, avoiding
getters and inherited provider-controlled fields.

## `readProviderBindings`

Admits either the documented direct `result.bindings` array or nested
`result.settings.bindings` array, but never both, and rejects every missing or
malformed variant.

## `main`

Parses the generated artifact after the environment-selected Vite build in
normal mode. Provider-state mode parses three sanitized response files. Every
read, JSON, or contract failure maps to one non-sensitive error and a nonzero
exit status.

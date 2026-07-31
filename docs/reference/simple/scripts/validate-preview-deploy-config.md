# validate-preview-deploy-config
## `validateTemporaryRestorePairProviderState`
Checks the restore-pair names.

## `validatePreviewProviderStateForCandidateIntent`
Derives both binding and schedule checks from the commit-bound candidate
intent. Synchronization suppression requires only the two permanent schedules;
each other candidate requires those schedules plus the temporary one-minute
schedule.

## `validatePreviewProviderStateForRollback`

Requires exact normal provider state when the durable mutation boundary is
absent. Once that boundary exists, it requires the exact operation-derived
candidate schedule and binding profile; unknown states fail closed.

## `matchesNormalProviderHealthAndSchedules`
Checks healthy runtime and exactly the two permanent schedules.

## `matchesProviderHealthAndSchedules`
Checks healthy runtime and one exact caller-selected schedule list.

## `matchesNormalProviderBindings`
Checks the complete immutable normal binding inventory.

## `matchesTemporaryRestorePairBindings`
Checks the normal inventory plus exactly the two restore-pair secrets.

## `readCandidateOperation`
Reads the operation already admitted by the exact lifecycle intent parser.

## `matchesTemporaryRestoreBinding`
Checks one name-and-type-only temporary restore secret.

Checks the generated Cloudflare deployment file before preview deployment.
It stops deployment unless the file selects the preview environment, contains
the required non-secret limits and redirect setting, binds `BACKUP_BUCKET` only
to `vision-preview-backups`, connects the calendar Queue as both producer and
consumer, and contains both maintenance schedules. It also rejects a backup
key that was accidentally written into ordinary deployment variables.
With `--verify-provider-state`, it instead checks sanitized live health,
schedule, and settings response files before a candidate or after rollback.
Missing or malformed responses are unsafe, as is any missing, duplicated,
unknown, or wrongly typed normal binding.

## `NormalPreviewProviderState`

Groups the three sanitized provider responses required to prove the live
preview is back in its normal state.

## `validatePreviewDeployConfig`

Checks the parsed normal file for the exact preview environment, variables,
private bucket, Queue behavior, and two normal schedules.

## `validatePreviewAcceptanceDeployConfig`

Checks a generated candidate for exactly one expected selector, the exact
selector-specific schedule set, and the AI-only attestation. Synchronization
suppression retains only the two normal schedules; every other acceptance
candidate adds the temporary one-minute schedule.

## `validateNormalPreviewProviderState`

Requires healthy runtime, exactly the two normal schedules, and the complete
normal binding name/type inventory exactly once. It fails closed for missing,
extra, duplicated, unknown, wrongly typed, or malformed provider data.

## `validate`

Applies the shared preview resources and exact normal-or-candidate mode.

## `readOwnString`

Reads one exact own string binding without invoking a getter.

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

## `matchesNormalProviderBindingContract`

Requires the complete normal binding inventory exactly once and rejects a
missing, duplicated, unknown, or wrongly typed binding.

## `main`

Reads `dist/vision/wrangler.json` in normal mode. In
`--verify-provider-state` mode it reads the three sanitized provider response
files. `--verify-candidate-provider-state` additionally reads the candidate
intent and reviewed commit so the live schedule and binding profile match that
exact operation. `--verify-rollback-provider-state` also receives the
validated mutation state and selects normal recovery or strict candidate
rollback. Every mode exits with one safe error when input is missing or unsafe.

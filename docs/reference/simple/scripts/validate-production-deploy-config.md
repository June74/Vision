# validate-production-deploy-config

Checks the generated production deployment file before dry-run and release.
It requires the production environment, normal schedules, the isolated
production queue and backup bucket, and the closed set of ordinary variables.

## `validateProductionDeployConfig`

Checks the entire parsed artifact against the production-only contract.

## `validProductionVars`

Rejects missing, extra, temporary, or malformed ordinary variables.

## `exactArray`

Compares a complete array without coercion.

## `exactRecord`

Checks one exact ordinary binding record.

## `plainObject`

Accepts only ordinary data objects.

## `main`

Reads the fixed generated artifact and prints only a fixed safe outcome.

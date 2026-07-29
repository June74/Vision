# `scripts/validate-production-deploy-config.ts`

Validates the fresh-runner production artifact before Wrangler dry-run and
deployment. It fails closed unless the artifact selects production, contains
only the normal schedules and variable shape, and uses production resources
that are isolated from preview.

## `validateProductionDeployConfig`

Validates the full artifact, including environment, schedules, queue producer
and consumer, backup bucket, and ordinary-variable boundary.

## `validProductionVars`

Requires the exact variable-name set, the production selector, and canonical
decimal strings for non-selector values.

## `exactArray`

Performs an ordered, length-exact array comparison.

## `exactRecord`

Compares own enumerable keys and primitive values without invoking accessors.

## `plainObject`

Rejects arrays, null, and objects with a custom prototype.

## `main`

Reads only the generated production artifact at the fixed path and maps every
failure to one constant error and nonzero exit status.

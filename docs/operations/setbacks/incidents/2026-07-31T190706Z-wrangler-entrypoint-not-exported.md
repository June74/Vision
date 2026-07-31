# SB-20260731-190706-wrangler-entrypoint-not-exported: Wrangler's guessed JavaScript bin subpath is not exported

- **Status:** closed
- **First observed:** 2026-07-31T19:07:06.7862317Z
- **Last observed:** 2026-07-31T19:07:06.7862317Z
- **Phase/task:** Phase B Task 3 Windows supervisor alternative diagnosis
- **Environment:** Local read-only Node module resolution
- **Version/commit:** abfdcb9 plus in-progress isolated repairs

## Symptom

A read-only attempt to resolve a guessed Wrangler JavaScript bin subpath through
the package export map failed with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## Impact

The guessed direct-Node launch path cannot be used as written. The parallel
resolution call's other result was not retained and must be checked separately.
No file, provider, network, environment, secret, staging, or commit changed.

## Cause classification

- **Confirmed cause:** Wrangler's package export map does not expose the guessed
  `bin/wrangler.js` subpath for `require.resolve`.
- **Hypotheses:** The package manifest's declared `bin` target may still be
  discoverable by resolving the exported package manifest or reading the
  already installed manifest directly.
- **Known exclusions:** This is not a missing dependency; the package is
  installed locally.

## Correction and prevention

- **Correction:** Inspect only the installed package's declared bin metadata or
  use an exported specifier; do not guess private subpaths.
- **Prevention:** Derive executable entrypoints from package metadata before
  proposing a direct-Node launch.
- **Owner:** Codex.
- **Next diagnostic step:** Read the local installed Wrangler and tsx package
  manifests' `bin` fields without executing their CLIs.

## Recurrence history

- 2026-07-31T19:07:06.7862317Z: Observed, contained, and closed as a rejected
  read-only hypothesis.

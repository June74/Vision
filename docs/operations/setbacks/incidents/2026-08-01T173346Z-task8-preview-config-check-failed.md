# Setback SB-20260801-173346-task8-preview-config-check-failed

- **Status:** contained
- **Detected:** 2026-08-01T17:33:46.6220270Z
- **Last observed:** 2026-08-10T22:56:43Z
- **Scope:** Phase B Task 8 and OAuth reconnect Task 4 normal preview configuration preflight
- **Version/commit:** `a4376ab` plus the uncommitted Task 2 PostgreSQL proof

## What happened

The repository's normal preview configuration check exited non-zero during
read-only Task 8 preparation. Its three output lines were captured and
discarded instead of displayed because configuration diagnostics may contain a
prohibited callback URI.

## Impact

The intended local preflight is not yet evidence. No source, provider,
deployment, workflow, credential, calendar, database, R2, AI, or Git state
changed.

## Cause classification

- **Confirmed cause:** The bare check reused a generated artifact built without
  the preview environment marker. The authoritative preview workflow sets
  `CLOUDFLARE_ENV=preview` during the preceding build.
- **Rejected hypothesis:** The current normal preview source configuration does
  not violate its validator contract.

## Correction and prevention

- **Correction:** Reproduce the workflow boundary exactly: set the preview build
  environment, build, then run the preview deploy-configuration validator.
- **Prevention:** Wrap configuration checks in an allowlisted diagnostic adapter
  that returns only exit status and a closed failure category.
- **Owner:** Codex.
- **Next diagnostic step:** None; the incident is closed.

## Verification

The workflow-equivalent preview build exited zero, followed by a zero-exit
preview configuration check. Forty-five build lines and one validator line were
captured and discarded; only closed pass/fail facts were displayed. No tracked
source or provider state changed.

The reconnect-recovery recurrence was also closed by a preview-scoped build
and validator that both exited zero. Both detailed streams were discarded, and
no deployment or external access occurred.

## Recurrence history

- 2026-08-02T18:07:20.9965596Z: Recurred after the reconnect-focused aggregate
  CI gate generated the normal production artifact and the bare preview
  validator was then invoked against it. The validator exited nonzero without
  deployment or external access. The contained correction repeats the
  authoritative preview-scoped build-and-check boundary with all potentially
  sensitive build output discarded.
- 2026-08-02T18:09:14.4225822Z: Closed after the workflow-equivalent preview
  build and configuration validator both exited zero with detailed output
  discarded and no deployment.
- 2026-08-03T00:10:52.7510171Z: Recurred while rebuilding the recreated exact
  rollback artifact for the corrected deployment attempt. The production build
  exited zero, then the bare preview validator exited one because the build
  command again omitted the workflow's preview environment marker. No provider
  request or deployment occurred. The correction is the already-proven
  preview-scoped build followed by the same validator.
- 2026-08-10T22:56:43Z: Recurred during final Phase B candidate preflight. The
  candidate build was run without `CLOUDFLARE_ENV=preview`, so the bare preview
  validator exited one. No provider request or deployment occurred; the
  workflow-equivalent preview build is the required correction.

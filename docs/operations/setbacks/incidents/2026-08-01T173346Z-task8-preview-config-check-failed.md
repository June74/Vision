# Setback SB-20260801-173346-task8-preview-config-check-failed

- **Status:** closed
- **Detected:** 2026-08-01T17:33:46.6220270Z
- **Last observed:** 2026-08-01T17:37:55.9860196Z
- **Scope:** Phase B Task 8 normal preview configuration preflight
- **Version/commit:** 10b228bc2c18647f6a8a19c2dd5ad740e7f7491e plus unstaged setback records

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

# SB-20260727-014333-security-scan-raced-build: Security scan raced the production build

- **Status:** closed
- **First observed:** 2026-07-27T01:43:33Z
- **Last observed:** 2026-07-27T01:43:33Z
- **Phase/task:** Phase B clean-room verification
- **Environment:** Local worktree
- **Version/commit:** `50569e6`

## Symptom

The release evidence command reported that the client build contained no files
while build and security commands were started concurrently.

## Impact

The security gate did not run to completion. No provider state changed.

## Cause classification

- **Confirmed cause:** Security evidence depends on the completed production
  artifact, but it was launched in parallel with the build.
- **Known exclusions:** This does not establish a client build or security
  defect.

## Correction and prevention

- **Correction:** Run the production build to completion before starting the
  security evidence and scan.
- **Prevention:** Preserve the release-gate dependency order; parallelize only
  commands without artifact producer-consumer relationships.

## Verification and related work

Documentation coverage passed, the production build completed, fresh release
evidence was captured, and the security scan passed when run sequentially.

# SB-20260731-181336-wrangler-debug-log-permission: Build could not write Wrangler's optional external debug log

- **Status:** closed
- **First observed:** 2026-07-31T18:13:36.9511937Z
- **Last observed:** 2026-07-31T18:13:36.9511937Z
- **Phase/task:** Phase B Task 3 combined root verification
- **Environment:** Local sandboxed production build
- **Version/commit:** 0c3ea58 plus lifecycle repair edits

## Symptom

The production build completed with exit code 0, but Wrangler reported `EPERM`
while attempting to write an optional debug log under the user roaming-profile
configuration directory outside the writable workspace.

## Impact

Both worker and client outputs were built successfully and the production
crypto-boundary validation completed. Only the optional external debug log was
not written. No provider, network, environment, secret, staging, or commit was
touched.

## Cause classification

- **Confirmed cause:** The sandbox does not permit writing Wrangler's log path
  outside the workspace.
- **Hypotheses:** None remaining.
- **Known exclusions:** The build exited successfully and produced both output
  trees.

## Correction and prevention

- **Correction:** Accept the successful build result and continue with
  workspace-local release evidence. Use approved external access only if the
  debug log itself becomes necessary.
- **Prevention:** Distinguish optional CLI telemetry/logging failures from the
  actual build exit status while still recording the permission boundary.
- **Owner:** Codex.
- **Next diagnostic step:** Run release evidence against the now-complete build.

## Recurrence history

- 2026-07-31T18:13:36.9511937Z: Observed and closed after confirming exit code
  0 and complete worker/client outputs.
- 2026-08-16T23:15:57Z: Recurred during the Phase C mutation-persistence full
  gate. Worker tests and the production build completed successfully; only the
  optional Wrangler roaming-profile debug log remained unwritable.
- 2026-08-16T23:30:05Z: Recurred during the Phase C provider-mutation full
  gate. Worker tests, both production bundles, and release security scan
  completed successfully; only the optional external debug log was denied.

# SB-20260726-194134-preview-build-environment-omitted: Preview build environment was omitted

- **Status:** closed
- **First observed:** 2026-07-26T19:41:34.954006Z
- **Last observed:** 2026-07-26T19:42:26.3754466Z
- **Phase/task:** Phase B temporary backup deployment
- **Environment:** Local Phase B worktree
- **Version/commit:** `066fcbd` plus uncommitted temporary acceptance changes

## Symptom

The generated artifact validator rejected a local build because it targeted the default environment.

## Impact

No deployment occurred; the temporary backup acceptance run paused until the preview environment is selected explicitly.

## Reproduction conditions

Run the deployable build without selecting the preview Cloudflare
environment, then validate the resulting artifact as preview.

## Safe evidence

The temporary schedule tests passed. The build completed, and the preview
validator rejected the default-target artifact.

## Attempts and outcomes

- The first command omitted the preview environment and failed safely at the
  deployment validator.
- The next command will set the preview environment and a workspace-local
  Wrangler diagnostic directory.

## Cause classification

- **Confirmed cause:** The build command omitted the preview environment that
  the guarded workflow supplies.
- **Hypotheses:** None recorded.
- **Rejected hypotheses:** None recorded.
- **Known exclusions:** No deployment occurred, and the temporary schedule
  implementation tests passed.

## Correction and prevention

- **Correction:** Rebuild with the explicit preview environment before
  validating or deploying.
- **Prevention:** Reuse the guarded workflow's build environment exactly for
  every local deployable-artifact check.
- **Owner:** Codex and project owner.
- **Next diagnostic step:** Rerun the build and validator with the preview
  environment selected.

## Verification and related work

The explicit preview build and deployment-configuration validator both exited
zero, and the Wrangler log-path warning did not recur.

## Recurrence history

- 2026-07-26T19:41:34.954006Z: First observed.

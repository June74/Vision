# SB-20260727-194036-tail-correction-missed-routing-test: Tail correction missed an older cross-cutting workflow test

- **Status:** contained
- **First observed:** 2026-07-27T19:40:36Z
- **Last observed:** 2026-07-27T19:40:36Z
- **Phase/task:** Phase B restore Task 4 tail correction
- **Environment:** Local and GitHub Actions verification
- **Version/commit:** `9bbc4be`

## Symptom

The corrected workflow uses a 16-minute safe-tail window, but an existing
routing/workflow unit test still asserted the former 85-second command. The
exact reviewed candidate therefore failed its pre-deployment quality gate.

## Impact

The deploy job did not run and the 16-minute restore observation never started.
The temporary secrets remain present and the disposable branch remains
retained for a corrected, reviewed retry.

## Cause classification

- **Confirmed cause:** The correction updated focused safe-tail tests but did
  not update this broader workflow contract assertion.
- **Contributing process failure:** Focused verification and independent review
  did not run or inspect the complete unit suite before the candidate was
  approved and pushed.
- **Known exclusions:** This is not a Cloudflare, Neon, credential, or runtime
  restore failure.

## Correction and prevention

- **Correction:** Update the existing assertion to require the 16-minute
  command and restore-only allowlist filter.
- **Prevention:** Every workflow command change must run the full unit project,
  not only focused test files, before review or deployment.
- **Review response:** Reopen the correction review and require a fresh
  independent verdict on the new exact commit range.

## Verification and related work

The failing test provides the required red state. Implementation, full unit
verification, and renewed review remain pending.
